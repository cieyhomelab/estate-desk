# Documents and Files Implementation Plan

## Overview

Build S-05: a dedicated "Dokumenty i zdjęcia" tab per listing with three capabilities — an editable pre-populated document checklist (sale: 8 items, najem okazjonalny: 5 items), uploaded document files (any type, up to 10 MB), and listing photos (multiple upload, individual delete). The checklist's `checklist_override` boolean on `listings` is the gate S-06 reads to allow transaction close without all items checked.

## Current State Analysis

- `listings` table exists but has no `checklist_override` column.
- No `listing_documents`, `listing_files`, or `listing_photos` tables exist.
- No Supabase Storage buckets configured (storage enabled in `supabase/config.toml:110`, size limit 50 MiB).
- No file upload code anywhere in the codebase; Supabase Storage not called from any route.
- Listing navigation chain is currently: Edit (`[id]/edit.astro`) → Pricing (`[id]/pricing.astro`). No detail/hub page exists.
- API route pattern established: auth first → parse formData → validate → mutate → redirect with `?success`/`?error`.
- `src/lib/supabase.ts:createClient()` returns `null` when env vars absent — null guard required in every route.

## Desired End State

A logged-in agent can navigate to "Dokumenty i zdjęcia" from any listing (card or existing pages), see the pre-populated checklist for their listing type, check/uncheck/add/delete items, toggle the override, upload and delete photos, and upload and delete document files. The page is the single source of truth for document readiness — S-06 will read `checklist_override` and `listing_documents.is_checked` from the DB without any additional UI work.

### Key Discoveries

- Storage RLS must use `split_part(name, '/', 1) = auth.uid()::text` to tie each object to its owner (first path segment is `user_id`).
- `seed_listing_documents()` trigger must use `SET search_path = ''` and fully-qualified names (lessons.md rules 1, 6).
- Cloudflare Workers: `File` objects from `formData()` are native `Blob` subtypes — pass directly to `supabase.storage.from().upload()`; no `arrayBuffer()` conversion needed. Content-Type must be set explicitly to `file.type || 'application/octet-stream'` when it may be empty.
- For multiple photo upload, use `form.getAll('photos')` — returns `File[]`.
- Delete order: attempt Storage delete first; if it fails, return error and do not touch DB. If Storage succeeds but DB delete fails (rare), a storage orphan exists — acceptable for MVP.
- `pricing.astro` and `edit.astro` navigation chains must gain a forward/back link to the new documents page.

## What We're NOT Doing

- No photo ordering or reordering.
- No in-browser file preview (photos show as `<img>`, document files show as a download link only).
- No bulk delete.
- No file rename.
- No document checklist templates per property sub-type (flat vs house). The 8-item sale list and 5-item rental list apply to all property variants.
- No backfill of default checklist items for listings created before this migration (dev data only).
- No storage quota enforcement beyond the 10 MB per-file limit set on the bucket.
- No Storage cleanup when a listing is deleted — `ON DELETE CASCADE` removes DB rows (`listing_photos`, `listing_files`) but Storage objects at `{user_id}/{listing_id}/*` remain. Accepted MVP gap; S-07 (account deletion) should address full cleanup.

## Implementation Approach

Three independent phases: (1) DB + Storage foundation via migration, (2) checklist CRUD — page and API routes, no file I/O, (3) upload/delete for photos and document files. Navigation wiring is part of Phase 2 because the page is created then. Phases 2 and 3 can be manually verified independently: Phase 2 requires only DB (runs locally), Phase 3 requires deployed Workers to confirm file upload works on the Cloudflare stack (roadmap risk note, S-05 unknowns line 153).

## Critical Implementation Details

**Storage path format (contract between migration RLS and upload routes):** All objects are stored at `{user_id}/{listing_id}/{uuid}`. The UUID is generated server-side via `crypto.randomUUID()`. Original filename is stored in the DB `file_name` column for display; the storage path carries no filename. The RLS policy `split_part(name, '/', 1) = auth.uid()::text` enforces ownership via the leading `user_id` segment. Both the migration and every upload/delete route must use this same path pattern — any deviation breaks ownership isolation.

