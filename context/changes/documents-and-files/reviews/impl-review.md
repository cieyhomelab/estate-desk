<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Documents and Files

- **Plan**: `context/changes/documents-and-files/plan.md`
- **Scope**: Pre-implementation — all phases (plan quality check, 0/17 Progress items done)
- **Date**: 2026-05-30
- **Verdict**: NEEDS ATTENTION → resolved via triage
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Missing .limit() on all three list-rendering queries

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: plan.md — Phase 2 documents page contract; Phase 3 photos and files contracts
- **Detail**: Three list queries violated lessons.md rule (listing_documents, listing_photos, listing_files — no .limit()).
- **Fix**: Added .limit(50) to listing_documents, .limit(100) to listing_photos and listing_files.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Plan contracts must specify .limit() on every list-rendering query"

### F2 — Photo/file upload routes lack listing ownership check before Storage write

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Safety & Quality
- **Location**: plan.md — Phase 3, photos/upload.ts and files/upload.ts contracts
- **Detail**: Upload routes skipped explicit listing ownership pre-check present in add.ts, allowing a crafted request to write Storage objects under an arbitrary listing_id before RLS rejects the DB insert.
- **Fix**: Applied Fix A — added listing ownership pre-check step to both upload contracts.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Upload route contracts must verify entity ownership before Storage writes"

### F3 — Photo upload contract missing explicit file-size cap and server-side MIME validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: plan.md — Phase 3, photos/upload.ts contract
- **Detail**: files/upload.ts had both checks; photos/upload.ts had neither — bucket-level enforcement only, public bucket exposed to non-image uploads.
- **Fix**: Added file.size <= 10 MB and file.type.startsWith('image/') validation steps to photos/upload.ts contract.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Upload route contracts must specify server-side file size and type validation"

### F4 — Migration contract omits gen_random_uuid() DEFAULT and extension declaration

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: plan.md — Phase 1, migration file contract
- **Detail**: All three new table PKs were contracted as `id uuid PK` — missing extension declaration and schema-qualified DEFAULT.
- **Fix**: Added `create extension if not exists "pgcrypto" with schema extensions;` and changed all three PKs to `id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()`.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Migration plan contracts must state the full UUID PK DEFAULT expression"

### F5 — Upload contracts don't acknowledge Storage orphan on DB insert failure

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: plan.md — Phase 3, photos/upload.ts and files/upload.ts contracts
- **Detail**: Delete direction addressed (Storage first, DB second); upload direction orphan risk not acknowledged.
- **Fix**: Added best-effort cleanup step (`remove([storagePath])` on DB insert failure) to both upload contracts.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Upload contracts must address the Storage-orphan risk on DB insert failure"

### F6 — Storage objects not cleaned up when listing is deleted

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: plan.md — "What We're NOT Doing"
- **Detail**: ON DELETE CASCADE removes DB rows but not Storage objects; public photos remain accessible after listing deletion.
- **Fix**: Added explicit note to "What We're NOT Doing" deferring cleanup to S-07.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Document Storage cleanup gaps in 'What We're NOT Doing' when tables use CASCADE"

### F7 — Signed URL generation implied sequential; parallelization not specified

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: plan.md — Phase 3, files section contract
- **Detail**: "for each file" implies sequential loop; N×latency at page load.
- **Fix**: Changed contract to specify `Promise.all(files.map(...))` for parallel signed URL generation.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Astro SSR page contracts must specify Promise.all for parallel async calls"
