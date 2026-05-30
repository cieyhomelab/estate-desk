# Documents and Files — Plan Brief

> Full plan: `context/changes/documents-and-files/plan.md`

## What & Why

Build the "Dokumenty i zdjęcia" tab for each listing — a pre-populated editable document checklist, document file uploads, and listing photo uploads. This slice directly gates S-06 (transaction-close, the north star): S-06 reads `checklist_override` and `listing_documents.is_checked` to decide whether the agent can close a transaction. Without S-05, S-06 cannot be built.

## Starting Point

The listing CRUD and pricing pages exist (`edit.astro`, `pricing.astro`). No file upload code, Storage buckets, or document-related DB tables exist yet. Navigation currently chains Edit → Pricing with no further tab.

## Desired End State

A logged-in agent opens a listing, clicks "Dokumenty i zdjęcia", and sees: the document checklist pre-filled for their listing type (sale: 8 items, najem okazjonalny: 5 items), with each item checkable/deletable and a form to add custom items; an override toggle to bypass the gate; a photo grid with multi-file upload and per-photo delete; and a document files list with per-file upload/delete and signed download links.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Sale checklist items | Standard 8-item Polish list | Covers all documents a notary expects for a sale transaction | Plan |
| Najem okazjonalny checklist items | Standard 5-item list | Covers legally required documents for najem okazjonalny validity | Plan |
| Page structure | New dedicated `/documents` tab | Matches existing Edit / Pricing tab pattern; clean separation | Plan |
| Storage | Two buckets: `listing-photos` (public) + `listing-documents` (private) | Photos served via public CDN URLs; documents via signed URLs for privacy | Plan |
| Custom checklist items | Add + delete allowed | PRD FR-015 explicitly requires it; handles atypical property types | Plan |
| Checklist override | `checklist_override boolean` column on `listings` | Minimal DB change; S-06 reads it directly in one query | Plan |
| File type restrictions | None (any file, up to 10 MB) | Agent workflow includes varied formats; validation at size only | Plan |
| Photo management | Multi-file upload + per-photo delete | Matches professional use case (10+ photos per listing) | Plan |

## Scope

**In scope:**
- DB migration: 3 new tables + `checklist_override` column + seeding trigger + 2 Storage buckets
- Documents page: checklist CRUD, override toggle, photo grid, file list
- 8 API routes: add/toggle/delete checklist item, toggle override, upload+delete photos, upload+delete files
- Navigation wiring: ListingCard button + Edit/Pricing forward links

**Out of scope:** Photo ordering, file preview, bulk delete, file rename, Office doc support, existing-listing backfill, storage quota enforcement beyond per-file limit.

## Architecture / Approach

New DB tables (`listing_documents`, `listing_files`, `listing_photos`) with RLS tied to `user_id`. A Postgres trigger `seed_listing_documents()` fires `AFTER INSERT ON listings` and inserts default checklist rows based on `type`. Storage paths are `{user_id}/{listing_id}/{uuid}` — the leading `user_id` segment is what Storage RLS policies enforce. File deletion always hits Storage first; if Storage fails, DB is untouched. Photo URLs are public (direct CDN); document URLs are signed (1-hour TTL generated at page render).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB & Storage | Migration with tables, trigger, Storage buckets | Trigger must use `SET search_path = ''` (lessons.md rule) |
| 2. Document Checklist | New Documents page + 4 API routes + navigation wiring | No file I/O — safe to verify locally before deploy |
| 3. Photo & File Uploads | Upload/delete for photos and document files | Cloudflare Workers multipart file upload untested (roadmap-flagged risk) |

**Prerequisites:** S-02 (listing-crud) done, F-01 (database-schema) done, F-02 (Cloudflare deploy) required for Phase 3 verification only.

**Estimated effort:** ~2–3 sessions across 3 phases. Phase 3 requires a deployed Workers environment to fully verify.

## Open Risks & Assumptions

- Cloudflare Workers file upload compatibility at 10 MB is roadmap-flagged but untested; Phase 3 manual criteria explicitly include a ~9 MB upload test on deployed Workers.
- Signed URL generation (one call per document file at page render) could be slow with many files — acceptable at MVP, flagged for post-MVP caching if needed.
- Sale and najem okazjonalny default checklist labels are a best-guess at the standard Polish lists; agent may adjust per-listing using the add/delete custom item feature.

## Success Criteria (Summary)

- A new listing of either type gets its default checklist automatically (trigger verified via Studio)
- Agent can check off all items, add custom ones, and toggle the override — state persists across sessions
- Photos upload and display as thumbnails on deployed Workers; document files are downloadable via signed links