**File upload in Cloudflare Workers:** Pass the `File` object from `formData()` directly to `supabase.storage.from(bucket).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })`. The `upsert: false` guard is important: since storage paths use UUIDs, collisions are impossible in practice, but the explicit flag makes intent clear and prevents silent overwrites.

---

## Phase 1: Database & Storage Foundation

### Overview

Single migration file adds the `checklist_override` column to `listings`, creates three new tables (`listing_documents`, `listing_files`, `listing_photos`) with RLS, adds the `seed_listing_documents()` trigger function (fires on every new listing INSERT), and provisions two Supabase Storage buckets.

### Changes Required

#### 1. Migration file

**File**: `supabase/migrations/20260530000000_documents_and_files.sql`

**Intent**: Create all DB structures and storage buckets needed by S-05 in a single atomic migration. Uses a timestamp of `20260530000000` — adjust to actual `supabase db diff` output timestamp before applying.

**Contract**:

- `ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS checklist_override boolean NOT NULL DEFAULT false;`
- Open the migration with: `create extension if not exists "pgcrypto" with schema extensions;`
- `listing_documents` table: `id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()`, `listing_id uuid FK → listings(id) ON DELETE CASCADE`, `user_id uuid FK → auth.users(id) ON DELETE CASCADE`, `label text CHECK(length 1–500)`, `is_checked boolean DEFAULT false`, `is_default boolean DEFAULT true`, `position integer DEFAULT 0`, `created_at timestamptz DEFAULT pg_catalog.now()`. Enable RLS; policy `owners_own_listing_documents` — `FOR ALL TO authenticated USING/WITH CHECK (user_id = auth.uid())`.
- `listing_files` table: same FK structure, `id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()`, `file_name text`, `storage_path text`, no `is_checked`. Enable RLS; policy `owners_own_listing_files`.
- `listing_photos` table: same structure as `listing_files`, `id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()`. Enable RLS; policy `owners_own_listing_photos`.
- `seed_listing_documents()` function: `RETURNS trigger LANGUAGE plpgsql SET search_path = ''`. On `type = 'sale'` inserts 8 rows; on `type = 'occasional-rental'` inserts 5 rows (labels below). Trigger: `AFTER INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.seed_listing_documents()`.
- Storage bucket `listing-photos`: `public = true`, `file_size_limit = 10485760` (10 MB).
- Storage bucket `listing-documents`: `public = false`, `file_size_limit = 10485760`.
- Storage RLS on `storage.objects` for each bucket: INSERT, SELECT, DELETE policies — all check `split_part(name, '/', 1) = auth.uid()::text` (first path segment is `user_id`).

**Sale default labels (position 1–8):**
1. Akt własności / umowa nabycia
2. Odpis z Księgi Wieczystej
3. Zaświadczenie o niezaleganiu z opłatami
4. Wypis z rejestru gruntów / kartoteki lokali
5. Wyrys z mapy ewidencyjnej
6. Zaświadczenie o liczbie zameldowanych osób
7. Zaświadczenie spółdzielni (jeśli dotyczy)
8. Rzut / plan lokalu

**Najem okazjonalny default labels (position 1–5):**
1. Umowa najmu okazjonalnego
2. Oświadczenie najemcy o poddaniu się egzekucji (akt notarialny)
3. Oświadczenie najemcy o adresie zastępczym
4. Zgoda właściciela lokalu zastępczego
5. Dowód tytułu prawnego wynajmującego (KW lub akt własności)

#### 2. Type definitions

**File**: `src/types/documents.ts`

**Intent**: Declare TS interfaces for the three new DB tables so pages and routes share a single canonical shape.

