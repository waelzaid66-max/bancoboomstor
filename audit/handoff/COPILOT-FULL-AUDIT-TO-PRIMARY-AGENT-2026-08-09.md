# COPILOT — Full Inventory + Precise Handoff to the Primary Agent (Codex)

**Date:** 2026-08-09 (UTC) · **Author:** GitHub Copilot (assistant agent) · **Branch:** `copilot/full-audit-primary-agent-report` (docs-only, 0 code changes)
**Canonical repo:** `waelzaid66-max/bancoboomstor` · **main:** `36766cf` (v4.1.4)
**Method:** direct evidence only — GitHub API reads of the live repo, CI job logs, git history, package manifests, route/service trees, existing audit corpus in `audit/handoff/`, plus a fresh external compatibility scan. Nothing below is assumed from memory.

---

## 0) What this file is for

Direct, live handoff to the **Primary Agent (Codex)**. I audited the current system end-to-end, reconciled it with the full prior audit corpus, verified current failures against CI evidence, and organized everything into task queues Codex can dispatch. **I will not touch `main` and I will not touch any branch you own.** My workstream is separate; Codex directs my tasks.

**How to use this:** each section is (a) verified facts, (b) open problems with IDs + severity + evidence, (c) a task queue. Items marked `UNKNOWN` have no evidence available to me and must not be guessed.

---

## 1) Ground truth — repository & system (verified)

- **Monorepo:** pnpm 11.9 workspace. `packages: artifacts/*, lib/*, lib/integrations/*, scripts`. Node 24. TypeScript ~5.9.3. ESLint 9.
- **Artifacts (8):** `api-server` (Express+Drizzle), `banco-mobile` (Expo SDK 54), `banco-web` + `banco-website` (Next 15), `admin-os` + `dealer-os` + `landing` (Vite/React), `mockup-sandbox`.
- **Libs (8):** `db` (Drizzle/Postgres), `api-spec` (OpenAPI), `api-zod`, `api-client-react` (orval-generated; **codegen chain is load-bearing**), `search-contract`, `taxonomy`, `design-tokens`, `integrations-openai-ai-server`.
- **CI (`.github/workflows/ci.yml`) — 6 jobs:** typecheck+build · API tests vs real Postgres 16 (pg_trgm, seeded) · ESLint · GCP config gate · mobile static regression (full pack) · mobile bundle (`expo export -p web`) · production gates (chain-integrity + production-confidence).
- **CD (`deploy.yml`):** tag-triggered (`v*.*.*`) AWS ECR/SSM path. **Zero tags exist** → auto-deploy cannot fire today (owner decision).
- **Deploy configs present:** root `Dockerfile` (API, EB/GCP-compatible, non-root, healthcheck `/api/healthz`), `docker-compose.{prod,coolify,test}.yml`, `deploy/{aws,coolify,gcp,cloudflare}`, `cloudbuild.yaml`, `.replit`, `wrangler.toml`, `.ebextensions`.
- **Migrations:** `0000` (baseline, 71 tables) → `0004_fi_workspace_lifecycle`. Boot-time safety net `ensureSchemaPatches()` is a **second schema authority** — guarded to stay a subset of the schema enum (proven by tests).
- **Mobile auth:** Clerk. Provider tree `_layout.tsx`: `ErrorBoundary → ClerkProvider → ClerkLoadGate(2.5s timeout) → QueryClientProvider → AuthTokenBridge → ReactQueryFocusBridge → Theme/Language/AuthGate/Session/Biometric/Sound → PushNotificationsBridge`. Sign-in/up are redirects to `/(tabs)/profile?authMode=…` (single 900-line flow, not duplicated).
- **Messaging:** `ConversationService` + `messages/[id].tsx`. **Poll-only by contract (G47 — no WebSocket):** thread `refetchInterval: 3000`, inbox `isFocused ? 8000 : false`, tab badge owns background cadence. Optimistic send with tempId + retry, structured offer messages (`💰 عرض سعر · Offer: `), reactions allowlist, presence opt-out unbreakable (away ≡ unknown pixels).
- **Section mini-apps (5 registered in `_layout.tsx`):** `section/car`, `section/real-estate`, `section/factories`, `section/materials`, `section/booking` (+ `section/maps`). Each is a pinned-header shell over `SectionSearchApp` / `BookingStaysApp` with hard-locked category+engine (anti-"melt"). Discover cards `router.push` them (restored after the in-place-filter melt regression).
- **Background jobs:** `archiveListings`, `backfillStaffRoles`, `dealerPerformance`, `subscriptionExpiry`, `subscriptionExpiringReminders`, `weeklyReports` (+ `jobs/index.ts` scheduler).
- **API surface (`routes/v1`):** me, listings, search, conversations, notifications, saves, sellers, feed, stories, bookings, financing, companies, dealer, rfqs, import-orders, investments, leads, global-supply, wallet, billing, subscriptions, payments, ads, uploads, admin, reports, support, reference, users, market.
- **Services (api-server/src/services):** ~35 services incl. ListingService (57.9k), FinancingService (46k), SearchService (43.6k), NormalizationService (39k), SubscriptionService (36.7k), AdminService (36k), PaymentIntentService (28k), EmailService (28k), LeadService (27k), ConversationService (26.6k), PromoAdCreditService (25.7k), AbuseService (25k), CompanyService (22.6k), UserService (21k), BookingService, WalletService, PushService, etc. — most with dedicated test files.
- **Mobile identity:** name `BANCO`, scheme `bancooom`, package `com.bancooom.app` (iOS+Android). Associated domains: banco.today/.deals/.autos.
- **EAS:** `eas.json` — node 24.18, production = `app-bundle` + `autoIncrement` (both platforms), submit track internal. `app.config.ts` **hard-fails EAS builds** if link origin is unset or replit.com (correct guard).

