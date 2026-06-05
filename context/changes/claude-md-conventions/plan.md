# EstateDesk Coding Conventions — Implementation Plan

## Overview

Add a `## EstateDesk Coding Conventions` block to the top of `CLAUDE.md` (before the 10xDevs toolkit lesson block). The block documents five project-specific patterns in English that the agent must follow when implementing S-01, S-02, and S-03.

## Current State Analysis

`CLAUDE.md` contains only the injected 10xDevs toolkit lesson (between `<!-- BEGIN -->` and `<!-- END -->` markers). There are no project-specific conventions. Without them the agent risks:
- Writing a `tailwind.config.js` (v4 has no config file — this breaks the build)
- Calling OpenRouter directly from a React component (exposes the API key in the browser bundle)
- Omitting the `envField` declaration for `OPENROUTER_API_KEY` (variable is `undefined` in Cloudflare Workers at runtime)

### Key Discoveries:

- `CLAUDE.md:1-76` — entire file is the 10xDevs toolkit lesson block; project section goes above line 1
- `src/pages/auth/signin.astro:16` — only `client:load` usage confirmed; no `client:only` exists yet
- `src/pages/api/listings/create.ts:4-40` — canonical API route pattern: `APIRoute`, Supabase auth check, `context.redirect()` returns
- `astro.config.mjs:28-34` — `env.schema` block with `envField`; `OPENROUTER_API_KEY` not yet declared
- `src/styles/global.css:1,75,113` — `@import "tailwindcss"`, `@theme inline {}`, `@utility bg-cosmic {}` — the v4 pattern in use

## Desired End State

`CLAUDE.md` opens with an `## EstateDesk Coding Conventions` section (above the `<!-- BEGIN -->` marker) containing five numbered conventions. Any agent reading `CLAUDE.md` before touching S-01, S-02, or S-03 work will have the correct patterns for React islands, API routes, LLM routing, Tailwind v4, and env vars.

### Key Discoveries:

- The block is self-contained prose + code snippets; no other files change
- No test, build, or migration steps — success is verified by reading the file and checking type-check passes

## What We're NOT Doing

- Not modifying the 10xDevs toolkit lesson block (it is managed externally)
- Not adding OPENROUTER_API_KEY to `astro.config.mjs` — that belongs to S-02's plan
- Not creating any new source files, components, or routes
- Not adding conventions for topics beyond the five agreed: React islands, API route shape, LLM routing, Tailwind v4, Astro env schema

## Implementation Approach

Insert the conventions block as plain markdown above the `<!-- BEGIN @przeprogramowani/10x-cli -->` marker in `CLAUDE.md`. English prose, code fences for examples. Five numbered sections, each self-contained.

## Phase 1: Write EstateDesk Coding Conventions into CLAUDE.md

### Overview

Insert the `## EstateDesk Coding Conventions` section at the very top of `CLAUDE.md`, before the existing `<!-- BEGIN -->` marker.

### Changes Required:

#### 1. CLAUDE.md — prepend conventions block

**File**: `CLAUDE.md`

**Intent**: Add a project-specific conventions section that the agent reads first. The section must appear before the 10xDevs toolkit lesson so the project rules take precedence.

**Contract**: Insert the following block at line 1 (above the current `<!-- BEGIN @przeprogramowani/10x-cli -->` line). The existing content starting from `<!-- BEGIN -->` is preserved unchanged.

```markdown
## EstateDesk Coding Conventions

These conventions apply to all EstateDesk implementation work. Follow them exactly; they override generic framework defaults.

### 1. React Island Hydration

Use `client:load` for interactive React components that receive Astro props and benefit from SSR (e.g., forms with server-provided error messages). Use `client:only="react"` only when a component uses browser-only APIs (`localStorage`, `window`) and must not server-render. Do not use `client:visible` or `client:idle` — EstateDesk is SSR-first and these lazy strategies add complexity without benefit.

```astro
<!-- Preferred for most islands -->
<MyForm serverError={error} client:load />