**Contract**: Export `ListingDocument { id, listing_id, user_id, label, is_checked, is_default, position, created_at }`, `ListingFile { id, listing_id, user_id, file_name, storage_path, created_at }`, `ListingPhoto { id, listing_id, user_id, file_name, storage_path, created_at }` — all fields typed to their DB counterparts (`string`, `boolean`, `number`, `string` for timestamps).

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset` completes without error
- Tables exist: `npx supabase db diff` shows no pending schema changes after reset
- TypeScript compiles: `npm run typecheck` passes

#### Manual Verification

- Create a new sale listing → `listing_documents` table contains 8 rows for that listing (verify via Supabase Studio)
- Create a new najem okazjonalny listing → `listing_documents` table contains 5 rows
- `listings` table has `checklist_override` column defaulting to `false`
- Two buckets visible in Supabase Studio → Storage

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Document Checklist

### Overview

Create the `/dashboard/listings/[id]/documents.astro` page displaying the checklist with check/add/delete, the override toggle, and navigation links. Add four API routes (add item, toggle item, delete item, toggle override). Wire navigation in `ListingCard`, `edit.astro`, and `pricing.astro`.

### Changes Required

#### 1. Documents page

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: The primary UI for S-05. Renders three sections: (A) document checklist with one row per `listing_documents` item (ordered by `position ASC, created_at ASC`), each row having a check form, a label, and a delete form; an "add item" form at the bottom of the list; and the override checkbox form. (B) placeholder sections for photos and files (Phase 3 fills these). Navigation tabs match the existing Edit → Pricing chain.

**Contract**:
- Fetch authenticated user via supabase; null-guard supabase client and user (`if (!supabase) return Astro.redirect('/auth/signin')`).
- Fetch listing: `.from('listings').select('id, type, address, status, checklist_override').eq('id', id).eq('user_id', user.id).single()`. On error or null: redirect `/dashboard?error=nie-znaleziono`.
- Fetch documents: `.from('listing_documents').select('*').eq('listing_id', id).order('position').order('created_at').limit(50)`. Returns array of `ListingDocument`.
- Read `?success` and `?error` query params; render `<Banner>` accordingly (existing Banner component).
- Navigation bar at top: links to `edit` (← Edytuj), `pricing` (Cena i prowizja), current page active (Dokumenty i zdjęcia). Match styling of edit/pricing pages (dark card, blue-accent tabs).
- Checklist section: for each document — `<form method="POST" action="/api/listings/{id}/documents/{doc.id}/toggle">` with hidden `<input name="checked" value="{!doc.is_checked}">` and submit styled as a checkbox; label text; `<form method="POST" action="…/delete">` with a small delete button.
- Add item form: `<input name="label">` + submit; posts to `/api/listings/{id}/documents/add`.
- Override section below checklist: `<form method="POST" action="…/override">` with hidden `<input name="override" value="{!listing.checklist_override}">` and submit as a styled toggle. Include a warning string that explains the gate will be bypassed.
- Photos and files sections: render empty state placeholders (Phase 3 fills them).

#### 2. API: add checklist item

**File**: `src/pages/api/listings/[id]/documents/add.ts`

**Intent**: Insert a new custom checklist item at the end of the list for this listing.

**Contract**: Auth first (`createClient → getUser → redirect /auth/signin`). Supabase null-guard: `if (!supabase) return context.redirect('/auth/signin')`. Parse `formData()` → `label = form.get('label')?.toString().trim()`. Validate: if empty or > 500 chars, redirect with `?error=nieprawidlowa-nazwa`. Verify listing ownership: `.from('listings').select('id').eq('id', params.id).eq('user_id', user.id).single()`. Compute `nextPosition`: `.from('listing_documents').select('position').eq('listing_id', params.id).order('position', { ascending: false }).limit(1)` — take `data[0]?.position ?? 0` + 1. Insert: `.from('listing_documents').insert({ listing_id, user_id, label, is_checked: false, is_default: false, position: nextPosition })`. On error: redirect `?error=blad-zapisu`. On success: redirect `?success=dodano`.

#### 3. API: toggle checklist item

**File**: `src/pages/api/listings/[id]/documents/[docId]/toggle.ts`

**Intent**: Set `is_checked` to the submitted boolean for one checklist item, verifying ownership via `user_id`.

**Contract**: Auth first. Parse `formData()` → `checked = form.get('checked') === 'true'`. Update: `.from('listing_documents').update({ is_checked: checked }).eq('id', params.docId).eq('user_id', user.id)`. On error: redirect `?error=blad-zapisu`. On success: redirect back to documents page (no success banner — checkbox interactions should feel instant; omit `?success` param).

#### 4. API: delete checklist item

**File**: `src/pages/api/listings/[id]/documents/[docId]/delete.ts`

**Intent**: Delete one checklist item regardless of whether it is a default or custom item.

**Contract**: Auth first. Delete: `.from('listing_documents').delete().eq('id', params.docId).eq('user_id', user.id)`. // Intentionally no .select() — idempotent delete, 0-row result is not an error. (documents-and-files plan Phase 2.) On error: redirect `?error=blad-usuniecia`. On success: redirect `?success=usunieto`.

#### 5. API: toggle checklist override

**File**: `src/pages/api/listings/[id]/documents/override.ts`

**Intent**: Set `checklist_override` on the listing to the submitted boolean, giving the agent the ability to bypass the document gate in S-06.

**Contract**: Auth first. Parse `formData()` → `override = form.get('override') === 'true'`. Update: `.from('listings').update({ checklist_override: override }).eq('id', params.id).eq('user_id', user.id)`. On error: redirect `?error=blad-zapisu`. On success: redirect with `?success=zapisano`.

#### 6. Navigation wiring

**File**: `src/components/listings/ListingCard.astro`

**Intent**: Add a "Dokumenty i zdjęcia" action button alongside the existing Edytuj and Cena i prowizja buttons.

**Contract**: Insert an `<a>` button linking to `/dashboard/listings/{listing.id}/documents` with the same secondary button style used for existing action buttons. Add it after "Cena i prowizja" and before "Usuń".

**File**: `src/pages/dashboard/listings/[id]/edit.astro`

**Intent**: Add a forward navigation link to the documents page.

**Contract**: Add a link "Dokumenty i zdjęcia →" pointing to `/dashboard/listings/{id}/documents` to the existing bottom navigation bar (alongside the current "Cena i prowizja →" link).

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: Add a forward navigation link to the documents page.

**Contract**: Add "Dokumenty i zdjęcia →" link in the bottom navigation bar.

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run typecheck` passes
- Lint passes: `npm run lint`

