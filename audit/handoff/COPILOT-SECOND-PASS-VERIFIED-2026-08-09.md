# COPILOT — Second verified pass: corrections + evidence + scientific recommendations → Codex

**Date:** 2026-08-09 · **Author:** GitHub Copilot · **Branch:** `copilot/full-audit-primary-agent-report` (docs/test-only, 0 production-code changes)
**Target:** `main @ 36766cf` · **Method:** every claim below was re-verified against the live repo / CI logs / git history / external sources. Corrections are marked ⟳.

---

## 1) Corrections to my own earlier report (stated first — none hidden)

| ⟳ | Earlier claim | Corrected truth (evidence) |
|---|---|---|
| ⟳1 | "EAS slug conflict (`banco-mobile` vs `bancoboom`)" | **Not verifiable from `app.json`** — the file has **no `expo.slug` and no `expo.owner` conflict written**: `owner: "waelzaid"`, `extra.eas.projectId: 45f092c8-…`, no `slug` key at all ([app.json L150-L158](https://github.com/waelzaid66-max/bancoboomstor/blob/main/artifacts/banco-mobile/app.json#L150-L158)). The conflict claim rests on a `bancotoday` repo I cannot read. → **UNKNOWN until expo.dev is queried by the owner.** Do not act on my earlier wording. |
| ⟳2 | "render-coverage-guard is the only file absent from main on headers-dynamic-polish" | Codex already verified this exact point with git diffs (Issue #9, comment 20:48). My recovery commit `2934e3d` is the *only* new artifact — adapted to node:test, not jest. No other recovery claim stands. |
| ⟳3 | "Section mini-apps = 5" | The Stack registers **6** (`section/car, real-estate, factories, materials, booking, maps`) — 5 catalogue shells + the maps portal ([_layout.tsx L179-L201](https://github.com/waelzaid66-max/bancoboomstor/blob/main/artifacts/banco-mobile/app/_layout.tsx#L179-L201)). |

## 2) Confirmed unchanged (re-verified, still true)

- `main` red: lockfile drift + duplicate `sectionAccentAlpha`. PR #8 @ `601fdb2` green 13/13. **Gate:** merge PR #8 before any other work.
- `docker-compose.coolify.yml` L4/L10 still directs builds at `banco-with-wael`. (C-2 stands.)
- `listConversations` unbounded (no LIMIT/cursor). (M-1 stands.)
- Profile own-listings grid not virtualized (`posts.map` inside the screen ScrollView). (M-2 stands.)
- `t()` returns the key on a missing string; language never reaches the server (TODO at LanguageContext L92). (M-4, M-5 stand.)
- `retired-red-guard` green but unwired. (M-3 stands.)
- `eas.json submit.production.ios` empty strings. (M-7 stands.)
- `REPLACE_*` well-known templates on main; the renderer exists; the gap is operational (pass build args in Coolify). (M-6 stands.)

## 3) The state gate — why nothing else moves first

Every runtime/visual claim about "the current full version" is **blocked** by the install/typecheck break. This is a material precondition, not a preference:

```
fresh clone of main → pnpm install --frozen-lockfile → ERR_PNPM_OUTDATED_LOCKFILE → (fixed on PR #8)
                 tsc → TS2323/TS2393 → (fixed on PR #8)
```

Until PR #8 merges: no EAS build, no device QA, no Coolify deploy validation can honestly claim "current". All my UNKNOWNs stay UNKNOWN until then.

## 4) Scientific recommendations (principle → minimal action → verification)

| Area | Principle | Minimal action (no redesign) | Proof it worked |
|---|---|---|---|
| **M-1 unbounded inbox** | Bound every list at the data layer, not the UI | Add keyset pagination to `listConversations` on `(lastMessageAt, id)` — the exact same contract `getMessages` already implements in the same file; cap page size; return `meta.has_next/cursor` | api-server test: a 2-page inbox returns page 2 via cursor and never duplicates a row |
| **M-2 profile grid** | Virtualize any list that grows | Move the own-listings grid to a `FlashList` (already a dep) with `numColumns=2` — replaces `posts.map` inside ScrollView; keep the existing `useInfiniteQuery` + "load more" | render budget: a 200-listing seller mounts only on-screen tiles (windowSize/maxToRenderPerBatch) |
| **M-4 silent i18n** | A missing string must fail loudly in dev and visibly in prod telemetry, never silently | Keep the current fallback (resilience), but add a dev-only `console.warn` + a counter hook so missing keys are observable; do NOT throw in prod | `i18n-usage.test.mjs` already asserts usage — extend it to flag keys that resolve to themselves |
| **M-5 language → server** | One user preference, one write path | Add `language` to `UpdateMeSchema` in `lib/api-spec/openapi.yaml` → re-run orval → call `updateMe({ language })` inside `setLang` (the TODO's own plan) | codegen diff shows `language`; `updateMe` type-checks; an email to an `en` user renders the English template |
| **M-3 unwired guard** | A green check that isn't wired prevents nothing | Add `test:retired-red` to the mobile `test` chain (it is green today — zero-risk restore) | CI mobile-regression runs it and stays green |
| **C-4 coverage hole** | Tests written because of real user-visible bugs must run | Convert `tests/render/*` to `node:test` + `react-test-renderer`, add `test:render` to the chain; `render-coverage-guard` (recovered in `2934e3d`) then enforces it stays wired | the recovered guard passes only when the suite is chained and mounting |
| **C-2 poisoned compose** | Deploy docs are safety rails, not decoration | Correct the SoT lines in `docker-compose.coolify.yml` + `DEPLOYMENT_SOURCE_OF_TRUTH.md` + `README.md` + `DUAL_REPO_STATUS.md` to `bancoboomstor` | a fresh agent reading them deploys the canonical repo |
| **M-6 well-known placeholders** | Templates never ship as 200-valid-looking failures | Set `APPLE_TEAM_ID` + `PLAY_APP_SIGNING_SHA256` (+ `WELL_KNOWN_STRICT=1`) as Coolify build vars on the `web` resource | `node scripts/ops-live-cutover-check.mjs` fails while any `REPLACE_` is live |
| **M-7 iOS submit** | Empty strings are invalid, not absent | Fill or delete `submit.production.ios.{appleId,ascAppId,appleTeamId}` | `eas submit -p ios` prompts instead of failing |

## 5) What I did NOT change (anti-conflict, per protocol)

- `tests/render/*`, `package.json`, `tsconfig.json` — the render-tests fate is Codex's explicit decision.
- `docker-compose.coolify.yml`, docs — the SoT correction is a one-word-truth change I prepared but did not land (it's a deploy-safety gate; Codex/owner merge PR #8 first).
- `eas.json`, `app.json` — store identity is irreversible; owner-confirm first.
- No pushes to `main`, no touches to Claude/Cursor/Codex branches.

## 6) Honest UNKNOWNs (unchanged, still not provable by me)

No local run of pnpm/tsc/tests (my green = CI evidence, which is authoritative). No live runtime: Coolify deploy state, Replit runtime, EAS build output, device behaviour, Clerk dashboard, Paymob, Resend. expo.dev slug/owner state (⟳1). Device-level visual verification of any screen.

## 7) What exists on my isolated branch (for Codex to pull, not for me to merge)

- `ff6638b` — full inventory + handoff (wave 1).
- `2934e3d` — `tests/render-coverage-guard.test.mjs` recovered + adapted (node:test runner, `createElement` accepted, `icons.tsx` added to the critical set). **Intentionally red until C-4 is decided.**

— Copilot. Codex: assign me a queue item and I execute on a dedicated branch with per-step evidence.
