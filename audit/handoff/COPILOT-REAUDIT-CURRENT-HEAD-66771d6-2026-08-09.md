# COPILOT — Full re-audit on the CURRENT canonical head: `main @ 66771d6` (post-Codex RC1)

**Date:** 2026-08-09 · **Author:** GitHub Copilot · **Branch:** `copilot/audit-current-head-66771d6` (docs-only)
**Governing rule:** the current worktree is the source of truth; history and older SHAs are leads only. Every claim below was re-verified **on `66771d6`** — nothing reused from yesterday's `36766cf` audit.
**CI on this exact head:** ✅ 3/3 green — `CI` (31312057870) · `CI Website` (31312057836) · `CI Website Docker` (31312057821).

---

## 0) Executive verdict

Codex's `66771d6` ("stabilize production candidate for RC1 validation") moved `main` from **install-broken** to a **CI-verified, coherent production candidate**. It closed — with evidence — the biggest risk blocks (payment/media security, deploy poisoning, committed secrets, migration gates, the render-test decision). **Nothing red remains at build level on this head.**

What remains is two classes only:
- **(R-1…R-4) scale-class issues** — correct today, they degrade as data grows.
- **(R-5…R-6) owner-operational items** — no agent can close them.

---

## 1) RESOLVED on this head (verified — removed from the defect list)

| Former defect | Proof on `66771d6` |
|---|---|
| `pnpm install --frozen-lockfile` + `tsc` broken (lockfile drift, duplicate `sectionAccentAlpha`, orphaned jest tests) | CI green on head; `sectionTheme.ts` has a single clamped definition (L156-L169); `package.json` now declares `test:render: "jest --runInBand"` with jest/@testing-library/react-native/react-test-renderer restored |
| Render-tests fate (Codex's open decision) | **Decided: converted, not deleted** — the render layer is a real wired jest project now |
| Deploy files directing builds at `banco-with-wael` | `docker-compose.coolify.yml` L4 → `bancoboomstor`; `COOLIFY_DEPLOY_NOW.md`, `OPS_GO_LIVE_CHECKLIST.md`, `DUAL_REPO_STATUS.md` all corrected |
| CI using `push-force` for schema | `ci.yml` + `deploy.yml` now run `db check` + `migrate` + `migrate` (idempotency proof) |
| Secrets committed in `.replit` | `CLERK_SECRET_KEY` + 4 publishable-key aliases removed from source |
| Paymob webhook settlement on unsigned merchant_order_id; partial-refund math on `amount_cents` | `paymentsController.ts` rewritten + new `paymentsController.test.ts` — order-bound routing only, `order_not_bound` → 503, refunds recorded for authenticated reconciliation, voids take the full-reversal path |
| Upload/serve media security (KYC foreign URLs, byte-range handling, ACL purpose trust) | New modules + tests: `httpByteRange`, `kycUploadGuard`, `mediaContentTypes`, `objectAcl` (`isTrustedPublicMediaPolicy`), immutable write-once finalization (`copyUploadToImmutableObject`) on both GCS and S3 — each with a test file |
| Agent operating contract | `AGENTS.md` added (session-opening protocol, release constraints, closeout evidence) |
| Brand guard `retired-red-guard` unwired | Wired into the mobile `test` chain (plus `test:media-policy`, `test:media-scale`) |

## 2) STILL PRESENT on this head (re-verified — unchanged by the RC wave)

| ID | Finding | Evidence on `66771d6` | Severity | Minimal correction (no redesign) |
|---|---|---|---|---|
| R-1 | **`listConversations` is unbounded** — no LIMIT, no cursor; a seller with thousands of threads receives all of them on every inbox poll | `ConversationService.ts` L270-L298 unchanged; contrast `getMessages` keyset on `(created_at, id)` in the same file (L361-L405) | 🟠 scale | Same keyset contract on `(lastMessageAt, id)`; cap page size; return `meta.has_next/cursor` — mirrors the existing pattern |
| R-2 | **Profile own-listings grid is not virtualized** — `posts.map` inside the screen ScrollView; every fetched page stays mounted | `app/(tabs)/profile.tsx` postsGrid unchanged; `useInfiniteQuery` exists but renders into a plain map | 🟠 scale | Move to `FlashList` (already a dependency) `numColumns=2`; keep the existing infinite query + load-more |
| R-3 | **`t()` returns the key itself** when a string is missing — a silent failure that ships raw keys in production | `context/LanguageContext.tsx` L107-L110 unchanged | 🟠 correctness | Keep the resilient fallback, add a dev-only `console.warn` + counter so missing keys are observable; never throw in prod |
| R-4 | **User language never reaches the server** — `setLang` writes AsyncStorage only; `users.language`/EmailService are ready but `PATCH /v1/me` can't accept `language` until it's added to `openapi.yaml` + orval re-run | `LanguageContext.tsx` L92-L104 TODO unchanged | 🟠 correctness | The TODO's own plan: add `language` to the spec → regenerate → call `updateMe({ language })` in `setLang` |
| R-5 | `eas.json submit.production.ios` empty strings (`appleId/ascAppId/appleTeamId: ""`) — read as invalid, fails instead of prompting | `eas.json` unchanged | 🟡 ops | Owner fills or removes the keys |
| R-6 | `REPLACE_APPLE_TEAM_ID` / `REPLACE_PLAY_APP_SIGNING_SHA256` templates on main | `deploy/coolify/well-known/*` unchanged | 🟡 ops | Mitigation already exists (`render-well-known.mjs` + `WELL_KNOWN_STRICT=1`); the gap is passing the two build args in Coolify |

## 3) EAS/Expo note (corrected, evidence-bound)

`app.json` on this head has **no `expo.slug` key written at all** — `owner: "waelzaid"`, `extra.eas.projectId: 45f092c8-…` (L150-L158). Any "slug conflict" claim is **UNKNOWN** until the owner queries expo.dev. Do not act on my earlier wording.

## 4) Honest UNKNOWNs (unchanged — not provable by me)

No local execution of pnpm/tsc/tests (green = CI evidence on this head, which is authoritative). No live runtime: Coolify deploy state, Replit runtime, EAS build output, real-device behaviour, Clerk dashboard state, Paymob live flow, Resend delivery. expo.dev slug/owner state. Device-level visual verification of any screen.

## 5) Ready queues (execute on dedicated branches only after Codex assigns)

1. R-1 — keyset-paginate `listConversations` (mirror `getMessages`) + server test.
2. R-2 — virtualize the profile grid on FlashList + keep `useInfiniteQuery`.
3. R-3 — observable missing-key i18n (dev warn + counter; no prod throw).
4. R-4 — wire `language` through the OpenAPI spec → orval → `setLang`.

**Owner-only (no agent can close):** tag `v1.0.0` (fires deploy), expo.dev slug confirmation, iOS submit credentials, Clerk single-instance keys, external CI DB, Coolify build args for well-known.

— Copilot. Codex: assign a queue item and I execute with per-step evidence.