#### Manual Verification

- Create a sale listing → navigate to Documents tab → 8 checklist items shown, pre-checked = false
- Check an item → page reloads, item appears checked
- Add a custom item → it appears at the bottom of the list with a delete button
- Delete an item (default or custom) → item removed from list
- Toggle override → override state reflected in the DB (`listings.checklist_override`)
- Navigate Edit → Pricing → Dokumenty i zdjęcia using page-level links
- "Dokumenty i zdjęcia" button on ListingCard navigates to correct URL
- Error banner appears for invalid add-item input

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Photo & File Uploads

### Overview

Add Supabase Storage upload and delete for listing photos (multi-file, public bucket, displayed as a thumbnail grid) and document files (single file per submit, private bucket, displayed as a download-link list). Update `documents.astro` to render both sections with live data.

### Changes Required

#### 1. API: upload photos

**File**: `src/pages/api/listings/[id]/photos/upload.ts`

**Intent**: Accept one or more image files from the multi-file form input, upload each to the `listing-photos` bucket, and insert a `listing_photos` row per file.

**Contract**: Auth first. Supabase null-guard. Verify listing ownership: `.from('listings').select('id').eq('id', params.id).eq('user_id', user.id).single()` — redirect `?error=nie-znaleziono` if not found. Parse `formData()` → `const files = form.getAll('photos').filter(f => f instanceof File && f.size > 0)`. Validate: if no files, redirect `?error=brak-plikow`. For each file: validate `file.size <= 10 * 1024 * 1024`, redirect `?error=plik-za-duzy` if exceeded; validate `file.type.startsWith('image/')`, redirect `?error=nieprawidlowy-typ` if not an image. Generate `storagePath = `${user.id}/${params.id}/${crypto.randomUUID()}``; call `supabase.storage.from('listing-photos').upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false })`; if Storage error, redirect `?error=blad-uploadu` (abort loop); insert row into `listing_photos (listing_id, user_id, file_name: file.name, storage_path: storagePath)`; if DB insert fails, attempt best-effort cleanup: `supabase.storage.from('listing-photos').remove([storagePath])`, then redirect `?error=blad-zapisu` (accepted MVP risk if cleanup also fails). On all-success: redirect `?success=dodano-zdjecia`.

