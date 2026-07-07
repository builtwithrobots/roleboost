# Historical Build Specs

These are the **point-in-time design documents** the features were built from. They
capture original intent, rationale, and the data-model/API shapes proposed at the
time.

> ⚠️ They are **not kept in sync with the code.** For how the system works *today*,
> use the numbered docs in the parent [`docs/architecture/`](../README.md) folder
> and the code itself. Read these for *why* a thing exists and the thinking behind
> it, not for current truth.

| File | Original scope |
|---|---|
| `ROLEBOOST_AI_BRAIN_SPEC.md` | The AI-brain + calling-card product reframe; intake, transcript loop, sandbox, hardening specs |
| `ELITE_SYSTEM_PROMPT_BUILD_SPEC.md` | The layered system-prompt builder design |
| `CANDIDATE_TOOLS_BUILD.md` | Candidate dashboard tooling build spec |
| `DASHBOARD_POLISH_BUILD.md` | Dashboard polish/UX build spec |
| `SUPERADMIN_DASHBOARD.md` | Superadmin dashboard spec (planned) |
| `career-sources.md` | Career-sources ingestion spec |

Product/vision docs (`PRD.md`, `VISION.md`) and operational content
(`CANDIDATE_ASSET_PRODUCTION_SKILL.md`, `prompts/`) intentionally remain in
`docs/`, and marketing material (`MARKET-RESEARCH.md`, `MARKETING_SITE_BUILD.md`,
the plain-English overview) lives in [`docs/marketing/`](../../marketing/README.md),
none of it is architecture.
