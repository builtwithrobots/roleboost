# 09, Employer Side

The employer dashboard is a candidate-management surface scoped to a hiring
organization. Everything is **multi-tenant by `employer_account_id`** and enforced
by RLS membership policies (see [02, Data Model](./02-data-model.md)).

## Multi-tenancy

- `employer_accounts`, one row per organization.
- `employer_members`, users in an account, each `owner` or `member` (unique per
  account+user). The `users.role` is `employer`; the owner/member distinction lives
  here.
- Every employer-scoped table (`job_postings`, `saved_candidates`, `feedback`)
  isolates via the membership pattern: a row is visible only if its
  `employer_account_id` is one the requester is a member of. First-time employers
  get an account auto-created on dashboard load.

## Dashboard surfaces (`app/(employer)/dashboard/`)

| Route | Purpose | Notes |
|---|---|---|
| `candidates/` | The saved pool as a grid | Joins `saved_candidates` → `candidate_profiles`; shows which asset types each candidate has |
| `board/` | Pipeline by stage | Five stages: `saved → screening → interview → offer → passed`. Stage set via dropdown (MVP, **no** drag-and-drop) |
| `jobs/` | Job postings + candidate counts | Counts `saved_candidates` per posting |
| `team/` | Team members | Owner/member management (placeholder/coming-soon) |

## Mutations

- `dashboard/jobs/actions.ts`, `createJobPosting`, `archiveJobPosting`. Resolve
  employer context, verify account membership, write, revalidate.
- `dashboard/board/actions.ts`, `updateCandidateStage`, `updateCandidateNotes`.
  These use the **RLS client** from `getUserContext('employer')`; RLS enforces the
  `employer_account_id` match (the preferred pattern, prefer the RLS client over
  the admin client for employer writes).

Components: `components/employer/CandidateBoard.tsx` (client board with optimistic
stage updates), `CandidateGrid.tsx`, `JobsTable.tsx`.

## Feedback loop

`feedback` rows are employer → candidate messages. RLS lets the employer team
write/read feedback from their account, and lets the **candidate** read feedback on
their own profile and mark it read (`feedback_candidate_read` /
`feedback_candidate_update`). The candidate views these under
`/dashboard/feedback`.

## How employers connect to the brain

Employers don't browse a directory, they discover candidates via shared
`/c/[slug]` links and **save** them into the pool. When a logged-in employer chats
with a candidate's AI, the `chat_session` records `employer_account_id` and
`employer_company_name`, which is what powers the employer-side transcript email
and lets the employer team read those sessions. See
[07, Chat & Transcripts](./07-chat-and-transcripts.md).