#### 2. API: delete photo

**File**: `src/pages/api/listings/[id]/photos/[photoId]/delete.ts`

**Intent**: Delete a listing photo from Storage and its DB row.

**Contract**: Auth first. Fetch photo: `.from('listing_photos').select('storage_path').eq('id', params.photoId).eq('user_id', user.id).single()`. If not found: redirect `?error=nie-znaleziono`. Delete from Storage first: `supabase.storage.from('listing-photos').remove([photo.storage_path])`. If Storage error: redirect `?error=blad-usuniecia` (DB untouched). Then delete DB row: `.from('listing_photos').delete().eq('id', params.photoId).eq('user_id', user.id)`. // Intentionally no .select() — idempotent delete, 0-row result is not an error. (documents-and-files plan Phase 3.) On success: redirect `?success=usunieto`.

#### 3. API: upload document file

**File**: `src/pages/api/listings/[id]/files/upload.ts`

**Intent**: Accept a single document file (any type, up to 10 MB), upload to the private `listing-documents` bucket, and insert a `listing_files` row.

**Contract**: Auth first. Supabase null-guard. Verify listing ownership: `.from('listings').select('id').eq('id', params.id).eq('user_id', user.id).single()` — redirect `?error=nie-znaleziono` if not found. Parse `formData()` → `const file = form.get('file')`. Validate `file instanceof File && file.size > 0`; if not, redirect `?error=brak-pliku`. Validate `file.size <= 10 * 1024 * 1024`; if too large, redirect `?error=plik-za-duzy`. `storagePath = `${user.id}/${params.id}/${crypto.randomUUID()}``; upload to `listing-documents` bucket with same pattern as photos. Insert `listing_files` row; if DB insert fails, attempt best-effort cleanup: `supabase.storage.from('listing-documents').remove([storagePath])`, then redirect `?error=blad-zapisu` (accepted MVP risk if cleanup also fails). On success: redirect `?success=dodano-plik`.

#### 4. API: delete document file

**File**: `src/pages/api/listings/[id]/files/[fileId]/delete.ts`

**Intent**: Delete a document file from private Storage and its DB row.

**Contract**: Mirror of photo delete but for `listing_files` table and `listing-documents` bucket. // Intentionally no .select() — idempotent delete, 0-row result is not an error. (documents-and-files plan Phase 3.)

#### 5. Update documents page — photos section

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: Replace the Phase 2 photos placeholder with live data: fetch listing photos, render a thumbnail grid with per-photo delete form, and render a multi-file upload form.

**Contract**:
- Fetch: `.from('listing_photos').select('*').eq('listing_id', id).order('created_at').limit(100)`.
- For each photo, get public URL: `supabase.storage.from('listing-photos').getPublicUrl(photo.storage_path)` → `data.publicUrl`. Render as `<img src={publicUrl} alt={photo.file_name}>` inside a thumbnail card with a "Usuń" delete form.
- Upload form: `<input type="file" name="photos" multiple accept="image/*">` posting to `/api/listings/{id}/photos/upload`.
- Empty state: "Brak zdjęć. Dodaj pierwsze zdjęcie." (plain paragraph, no interactive element — the upload form above already serves this purpose).

#### 6. Update documents page — files section

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: Replace the Phase 2 files placeholder with live data: fetch document files, render each as a download link with a delete form, and render a single-file upload form.