---

## 2) Critical findings — current, evidence-backed

### F1 · main CI is RED (PR #8 fixes it — awaiting merge decision)
- **Evidence:** every CI run on `main` since 2026-08-07 failed. Two stacked causes, both pre-existing:
  1. `ERR_PNPM_OUTDATED_LOCKFILE` — 5 jest deps removed from `banco-mobile/package.json` without regenerating `pnpm-lock.yaml` → `pnpm install --frozen-lockfile` fails on every job (run 31273579478 log).
  2. Mobile typecheck errors (run 31273798665 log): `sectionAccentAlpha` **declared twice** in `lib/sectionTheme.ts` (TS2323+TS2393 — landed via a clean merge, no markers) + orphaned `tests/render/*.render.test.tsx` referencing removed `@testing-library/react-native`/jest globals (~100 errors).
- **Fix exists:** [PR #8](https://github.com/waelzaid66-max/bancoboomstor/pull/8) (`claude/qa-audit-fixes` @ `601fdb2`) — **CI 13/13 green** (verified: runs 31274005179/…5177/…5174 success). I confirmed on `main` that only the single clamped `sectionAccentAlpha` definition remains at ~L180, and PR #8 removes the duplicate + regenerates the lockfile + registers 4 missing icons + blockLists Replit's transient Metro dirs + excludes the orphaned jest render tests from typecheck (not deleted).
- **Open decision (owner):** merge PR #8.

### F2 · Deploy path is dead until a tag exists
- `git tag` = 0; `deploy.yml` fires only on `push: tags: v*.*.*`. `package.json` version `0.0.0`.
- **Owner decision:** tag `v1.0.0` (fires production) or use `workflow_dispatch` manually.

### F3 · Source-of-truth docs are poisoned (safety hazard, not cosmetic)
- `docs/DEPLOYMENT_SOURCE_OF_TRUTH.md` still names `banco-with-wael` as the ONLY deploy SoT repo; `README.md` + `DUAL_REPO_STATUS.md` agree. A fresh agent reading them deploys the wrong repository. **Recommendation: correct, not delete.**

### F4 · Stranded production work on unmerged branches
- `claude/headers-dynamic-polish` (4 commits not in main): `deploy/coolify/well-known/render-well-known.mjs` (renders+validates AASA/assetlinks from build args — prevents shipping silent `REPLACE_` placeholders that break universal links), `scripts/chain-integrity-gate.mjs`, `production-confidence-check.mjs` updates, a render-layer test. **Decision: merge after review.**

### F5 · Historical consolidation is content-complete (verified)
- Migration `89d28d3` (2026-08-01) was a **content snapshot, zero shared git ancestry** with `banco-with-wael` (tag `w.4.1`) / `bancoo`. Only 2 files absent from each original: `sync-aws-virgen.yml`, `sync-bancooom.yml` (automation for dead repos — correctly not carried). Both originals' last features present: EAS (`autoIncrement` in eas.json) ✅, `oauth_facebook` ✅. History + tags were **not** carried over.

### F6 · Package-ID migration is OPEN/VERIFY
- `com.bancooom.app` now; docs flag the need to confirm no existing store listing under `com.bancoboom.app` before shipping the new id (store listing = irreversible package identity). **Owner/device confirm.**

### F7 · v4.1.4 issue-set status (independent check)
| # | Issue | Verdict |
|---|---|---|
| 1 | 4 icons unmapped | ✅ fixed in PR #8 |
| 2 | Object-storage tests 401 | env/test-mode (Replit sidecar) |
| 3 | Clerk redirect loop / black screen | **owner** — keys must share one Clerk instance; app-side gates already exist (ClerkLoadGate 2.5s timeout renders signed-out instead of white screen) |
| 4 | EADDRINUSE duplicate `.replit` workflows | config |
| 5 | Stale mobile static bundle | rebuild |
| 6 | Conflict markers | ✅ 0 remaining (`7a47b94`) |
| 7 | `DATABASE_URL` unreachable from GitHub CI | **owner infra** |
| 8 | Metro watches deleted Replit dirs | ✅ fixed in PR #8 (blockList) |

---

## 3) External compatibility scan (fresh, 2026-08-09) — what applies to THIS repo

| Area | Repo state | External finding | Action |
|---|---|---|---|
| Expo SDK 54 / RN 0.81.5 | pinned; `newArchEnabled: true` | SDK 54 uses precompiled iOS XCFrameworks; Android edge-to-edge always on | none |
| reanimated 4.1.1 + worklets 0.5.1 | **exact pair present** | Reanimated 4 moved worklets to `react-native-worklets`; the pair 4.1.1+0.5.1 is the correct match — mismatch = `useWorkletCallback is not a function` | **keep pinned; do not drift** |
| EAS Android (since 2026-06-29) | `expo-gesture-handler`, `screens`, `reanimated` in use | Active upstream incident: "No variants exist" (AGP 8.11) breaks EAS Android builds for RN community modules — server-side, not package.json-fixable | **track expo/expo#47354 + #42729 before the next EAS build; do not "fix" locally** |
| iOS Hermes ABI | precompiled RN | ABI mismatch possible when mixing precompiled RN with locally built JSI modules → escape hatch: `expo-build-properties` `ios.buildReactNativeFromSource: true` | keep as known remedy only |
| expo-notifications ~0.32.17 | present | must stay at the SDK-resolved version; don't bump past SDK 54's supported version | keep |
| @clerk/expo 3.3.1 | present; `tokenCache` + `ClerkLoadGate` + `useSocialProviders` fail-closed | known causes of black screen/redirect loop = unauthorized origin, bundle id not registered under Native Applications, stale `__clerk_client_jwt`; use `useSSO` not legacy `useOAuth`; scheme must match app.json + rebuild | verify Clerk Dashboard native app entries for `com.bancooom.app` (owner); confirm code uses `useSSO` |
| `@expo/vector-icons` override 15.0.3 (exact) | pinned in `pnpm-workspace.yaml` overrides | version mismatch makes the JS glyph map point at wrong-version TTF → app-wide tofu icons on Android (this repo already paid that bug; icons are now SVG/lucide) | **keep the exact pin** |

**Do NOT mass-upgrade.** Every pin above exists because of a paid incident.

---

## 4) Section-by-section audit (mobile) — what's right / what's missing

### Accounts & auth journeys (profile.tsx is the single 141k-line owner)
- **Correct (do not "fix"):** DB role = SoT + demote guard (client S4 + server `DEMOTE_BLOCKED`); FI chain `?intent=fi`; `useSocialProviders` **fail-closed** (empty Clerk social dict → no fake Google/Apple/Facebook buttons); provider tree order; AuthGate guest prompt; MFA state machine (`needs_second_factor` etc. — never boolean); Turnstile wired for sign-up.
- **Facebook OAuth:** genuinely implemented (`oauth_facebook`, commit `6778e65`) — dashboard-gated, dead until Meta/Clerk prod configured. Same class as Google/Apple. LinkedIn/phone login: **must NOT be faked** (tenant memory).
- **Fixed earlier, verified in corpus:** stuck `accountTypeChosen` for legacy sign-in/MFA/reset (BUG-001), delete-account with MFA (BUG-002), object-storage loud error (BUG-003), missing Stack registrations for banks/verification/analytics/rfq-inbox (BUG-005), help→mailto (BUG-007).
- **Open:** Clerk keys single-instance (#3, owner); no EAS native build evidence in CI.

### Messaging (high priority)
- Poll-only contract G47 enforced by `messenger-wiring-guard.test.mjs`; optimistic send/retry; offer messages; reactions; presence privacy (away ≡ unknown); cache seeding on deliver; reply preserved on retry.
- **Gaps to verify at scale (no runtime evidence available to me):** cursor pagination correctness on very large threads; offline queue durability; push↔in-app unread sync under race; media upload cancellation. Currently `UNKNOWN` — needs device/runtime evidence, not guessing.

### Maps
- Live stack: `components/search/mapHtml.ts` (Leaflet in WebView) + `MapPinPicker`/`LocationPicker` + server `SearchService.mapClusters` + geo tests. `?map=1` latch contract shared by SectionSearchApp + BookingStaysApp (`mapLatch.ts`).
- **Open (documented, not started):** Nawy-style RE map layers (radius draw-select, compound pins, price overlays) — planned additive layers behind the existing WebView contract. Web map preview behind flag `NEXT_PUBLIC_WEB_SEARCH_MAP=false` (default off). Google Maps live engine absent by design (Leaflet is the live engine).

### BOOM Stay (`section/booking` → `BookingStaysApp` + `StaysHomeHeader`)
- Pinned 4-band header rebuilt on the approved Cars shape (306dp → collapse); rental-term tabs from the market's real taxonomy (EG daily/new-law/old-law; Gulf daily/annual); hard lock `real_estate+rent` (anti-melt); honest `price_display` (no client math).
- **Open gaps (from the corpus, still live):** M1 true purpose-built stays layout; M2 expressive section backgrounds app-wide; M3 Banks & Financiers blue identity; M4 glass bottom bar on mini-app search pages; booking-dates data model (no checkIn/checkOut/guests in `search-contract/src/url.ts` yet).

### Import mini-app
- Full lifecycle present: `import/{index,request,calculator,auctions,documents,order/[id]}` + `import-tracking` + server `ImportOrderService` + stage advance/cancel + notifications. Conflict markers cleaned (`7a47b94`).

### Web surfaces
- `banco-web` flags: live search **off** by default (`NEXT_PUBLIC_WEB_SEARCH_LIVE=false`), Market copy **off** (`NEXT_PUBLIC_WEB_MARKET_COPY=false`), map preview **off** (`NEXT_PUBLIC_WEB_SEARCH_MAP=false`), kill-switch `WEB_PLUG_ENABLED`. Website ↔ mobile isolation charter exists — keep it absolute.

---

## 5) Task queues (dispatchable now)

### Q0 — Blockers first (owner/manager)
1. Merge PR #8 (unblocks `main` CI).
2. Owner: tag `v1.0.0` decision (fires production deploy).
3. Correct `DEPLOYMENT_SOURCE_OF_TRUTH.md` + README + DUAL_REPO_STATUS → `bancoboomstor`.
4. Owner infra: Clerk keys single instance (#3); external CI DB (#7).

### Q1 — Merges/reviews (Codex)
1. Review + merge `claude/headers-dynamic-polish` (well-known hardening + gates).
2. Decide fate of `tests/render/*` (delete vs convert to node:test + RN renderer).
3. Pre-commit hook against conflict markers (prevents a repeat of F1-cause-2 and v4.1.4 #6).

### Q2 — Mobile hardening (device/EAS evidence needed)
1. Run an EAS production build (Android app-bundle + iOS) — **first check the active EAS "No variants exist" incident**; capture logs.
2. Confirm `com.bancooom.app` store identity (no prior listing under `com.bancoboom.app`).
3. Verify Clerk Dashboard native application entries for the bundle/package ids.
4. Device QA matrix per mini-app (screens unreachable/exit-less, safe areas, keyboard, offline).

### Q3 — Messaging/scale verification (runtime)
1. Load-test pagination on large threads; verify cursor + ordering under concurrent send.
2. Verify push↔in-app unread sync; invalid-token cleanup path in `PushService`.
3. Offline send queue durability + retry-storm guard.

### Q4 — Maps completion (planned, additive)
1. RE radius/area draw + price overlays behind the WebView contract; guard-tested per section.

### Q5 — Stay redesign (owner-approved design needed)
1. M1 purpose-built stays layout; M2/M3 identity backgrounds; M4 glass bottom bar; booking-dates model in `search-contract`.

---

## 6) What I could NOT verify (honest UNKNOWNs)

- No local execution of `pnpm install`/`tsc`/tests from this environment — my green/red claims come from actual CI logs, which are authoritative here.
- No runtime/live evidence: Coolify deployment state, Replit runtime, EAS build output, device behavior, Clerk dashboard state, Paymob live flow, Resend delivery. All `UNKNOWN` until owner/runner evidence exists.
- EAS Android build viability **right now** depends on an active upstream EAS incident — do not burn a build until it's checked.

---

## 7) Rules I am operating under (so we never conflict)

- I never push to `main`; I never touch branches owned by Claude/Cursor/Codex. My writes are docs on my own `copilot/*` branches unless Codex assigns me a code task on a dedicated branch.
- Evidence or `UNKNOWN` — no guessing, no fabricated green.
- No deletions without Codex approval + a live-caller check.
- Section isolation is absolute; website ↔ mobile isolation is absolute.

**Codex: the queues above are ready to dispatch. Tell me which queue/item to take first and I'll execute on a dedicated branch with evidence per step.**

— GitHub Copilot
