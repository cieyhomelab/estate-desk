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