**Contract**:
- Fetch: `.from('listing_files').select('*').eq('listing_id', id).order('created_at').limit(100)`.
- Generate all signed URLs in parallel: `const signedUrls = await Promise.all(files.map(f => supabase.storage.from('listing-documents').createSignedUrl(f.storage_path, 3600)))`. Zip with files array and render each as `<a href={signedUrl} target="_blank">{file.file_name}</a>` with a "Usuń" delete form inline.
- Upload form: `<input type="file" name="file">` (no `accept` — any file type) posting to `/api/listings/{id}/files/upload`.
- Empty state: "Brak plików. Dodaj pierwszy plik."

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run typecheck` passes
- Lint passes: `npm run lint`

#### Manual Verification

- Upload 2–3 photos to a listing on the **deployed Workers environment** → thumbnails appear in photo grid
- Delete one photo → removed from grid; file gone from Supabase Storage
- Upload a document file (PDF, image, or other) → appears in files list with a working download link
- Delete a document file → removed from list; file gone from Supabase Storage
- Upload a file > 10 MB → error banner appears, no file stored
- Upload with no file selected → error banner appears
- Verify Cloudflare Workers handles the multipart upload (no timeout, no body-parse error) — test with a ~9 MB file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests

- None planned — no pure business logic functions in this slice; all logic is in routes.

### Integration Tests

- None in this slice (no integration test infrastructure yet).

### Manual Testing Steps

1. Create a sale listing → navigate to Documents → verify 8 default items appear
2. Create a najem okazjonalny listing → verify 5 default items appear
3. Check an item, add a custom item, delete an item — verify DB state via Studio
4. Toggle override → verify `listings.checklist_override` flips in DB
5. Upload 3 photos on deployed Workers → confirm grid display and Storage bucket contents
6. Delete one photo → confirm removed from UI and Storage
7. Upload a document file → confirm download link works
8. Delete a document file → confirm removed
9. Test with 9 MB file (near limit) — should succeed
10. Test with 11 MB file — should show Polish error message

## Performance Considerations

- Signed URL generation for document files adds one Storage API call per file on page load. Acceptable at MVP scale (single agent, typically <20 files per listing). If slow in practice, cache signed URLs with a short TTL or batch-generate; defer to post-MVP.
- Photo public URLs require no server call — computed locally from storage path.

## Migration Notes

- No backfill for pre-existing listings: dev data only, no real listings in the DB at migration time.
- `checklist_override` defaults to `false` — safe for any pre-existing listings.

## References

- Roadmap S-05 entry: `context/foundation/roadmap.md` (lines 143–155)
- PRD FR-005, FR-015, FR-016: `context/foundation/prd.md`
- Lessons — function search_path, schema-qualify trigger, null guard, auth-first, Polish error strings: `context/foundation/lessons.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database & Storage Foundation

#### Automated

- [ ] 1.1 `npx supabase db reset` completes without error
- [ ] 1.2 `npm run typecheck` passes after adding `src/types/documents.ts`

#### Manual

- [ ] 1.3 Sale listing creates 8 `listing_documents` rows (verified in Supabase Studio)
- [ ] 1.4 Najem okazjonalny listing creates 5 `listing_documents` rows
- [ ] 1.5 `listings.checklist_override` column visible, defaults to `false`
- [ ] 1.6 Two storage buckets visible in Supabase Studio

### Phase 2: Document Checklist

#### Automated

- [ ] 2.1 `npm run typecheck` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Sale listing Documents tab shows 8 pre-populated items
- [ ] 2.4 Check / uncheck item — state persists on reload
- [ ] 2.5 Add custom item — appears at bottom of checklist
- [ ] 2.6 Delete item — removed from list
- [ ] 2.7 Toggle override — `listings.checklist_override` flips in DB
- [ ] 2.8 Edit → Pricing → Documents navigation chain works
- [ ] 2.9 ListingCard "Dokumenty i zdjęcia" button navigates correctly
- [ ] 2.10 Error banner shown for empty add-item input

### Phase 3: Photo & File Uploads

#### Automated

- [ ] 3.1 `npm run typecheck` passes
- [ ] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 Upload 2–3 photos on deployed Workers — thumbnails appear
- [ ] 3.4 Delete photo — removed from UI and Storage
- [ ] 3.5 Upload document file — download link works
- [ ] 3.6 Delete document file — removed from UI and Storage
- [ ] 3.7 File > 10 MB → Polish error banner, no file stored
- [ ] 3.8 No-file-selected submit → Polish error banner
- [ ] 3.9 ~9 MB file upload succeeds on Workers (no timeout)
