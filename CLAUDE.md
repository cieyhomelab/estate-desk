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
    body: JSON.stringify({ /* prompt */ }),
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

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 2

Pick a starter and a stack for the PRD you wrote in Lesson 1, with the **stack chain**:

```
(/10x-init  →  /10x-shape  →  /10x-prd)  →  /10x-tech-stack-selector  →  (bootstrapper)
```

The PRD chain ships from Lesson 1 (re-included in this lesson so you can fix the PRD mid-flight). `/10x-tech-stack-selector` is the lesson's main topic; `/10x-bootstrapper` is the next link, taught in Lesson 3.

### Task Router — Where to start

| Skill | Use it when |
| --- | --- |
| **Stack selection (lesson focus)** | |
| `/10x-tech-stack-selector` | You have a PRD at `context/foundation/prd.md` and need to pick a starter. Opens with an explicit choice (take the recommended default for your `(product_type, language_family)` cell, or design your own), walks the follow-up question set when you design your own, applies four agent-friendly quality gates, reasons over the language-aware starter registry, and writes `context/foundation/tech-stack.md`. Optional `[path-to-prd]` argument lets you point at a non-default PRD location (e.g., `/10x-tech-stack-selector @context/foundation/prd-v2.md`); without it the skill defaults to `context/foundation/prd.md`. Use AFTER `/10x-prd`, BEFORE `/10x-bootstrapper`. |
| **Re-run upstream if needed** | |
| `/10x-init` / `/10x-shape` / `/10x-prd` | Bundled so you can fix the PRD mid-flight. If `/10x-tech-stack-selector` surfaces a gap (e.g., a Functional Requirement that forces a feature your recommended starter doesn't carry), re-run `/10x-prd` to amend the PRD before the stack pick. |

### How the chain hands off

- `/10x-tech-stack-selector` reads `context/foundation/prd.md` frontmatter (`product_type`, `target_scale`, `timeline_budget`) as priors. If the PRD is absent, it refuses with a one-sentence redirect to `/10x-shape` — no inline mini-PRD fallback.
- The skill writes `context/foundation/tech-stack.md` with a 4-key frontmatter (`starter_id`, `package_manager`, `project_name`, `hints`) plus a one-paragraph `## Why this stack` body. The hand-off is intentionally minimal — bootstrapper does not parse rationale, only fields.
- `/10x-bootstrapper` (Lesson 3) reads `tech-stack.md` and the registry to scaffold the project.

### What tech-stack-selector captures (and what it does NOT)

- **Captured**: starter pick (registry-shaped), language family, package manager (open string per ecosystem — `pnpm`, `uv`, `bundle`, `cargo`, etc.), team size, deployment target (drawn from the chosen starter's `deployment_defaults`), CI/CD provider + flow, bootstrapper confidence (`verified | first-class | best-effort`), path taken (standard | custom), self-check answers (custom path), quality override (set when the user proceeds with a starter that failed ≥1 agent-friendly gate), feature flags (auth/payments/realtime/AI/background-jobs).
- **NOT captured (deliberate)**: strategic test plan, strategic deployment plan, strategic implementation decisions. Those are downstream of stack selection — a future technical-roadmap concern, not yet planned. Tech-stack-selector owns *framework-shaped* test/deploy/CI choices because those are inseparable from stack pick; what defers is the *strategic* layer ("we TDD on X surface", "preview environment per PR").

### The opening choice (load-bearing)

The first question is an explicit choice — never silent. The skill names the recommended starter for your `(product_type, language_family)` cell up front and asks for explicit confirmation:

- **Standard path** — accept the recommended default. The skill skips the feature audit, team profile, tech preferences, and framework-variant questions; it asks only the deployment, CI/CD, and project-name questions. The hand-off records `path_taken: standard` under `hints`.
- **Custom path** — design your own. The skill walks the full follow-up set (feature audit, team profile, tech preferences, deployment, CI/CD, framework variant), drills into a testing-runner question only when the chosen starter leaves it ambiguous, and closes with a 5-point readiness self-check (from prework lesson 4.1) before locking in. The hand-off records `path_taken: custom` and populates `self_check_answers`.

The recommended-default-per-cell map is multi-language: web/JS and saas/JS both → 10x-astro-starter (the 10x-branded starter leads whenever it competes in a JS cell); api/JS → hono; api/Python → fastapi; web/Python → django; web/Ruby → rails; api/Go → go; api/Rust → axum; mobile/Dart → flutter; desktop/Rust → tauri; etc. Cells with no vetted default carry `<none>` and force the custom path.

### Quality gates (agent-friendly criteria)

Every starter card carries four booleans the LLM filters against:

1. **Typed** — explicit types/schemas the agent can reason from without running the program.
2. **Convention-based** — strong opinions on layout, routing, configuration.
3. **Popular in training data** — assessed *per language family*, not globally (Django is popular within Python training data; Spring within Java; etc.).
4. **Well-documented** — current, version-pinned, link-able docs.

Candidates failing any gate are excluded from the unprompted recommendation set. If you explicitly name a failing starter as your preference, the skill challenges that pick — surfacing the strongest higher-criteria alternative AND the compensation path (CLAUDE.md instructions that patch the gaps) — and asks you to confirm or pivot. Confirming the known-friction pick records the override on the hand-off so bootstrapper can adjust.

### Bootstrapper confidence

Every recommendation surfaces `bootstrapper_confidence` verbatim — never silently elided:

- **`verified`** — bootstrapper has been run end-to-end on this stack; scaffolding will be smooth.
- **`first-class`** — registered with a valid CLI, expected to work but not battle-tested; expect mostly-smooth scaffolding with occasional manual steps.
- **`best-effort`** — limited support; manual steps likely; expect friction (and bootstrapper's CLAUDE.md generation compensates with extra ecosystem-specific context).

This is the heads-up before running `/10x-bootstrapper` so you know what to expect.

### Foundation paths used by this lesson

- `context/foundation/prd.md` — input (from Lesson 1)
- `context/foundation/tech-stack.md` — output (the chain hand-off)
- `context/foundation/lessons.md` — recurring rules & pitfalls
- `docs/reference/contract-surfaces.md` — load-bearing names registry

### Universal language

The shipped skill carries no 10xDevs / cohort / certification references. The recommended-default registry is multi-language (JS, Python, Ruby, Java, Go, Rust, PHP, .NET, Dart) and the cohort's `10x-astro-starter` is one card in the JS+web cell — not "the" recommended path for everyone.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
