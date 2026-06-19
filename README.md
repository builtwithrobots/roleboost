# [APPNAME]

> The multi-format candidate narrative platform. One link. Every version of you. Finally heard.

---

## What This Is

[APPNAME] is a two-sided SaaS platform that replaces the resume with a rich, shareable candidate profile. Job seekers upload their resume and context, receive an AI-engineered prompt to run through Google NotebookLM, and get back a suite of professional career assets -- audio narrative, video overview, slide deck, career infographic, and ATS resume. Those assets are hosted on a shareable profile page that opens as a pop-up modal for employers.

Employers get a candidate management dashboard where they can save candidates to a pool, attach them to job postings, move them through hiring stages, collaborate with their team, and send feedback directly to candidates.

**Built by:** Rob Ramos -- 20+ years of warehouse, fulfillment, and operations leadership from floor to VP.
**GitHub org:** `builtwithrobots`
**Stack:** Next.js, Clerk, Supabase, Paddle, Vercel, Tailwind

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | Latest |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | Latest |
| Auth | Clerk | Latest |
| Database | Supabase (PostgreSQL) | Latest |
| Storage | Supabase Storage | -- |
| Payments | Paddle | Latest |
| Hosting | Vercel | -- |
| Validation | Zod | Latest |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Clerk account and application
- A Supabase project
- A Paddle account (sandbox for development)
- A Vercel account under `builtwithrobots`

### Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Required variables:

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Paddle
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_CANDIDATE_BASIC_PRICE_ID=
PADDLE_CANDIDATE_PRO_PRICE_ID=
PADDLE_EMPLOYER_STARTER_PRICE_ID=
PADDLE_EMPLOYER_GROWTH_PRICE_ID=
PADDLE_EMPLOYER_SCALE_PRICE_ID=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase Setup

1. Create a new Supabase project
2. Enable Row Level Security on all tables (handled by migrations)
3. Configure Clerk as a third-party auth provider in Supabase:
   - Supabase Dashboard → Authentication → Sign In / Providers → Third-party Auth → Clerk
   - Set Domain to your Clerk Frontend API URL
4. Configure Clerk session token to include `role: authenticated`:
   - Clerk Dashboard → Configure → Sessions → Customize session token
   - Add: `{ "role": "authenticated" }`
5. Run migrations:

```bash
npx supabase db push
```

### Storage Buckets

Create these buckets in Supabase Storage (all private):

- `candidate-audio`
- `candidate-video`
- `candidate-documents`
- `candidate-images`

### Install and Run

```bash
npm install
npm run dev
```

---

## Project Structure

```
[appname]/
├── app/
│   ├── (auth)/                  # Clerk auth pages
│   ├── (candidate)/             # Candidate dashboard
│   │   └── dashboard/
│   │       ├── profile/         # Profile builder
│   │       ├── assets/          # Asset upload and management
│   │       ├── preview/         # Modal preview
│   │       ├── analytics/       # View and engagement data
│   │       └── feedback/        # Employer feedback inbox
│   ├── (employer)/              # Employer dashboard
│   │   └── dashboard/
│   │       ├── candidates/      # Saved candidate pool
│   │       ├── jobs/            # Job postings
│   │       ├── board/           # Candidate board with stages
│   │       └── team/            # Team member management
│   ├── c/[slug]/                # Public candidate profile (modal experience)
│   └── api/
│       ├── candidates/
│       ├── employers/
│       ├── assets/
│       ├── jobs/
│       ├── feedback/
│       └── webhooks/
│           └── paddle/          # Paddle webhook handler
├── lib/
│   ├── auth/                    # getUserContext(), AuthError
│   ├── supabase/                # server.ts, admin.ts, browser.ts
│   ├── storage/                 # Signed URL generation helpers
│   └── types/                   # Shared TypeScript types
├── components/
│   ├── modal/                   # Candidate profile pop-up modal
│   ├── candidate/               # Candidate UI components
│   ├── employer/                # Employer UI components
│   └── ui/                      # Shared primitives
├── supabase/
│   └── migrations/              # All database migrations
├── CLAUDE.md                    # Claude Code project memory
├── PRD.md                       # Full product requirements
└── vision.md                    # Product vision document
```

---

## Architecture Overview

### Two-Sided Platform

[APPNAME] serves two user types that interact through a shared asset layer.

```
Candidate                    Platform                    Employer
─────────────────────────────────────────────────────────────────
Upload resume + context  →   Store assets               
                             Generate shareable link  →  Click link
                                                         Modal opens
                             Track engagement         ←  Views profile
Receive feedback         ←   Deliver feedback         ←  Send feedback
                             Save to pool             ←  Save candidate
                             Attach to job posting    ←  Assign to role
```

### Auth Flow

Single sign-up. Role declared in onboarding. Diverges after first login.

```
Sign up (Clerk)
      ↓
Onboarding: "I am looking for my next role" | "I am hiring"
      ↓                                           ↓
Candidate dashboard                    Employer dashboard
/dashboard/profile                     /dashboard/candidates
```

### Public Profile URL

Every candidate gets a permanent, public URL:

```
[APPNAME].com/c/[slug]
```

This URL is shareable anywhere -- LinkedIn bio, email signature, job applications. When opened, it renders the candidate profile modal. No login required to view.

### Employer Candidate Board

Employers save candidates from shared links into their pool. Candidates are then optionally attached to a job posting and assigned a stage:

```
Saved → Screening → Interview → Offer → Passed
```

---

## Pricing

### Candidate Tiers

| Tier | Price | Included |
|---|---|---|
| Free | $0 | 1 asset, hosted profile, no analytics |
| Basic | $9/mo | All assets, hosted profile, view analytics |
| Pro | $19/mo | Everything + engagement analytics + feedback inbox |

### Employer Tiers

| Tier | Price | Included |
|---|---|---|
| Free | $0 | 5 saved candidates, 1 job posting |
| Starter | $49/mo | 50 saved candidates, 5 job postings |
| Growth | $99/mo | Unlimited candidates, unlimited postings, team collaboration |
| Scale | $249/mo | Everything + priority support + API access |

---

## Key Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript check
npx supabase db push # Push migrations to Supabase
```

---

## Deployment

Vercel auto-deploys:
- `main` branch → production
- All other branches → preview URLs

GitHub org: `builtwithrobots`
Vercel account: `builtwithrobots`

---

## Related Documents

- `CLAUDE.md` -- Claude Code rules, patterns, and architectural decisions
- `PRD.md` -- Full product requirements and feature specs
- `vision.md` -- Product vision, market positioning, and go-to-market strategy