<!-- Only when the component requires browser-only APIs -->
<BrowserOnlyWidget client:only="react" />
```

### 2. API Route Shape

All API routes live in `src/pages/api/`. Export a named HTTP-verb handler typed as `APIRoute`. Check Supabase auth at the top before any business logic. Return `context.redirect()` for form-style routes. Return `new Response(JSON.stringify(...))` only for fetch-style routes called by React islands.

```typescript
import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return context.redirect(`/page?error=${encodeURIComponent("Config error")}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return context.redirect("/auth/signin");

  const form = await context.request.formData();
  // ... business logic ...
  return context.redirect("/destination");
};
```

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

```typescript
// src/pages/api/format-address.ts  ← server-side, key is safe here
import { OPENROUTER_API_KEY } from "astro:env/server";

export const POST: APIRoute = async (context) => {
  const { raw } = await context.request.json();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ... }),
  });
  // ...
};
```

### 4. Tailwind CSS v4

This project uses Tailwind CSS v4. v4 has no `tailwind.config.js` and does not use the PostCSS plugin.

- **Do not create `tailwind.config.js`** — it will be ignored and may cause confusion.
- Theme tokens live in `src/styles/global.css` under `@theme inline { ... }`.
- Custom utilities use `@utility name { ... }` (e.g., `@utility bg-cosmic { ... }`).
- The global CSS starts with `@import "tailwindcss"` — this replaces the v3 `@tailwind base/components/utilities` directives.
- The Vite plugin is `tailwindcss()` from `@tailwindcss/vite` (already wired in `astro.config.mjs`).

```css
/* src/styles/global.css — add custom tokens here, not in a config file */
@theme inline {
  --color-brand: oklch(0.6 0.2 240);
}

@utility my-utility {
  background: var(--color-brand);
}
```

### 5. Astro Env Schema for New Secret Variables

Every new environment variable used in the app **must** be declared in `astro.config.mjs` under `env.schema` before it can be imported. Without the declaration the variable is `undefined` at runtime in Cloudflare Workers even if the secret is set.

```typescript
// astro.config.mjs — add to env.schema
OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
```

Then import it in server-side code:

```typescript
import { OPENROUTER_API_KEY } from "astro:env/server";
```

For public client-side variables use `context: "client", access: "public"` and import from `"astro:env/client"`.

---
```

### Success Criteria:

#### Automated Verification:

- TypeScript type-check passes: `npx astro check`
- No build errors: `npm run build`

#### Manual Verification:

- `CLAUDE.md` opens with `## EstateDesk Coding Conventions` above the `<!-- BEGIN @przeprogramowani/10x-cli -->` marker
- All five conventions are present and correctly formatted
- Code fences render correctly (no broken backtick blocks)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Manual Testing Steps:

1. Open `CLAUDE.md` and confirm `## EstateDesk Coding Conventions` is the first heading
2. Confirm the 10xDevs toolkit lesson block (starting with `<!-- BEGIN -->`) follows immediately after
3. Confirm all five conventions are present, correctly numbered, and have working code fences
4. Run `npx astro check` and `npm run build` — both must pass (this file change has no effect on compiled output, but serves as a regression guard)

## Performance Considerations

None — this is a documentation-only change with no runtime impact.

## Migration Notes

None — no data, schema, or code changes.

## References

- Roadmap entry: `context/foundation/roadmap.md` (F-01)
- Current CLAUDE.md: `CLAUDE.md:1-76`
- React island examples: `src/pages/auth/signin.astro:16`, `src/pages/auth/signup.astro:16`
- API route pattern: `src/pages/api/listings/create.ts:4-40`
- Env schema: `astro.config.mjs:28-34`
- Tailwind v4 usage: `src/styles/global.css:1,75,113`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Write EstateDesk Coding Conventions into CLAUDE.md

#### Automated

- [x] 1.1 TypeScript type-check passes: `npx astro check` — f8154bd
- [x] 1.2 No build errors: `npm run build` — f8154bd

#### Manual

- [x] 1.3 `CLAUDE.md` opens with `## EstateDesk Coding Conventions` above the `<!-- BEGIN -->` marker — f8154bd
- [x] 1.4 All five conventions are present and correctly formatted — f8154bd
- [x] 1.5 Code fences render correctly (no broken backtick blocks) — f8154bd
