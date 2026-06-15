## EstateDesk Coding Conventions

These conventions apply to all EstateDesk implementation work. Follow them exactly; they override generic framework defaults.

### 1. Astro Env Schema for New Secret Variables

Every new environment variable used in the app **must** be declared in `astro.config.mjs` under `env.schema` before it can be imported. Without the declaration the variable is `undefined` at runtime in Cloudflare Workers even if the secret is set. See existing declarations in `@astro.config.mjs`.

Then import it in server-side code:

```typescript
import { MY_SECRET } from "astro:env/server";
```

For public client-side variables use `context: "client", access: "public"` and import from `"astro:env/client"`.

### 2. API Route Shape

All API routes live in `src/pages/api/`. Export a named HTTP-verb handler typed as `APIRoute`. Check Supabase auth at the top before any business logic. Return `context.redirect()` for form-style routes. Return `new Response(JSON.stringify(...))` only for fetch-style routes called by React islands.

See a canonical form-style example: `@src/pages/api/listings/create.ts`

For fetch-style routes (called via `fetch()` from a React island):

```typescript
return new Response(JSON.stringify({ result }), {
  headers: { "Content-Type": "application/json" },
});
```

### 3. External LLM Calls Must Go Via a Server-Side API Route

Never call OpenRouter (or any external LLM API) from a React component. The API key would end up in the browser bundle or network requests. Instead:

1. Create an API route in `src/pages/api/` that calls the LLM server-side.
2. Read the key via `import { OPENROUTER_API_KEY } from "astro:env/server"` inside the API route.
3. Have the React component call the local API route via `fetch('/api/your-route', { method: 'POST', body: JSON.stringify({...}) })`.

See the canonical example: `@src/pages/api/format-address.ts`

### 4. React Island Hydration

Use `client:load` for interactive React components that receive Astro props and benefit from SSR (e.g., forms with server-provided error messages). Use `client:only="react"` only when a component uses browser-only APIs (`localStorage`, `window`) and must not server-render. Do not use `client:visible` or `client:idle` — EstateDesk is SSR-first and these lazy strategies add complexity without benefit.

```astro
<!-- Preferred for most islands -->
<MyForm serverError={error} client:load />
<!-- Only when the component requires browser-only APIs -->
<BrowserOnlyWidget client:only="react" />
```

### 5. Tailwind CSS v4

This project uses Tailwind CSS v4.

- **Do not create `tailwind.config.js`** — v4 removed it; the file will be ignored.
- Theme tokens live in `src/styles/global.css` under `@theme inline { ... }`. Add custom tokens and utilities there, not in a config file. See `@src/styles/global.css`.
- Custom utilities use `@utility name { ... }` (e.g., `@utility bg-cosmic { ... }`).
- The Vite plugin is `tailwindcss()` from `@tailwindcss/vite` (already wired in `astro.config.mjs`).

### 6. Known Failure Modes

Non-obvious failures that are hard to debug when hit. Add an entry here whenever a production or local failure turns out to have a non-obvious root cause.

- **Env variable is `undefined` at runtime despite secret being set** — Missing `env.schema` declaration in `astro.config.mjs`. Cloudflare Workers silently drops undeclared variables. Fix: §1.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 1

Bootstrap a greenfield project end-to-end with the **shaping chain**:

```
/10x-init  →  /10x-shape  →  /10x-prd  →  (10x-tech-stack-selector)  →  (bootstrapper)
```

The first three skills ship in this lesson; the last two are the next links in the chain.

### Task Router — Where to start

| Skill | Use it when |
| --- | --- |
| **Project setup** | |
| `/10x-init` | The project directory is fresh. Scaffolds `context/foundation/lessons.md` and `docs/reference/contract-surfaces.md` so the rest of the workflow has somewhere to write. Run this once per project. |
| **Discovery** | |
| `/10x-shape` | You have an idea and need to turn it into structured shape-notes BEFORE writing a PRD. Greenfield only. Walks vision → persona/access → MVP → FRs (with Socratic challenge) → business logic & data → stack-openness sketch. Surfaces empty-CRUD and MVP-too-big anti-patterns by name. Output: `context/foundation/shape-notes.md` with a resumable `checkpoint:` block. |
| **Document generation** | |
| `/10x-prd` | You have shape-notes (or raw notes) and want a schema-conformant `context/foundation/prd.md`. Generates against the locked schema, routes every gap verbatim into `## Open Questions`, and refuses to invent domain decisions. On collision, prompts overwrite vs. versioned save (`prd-vN.md`). |

### How the chain hands off

- `/10x-init` produces the workflow v2 scaffold (`context/foundation/`, `lessons.md`, `contract-surfaces.md`). `/10x-shape` requires this and will offer to delegate to `/10x-init` if it's missing.
- `/10x-shape` writes `context/foundation/shape-notes.md` with frontmatter `checkpoint:` (current_phase, phases_completed, frs_drafted, quality_check_status). On re-entry, it resumes from the next unfinished phase.
- `/10x-prd` reads `shape-notes.md` (default) or any path you pass, scores the input on a 4-signal heuristic, warns on thin input, and writes `context/foundation/prd.md` against the schema at `skills/10x-shape/references/prd-schema.md` (frontmatter aligned 1:1 with 10x-tech-stack-selector's Q1–Q7).

### What the PRD captures (and what it does NOT)

- **Captured**: vision, persona, success criteria, user stories (Given/When/Then), FRs (FR-NNN), NFRs, business logic (one-sentence rule first), data model, access control, durable implementation decisions, testing strategy, deployment & CI/CD strategy, non-goals, open questions.
- **NOT captured (deliberate)**: framework choices, database choices, file paths, deployment platform. Stack openness is binding — only `product_type` and `tech_preferences.language_family` capture stack-shaped intent. Frameworks are 10x-tech-stack-selector's job.

### Anti-patterns surfaced during shaping

- **Empty-CRUD**: business logic that reduces to "users add and remove records" with no domain rule. `/10x-shape` names it explicitly and prompts for a real rule shape (recommendation, prioritization, classification, validation, scoring, workflow, calculation).
- **MVP-too-big**: first-flow estimate exceeds ~1 week of after-hours work, or > 4 distinct user actions before user-visible value, or requires multiple integrations before payoff. Skill names the expensive pieces and offers concrete scope-down moves.

Both are **soft gates**: they warn but allow override. Overrides are recorded in the checkpoint and surfaced in the PRD's `## Open Questions`.

### Foundation paths used by this lesson

- `context/foundation/shape-notes.md` — `/10x-shape` output
- `context/foundation/prd.md` (or `prd-vN.md`) — `/10x-prd` output
- `context/foundation/lessons.md` — recurring rules & pitfalls (scaffolded by `/10x-init`)
- `docs/reference/contract-surfaces.md` — load-bearing names registry (scaffolded by `/10x-init`)

### Universal language

The shipped skills carry no 10xDevs / cohort / certification references. The mechanics (Socratic challenge, gray-area discovery, recommended-answer fatigue mitigation, soft quality gate) are universal indicators of a well-scoped greenfield project.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
