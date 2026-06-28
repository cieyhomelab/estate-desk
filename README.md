# EstateDesk

![](./public/estatedesk.png)

A web application for a Polish real estate agent to manage the full lifecycle of property listings — owner onboarding, document collection, buyer/tenant contacts, price negotiations, commission calculations, and transaction close.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - PostgreSQL database, authentication, and file storage
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)
- [Docker](https://www.docker.com/) for running Supabase locally (~7 GB RAM)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

3. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

4. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run test` - Run unit tests
- `npm run test:watch` - Run unit tests in watch mode
- `npm run test:integration` - Run integration tests (requires Supabase)
- `npm run test:integration:api` - Run API integration tests (requires Supabase)
- `npm run test:e2e` - Run Playwright end-to-end tests
- `npm run test:e2e:headed` - Run E2E tests in headed mode
- `npm run test:e2e:ui` - Open Playwright UI

## Project Structure

```
.
├── src/
│   ├── components/           # UI components (Astro & React)
│   │   ├── auth/             # Sign-in / sign-up forms
│   │   ├── dashboard/        # Dashboard-specific components
│   │   ├── listings/         # Listing card component
│   │   └── ui/               # Shared UI primitives (shadcn/ui)
│   ├── integration/          # Integration test suites
│   │   ├── api/              # API-level integration tests
│   │   └── helpers/          # Shared test helpers (auth, Supabase client)
│   ├── layouts/              # Astro layouts
│   ├── lib/                  # Shared utilities (commission calc, Supabase client)
│   ├── pages/
│   │   ├── api/              # API endpoints
│   │   │   ├── auth/         # Sign-in, sign-up, sign-out
│   │   │   ├── listings/     # Listing CRUD, close/reopen, pricing, documents,
│   │   │   │                 # contacts, photos, files
│   │   │   └── settings/     # Commission rate configuration
│   │   ├── auth/             # Auth pages (sign-in, sign-up, confirm-email)
│   │   └── dashboard/        # Protected dashboard pages
│   │       ├── listings/     # Listing detail pages (edit, pricing, documents,
│   │       │   [id]/         # contacts, close)
│   │       ├── settings/     # Commission settings
│   │       └── …
│   ├── styles/               # Global CSS
│   └── types/                # TypeScript types (listings, contacts, documents, pricing, transaction)
├── e2e/                      # Playwright E2E tests
├── supabase/
│   └── migrations/           # Database schema migrations
├── public/                   # Public assets
└── wrangler.jsonc            # Cloudflare Workers config
```

## Architecture

### System Overview

```mermaid
graph TD
    Browser["Browser"]

    subgraph CF["Cloudflare Workers"]
        Astro["Astro SSR\n(server output)"]
        MW["Middleware\n(auth gate)"]
        Pages["Astro Pages\n(.astro)"]
        Islands["React Islands\n(client:load)"]
        API["API Routes\n(src/pages/api/)"]
    end

    subgraph Supabase["Supabase"]
        Auth["Auth"]
        DB["Postgres\n(RLS enabled)"]
        Storage["Storage\n(listing-photos · listing-documents)"]
    end

    OpenRouter["OpenRouter API\n(Gemini 2.5 Flash)"]
    Sentry["Sentry\n(error monitoring)"]

    Browser -->|HTTP request| MW
    MW -->|getUser| Auth
    MW --> Pages
    Pages --> Islands
    Pages --> API
    API -->|queries| DB
    API -->|upload/delete| Storage
    API -->|format address| OpenRouter
    Islands -->|fetch POST| API
    Sentry -.->|client errors| Browser
    Sentry -.->|server errors| Astro
```

### Database Schema (ERD)

```mermaid
erDiagram
    auth_users {
        uuid id PK
    }

    listings {
        uuid id PK
        uuid user_id FK
        text type "sale | occasional-rental"
        text status "active | done"
        text address
        text owner_name
        text owner_phone
        text owner_email
        numeric asking_price
        numeric commission_percent
        boolean checklist_override
        text notary_name
        text notary_city
        date transaction_date
        text transaction_notes
        timestamptz closed_at
        timestamptz created_at
        timestamptz updated_at
    }

    commission_settings {
        uuid id PK
        uuid user_id FK
        numeric tax_rate
        numeric agency_percent
        timestamptz created_at
        timestamptz updated_at
    }

    price_history {
        uuid id PK
        uuid listing_id FK
        numeric price
        timestamptz set_at
    }

    listing_documents {
        uuid id PK
        uuid listing_id FK
        uuid user_id FK
        text label
        boolean is_checked
        boolean is_default
        integer position
        timestamptz created_at
    }

    listing_files {
        uuid id PK
        uuid listing_id FK
        uuid user_id FK
        text file_name
        text storage_path
        timestamptz created_at
    }

    listing_photos {
        uuid id PK
        uuid listing_id FK
        uuid user_id FK
        text file_name
        text storage_path
        timestamptz created_at
    }

    contacts {
        uuid id PK
        uuid listing_id FK
        text name
        text phone
        text email
        text role "kupujący | najemca"
        timestamptz created_at
    }

    transaction_snapshots {
        uuid id PK
        uuid listing_id FK
        uuid user_id FK
        numeric asking_price
        numeric commission_percent
        numeric tax_rate
        numeric agency_percent
        numeric brutto
        numeric agency_amount
        numeric gross_income
        numeric tax_amount
        numeric agent_net
        text notary_name
        text notary_city
        date transaction_date
        timestamptz snapshot_at
        timestamptz voided_at
    }

    auth_users ||--o{ listings : "user_id"
    auth_users ||--o| commission_settings : "user_id"
    listings ||--o{ price_history : "listing_id"
    listings ||--o{ listing_documents : "listing_id"
    listings ||--o{ listing_files : "listing_id"
    listings ||--o{ listing_photos : "listing_id"
    listings ||--o{ contacts : "listing_id"
    listings ||--o{ transaction_snapshots : "listing_id"
```

### Page Routing & Auth Gates

```mermaid
flowchart TD
    Root["/"]
    SignIn["/auth/signin"]
    SignUp["/auth/signup"]
    Confirm["/auth/confirm-email"]
    Dashboard["/dashboard"]
    New["/dashboard/listings/new"]
    Edit["/dashboard/listings/id/edit"]
    Pricing["/dashboard/listings/id/pricing"]
    Docs["/dashboard/listings/id/documents"]
    Contacts["/dashboard/listings/id/contacts"]
    Close["/dashboard/listings/id/close"]
    Settings["/dashboard/settings/commission"]

    Gate{"Middleware\nauth check"}
    Redirect["/  (redirect)"]

    Root --> SignIn & SignUp
    SignIn & SignUp --> Confirm

    Gate -->|authenticated| Dashboard
    Gate -->|unauthenticated| Redirect

    Dashboard --> New & Settings
    Dashboard --> Edit & Pricing & Docs & Contacts & Close

    style Gate fill:#f5a623,color:#000
    style Redirect fill:#e74c3c,color:#fff
```

### API Routes

```mermaid
mindmap
  root((API Routes))
    Auth
      POST /api/auth/signin
      POST /api/auth/signup
      POST /api/auth/signout
    Listings
      POST /api/listings/create
      POST /api/listings/id/update
      POST /api/listings/id/delete
      POST /api/listings/id/close
      POST /api/listings/id/reopen
    Price
      POST /api/listings/id/price/set
    Commission
      POST /api/listings/id/commission/set
    Documents
      POST /api/listings/id/documents/add
      POST /api/listings/id/documents/override
      POST /api/listings/id/documents/docId/toggle
      POST /api/listings/id/documents/docId/delete
    Files
      POST /api/listings/id/files/upload
      POST /api/listings/id/files/fileId/delete
    Photos
      POST /api/listings/id/photos/upload
      POST /api/listings/id/photos/photoId/delete
    Contacts
      POST /api/listings/id/contacts/create
      POST /api/listings/id/contacts/contactId/delete
    Settings
      POST /api/settings/commission
    AI
      POST /api/format-address
```

### Transaction Close Flow

```mermaid
sequenceDiagram
    actor Agent
    participant Page as close.astro
    participant API as /api/listings/id/close
    participant DB as Supabase Postgres
    participant Calc as commission.ts

    Agent->>Page: Submit close form
    Page->>API: POST (notary, date, notes)
    API->>DB: getUser() — auth check
    API->>DB: SELECT listing (status, asking_price, commission_percent)
    API->>DB: COUNT unchecked listing_documents
    alt unchecked docs > 0 and no override
        API-->>Page: redirect ?error=brakujace-dokumenty
    end
    API->>DB: SELECT commission_settings (tax_rate, agency_percent)
    API->>Calc: calculateCommissionSplit(askingPrice, commissionPercent, agencyPercent, taxRate)
    Calc-->>API: brutto, agencyAmount, grossIncome, taxAmount, agentNet
    API->>DB: INSERT transaction_snapshots (unique active snapshot per listing)
    alt duplicate snapshot (race condition)
        API-->>Page: redirect ?error=juz-zamknieta
    end
    API->>DB: UPDATE listings SET status=done, closed_at=now()
    API-->>Page: redirect ?success=zamknieto
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication, database (PostgreSQL), and file storage. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### Required environment variables

| Variable                   | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `SUPABASE_URL`             | Project URL                                      |
| `SUPABASE_KEY`             | `anon` public key                                |
| `SUPABASE_SERVICE_ROLE_KEY`| Service role key (used by integration tests only)|

### First-time setup (local)

1. Create your environment file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project:

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from CLI output>
```

5. Apply database migrations:

```bash
npx supabase db push
```

6. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

### Using a cloud Supabase project

If you prefer a hosted project, add these variables to your `.env` and `.dev.vars` files using values from the Supabase dashboard → Settings → API, then run `npx supabase db push` to apply migrations.

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

### Auth routes

| Route                      | Description                                                             |
| -------------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`             | Email/password sign-in form                                             |
| `/auth/signup`             | Email/password sign-up form                                             |
| `/auth/confirm-email`      | Post-signup "check your inbox" page                                     |
| `/dashboard`               | Listings overview (redirects to `/auth/signin` if unauthenticated)      |
| `/dashboard/listings/new`  | Create a new listing                                                    |
| `/dashboard/listings/[id]` | Listing detail — edit, pricing, documents, contacts, close              |
| `/dashboard/settings/commission` | Configure commission split rates                                  |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/). The CI pipeline auto-deploys on every merge to `main` (see CI section below).

To deploy manually:

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

3. Set secrets in Cloudflare:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

## CI

GitHub Actions runs on every push and PR to `main`:

| Job | Runs | Triggers |
| --- | --- | --- |
| `ci` | lint → unit tests → integration tests → API integration tests → E2E tests → build | push + PR |
| `deploy` | build → `wrangler deploy` | push to `main` only |
| `migrate` | `supabase db push` | after successful deploy |

Configure the following repository secrets in GitHub:

| Secret | Used by |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_KEY` | Production build |
| `SUPABASE_URL_TEST` / `SUPABASE_ANON_KEY_TEST` / `SUPABASE_SERVICE_ROLE_KEY_TEST` | Tests in CI |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Wrangler deploy |
| `SUPABASE_PROJECT_REF` / `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` | Migration push |

## License

MIT
