#!/usr/bin/env node
/**
 * BANCO full-chain integrity gate — NON-DESTRUCTIVE.
 *
 * Verifies that critical adopted fixes remain present in source so a future
 * Replit mega-wipe (class of 93b650b) cannot ship silently.
 *
 * Usage (repo root):
 *   node scripts/chain-integrity-gate.mjs
 *
 * Exit 0 = all markers present. Exit 1 = one or more missing.
 * Does NOT modify product behavior. Does NOT guess env/runtime.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** @type {{ id: string; file: string; test: (src: string) => boolean; why: string }[]} */
const CHECKS = [
  {
    id: "P-profile-phone-MOB01",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) =>
      /testID="edit-phone-input"/.test(s) &&
      /phoneDraft/.test(s) &&
      /phone:\s*trimmedPhone/.test(s),
    why: "MOB-01 phone edit must remain wired to updateMe",
  },
  {
    id: "P-account-skip",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) => /testID="onboard-skip"/.test(s),
    why: "Skip on account-type gate (224ef4f) must not be wiped again",
  },
  {
    id: "P-account-anti-trap",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) => {
      const i = s.indexOf("const chooseAccountType");
      if (i < 0) return false;
      const sl = s.slice(i, i + 2200);
      const d = sl.indexOf("setNeedsAccountType(false)");
      const u = sl.indexOf("await updateMe({ account_type");
      return d >= 0 && u >= 0 && d < u;
    },
    why: "df68258 dismiss-first — never trap users if API fails",
  },
  {
    id: "P-account-fi-intent",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) => /intent=fi/.test(s) && /financial_institution/.test(s),
    why: "FI onboarding must pass intent=fi (never silent dealer demotion path)",
  },
  {
    id: "P-account-role-from-me",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) =>
      /meQuery\.data\?\.data\?\.role/.test(s) &&
      /const role = meRole \|\| clerkRole/.test(s),
    why: "Profile chrome must prefer DB /me.role over Clerk metadata lag",
  },
  {
    id: "P-account-demote-guard",
    file: "artifacts/api-server/src/services/UserService.ts",
    test: (s) =>
      /DEMOTE_BLOCKED/.test(s) &&
      /account_type === "individual"/.test(s) &&
      /financial_institution/.test(s),
    why: "Elevated roles must not self-demote to individual via PATCH /me",
  },
  {
    id: "P-banks-awaiting-link",
    file: "artifacts/banco-mobile/app/business/banks.tsx",
    test: (s) =>
      /testID="banks-awaiting-link"/.test(s) &&
      /showAwaitingAdminLink/.test(s) &&
      /intent=fi/.test(s),
    why: "FI without owner link must see awaiting-admin UX, not endless Join",
  },
  {
    id: "P-menu-touch-safe-profile",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) => {
      const a = s.indexOf("{/* Overflow menu");
      if (a < 0) return false;
      const b = s.indexOf("</Modal>", a);
      const block = s.slice(a, b);
      return (
        !/onStartShouldSetResponder/.test(block) &&
        /StyleSheet\.absoluteFillObject/.test(block) &&
        /maxHeight:\s*["']85%["']/.test(s)
      );
    },
    why: "Profile overflow menu touch-safe + scroll cap (f70e016/4ccf939)",
  },
  {
    id: "P-menu-touch-safe-promote",
    file: "artifacts/banco-mobile/components/PromoteButton.tsx",
    test: (s) =>
      !/onStartShouldSetResponder/.test(s) && /StyleSheet\.absoluteFillObject/.test(s),
    why: "Promote sheet must stay touch-safe",
  },
  {
    id: "P-menu-touch-safe-home",
    file: "artifacts/banco-mobile/app/(tabs)/index.tsx",
    test: (s) =>
      !/onStartShouldSetResponder/.test(s) &&
      (s.match(/StyleSheet\.absoluteFillObject/g) || []).length >= 2,
    why: "Home logo/sort menus must stay touch-safe",
  },
  {
    id: "P-map-locate-me",
    file: "artifacts/banco-mobile/components/search/mapHtml.ts",
    test: (s) => /LocateControl/.test(s) && /locate-btn/.test(s),
    why: "Locate-me control (fcd7d1c) must remain after wipe restore",
  },
  {
    id: "P-map-market-center",
    file: "artifacts/banco-mobile/lib/searchTaxonomy.ts",
    test: (s) =>
      /export function marketCountryMapCenter/.test(s) &&
      /FR:\s*\{\s*lat:/.test(s) &&
      /LB:\s*\{\s*lat:/.test(s) &&
      /MA:\s*\{\s*lat:/.test(s) &&
      /TN:\s*\{\s*lat:/.test(s) &&
      /SD:\s*\{\s*lat:/.test(s),
    why: "Market-country initial map center must cover EU + LB/MA/TN/SD (no silent EG fallback)",
  },
  {
    id: "P-profile-menu-hooks-safe",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) =>
      /const menuItems\s*:/.test(s) && !/const menuItems\s*=\s*useMemo/.test(s),
    why: "Profile menuItems must not useMemo after early returns (Rules of Hooks crash)",
  },
  {
    id: "P-deploy-pin-readyz",
    file: "artifacts/api-server/src/routes/health.ts",
    test: (s) =>
      /function deployPin/.test(s) &&
      /gitSha/.test(s) &&
      /readyz/.test(s) &&
      /\.\.\.deployPin\(\)/.test(s),
    why: "Readyz/livez must expose deploy SHA pin for live production verification (F1)",
  },
  {
    id: "P-map-market-center-wired",
    file: "artifacts/banco-mobile/components/search/SearchResultsMap.tsx",
    test: (s) => /marketCountryMapCenter\(criteria\.marketCountry\)/.test(s),
    why: "Native map must frame by selected market country",
  },
  {
    id: "P-map-geolocation-webview",
    file: "artifacts/banco-mobile/components/search/SearchResultsMap.tsx",
    test: (s) => /geolocationEnabled/.test(s),
    why: "Android/iOS WebView must allow geolocation for locate-me",
  },
  {
    id: "P-map-locate-error",
    file: "artifacts/banco-mobile/components/search/mapHtml.ts",
    test: (s) =>
      /locate_error/.test(s) &&
      /reason:\s*"denied"/.test(s) &&
      /function \(err\)/.test(s),
    why: "Locate-me must report deny/timeout to host (N2 Android/iOS honesty)",
  },
  {
    id: "P-android-keyboard-resize",
    file: "artifacts/banco-mobile/app.json",
    test: (s) => /softwareKeyboardLayoutMode"\s*:\s*"resize"/.test(s),
    why: "Android SoftInput resize so composers stay visible above keyboard",
  },
  {
    id: "P-cover-photo-rationale",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) =>
      /showCoverRationale/.test(s) &&
      /coverAccessTitle/.test(s) &&
      /setShowCoverRationale\(true\)/.test(s),
    why: "Cover gallery must use in-app rationale before OS prompt",
  },
  {
    id: "P-chat-attach-rationale",
    file: "artifacts/banco-mobile/app/messages/[id].tsx",
    test: (s) =>
      /showAttachRationale/.test(s) &&
      /PermissionRationaleModal/.test(s) &&
      /message-attach/.test(s),
    why: "Chat attach must disclose before OS gallery prompt",
  },
  {
    id: "P-market-eu-flags",
    file: "artifacts/banco-mobile/constants/countryCodes.ts",
    test: (s) =>
      ["FR", "DE", "ES", "IT"].every((iso) =>
        new RegExp(`iso:\\s*"${iso}"[\\s\\S]{0,120}?flag:\\s*"`).test(s),
      ),
    why: "Compressed market strip needs EU flags (not globe fallback)",
  },
  {
    id: "P-car-compact-strip",
    file: "artifacts/banco-mobile/components/search/SectionSearchApp.tsx",
    test: (s) =>
      /testID="car-brand-origin-strip"/.test(s) && /testID="car-brand-btn"/.test(s),
    why: "Owner-approved compact car strip (aa0364c) — do not regress to dual rows",
  },
  {
    id: "P-stay-compact-sort",
    file: "artifacts/banco-mobile/components/search/BookingStaysApp.tsx",
    test: (s) => /sortChip:\s*\{[\s\S]*?width:\s*30[\s\S]*?height:\s*30/.test(s),
    why: "Owner compact Stay sort chip 30×30 (4bf7cfb)",
  },
  {
    id: "P-upload-503-storage",
    file: "artifacts/api-server/src/controllers/uploadController.ts",
    test: (s) =>
      /object storage is not configured/.test(s) && /status\(503\)/.test(s),
    why: "Clear 503 when storage missing (0afef07) — not opaque 500",
  },
  {
    id: "P-upload-claims-idor",
    file: "artifacts/api-server/src/lib/uploadClaims.ts",
    test: (s) => /assertCallerMayUseUpload/.test(s),
    why: "C-01 upload IDOR guard must remain",
  },
  {
    id: "P-upload-update-503",
    file: "artifacts/api-server/src/controllers/listingController.ts",
    test: (s) => {
      const i = s.indexOf("export async function updateListingHandler");
      if (i < 0) return false;
      const block = s.slice(i, i + 1800);
      return (
        /MEDIA_VERIFY_RETRYABLE/.test(block) &&
        /status\(503\)/.test(block) &&
        /createListingHandler/.test(s) &&
        /MEDIA_VERIFY_RETRYABLE/.test(s)
      );
    },
    why: "Update listing must map transient media verify to 503 like create (N1.1)",
  },
  {
    id: "P-email-cycles",
    file: "artifacts/api-server/src/services/EmailService.ts",
    test: (s) =>
      /sendNewMessageEmail/.test(s) &&
      /sendNewMatchEmail/.test(s) &&
      /sendPriceDropEmail/.test(s),
    why: "Transactional email cycles (ef8174d) must remain",
  },
  {
    id: "P-email-arabic-safe",
    file: "artifacts/api-server/src/services/EmailService.ts",
    test: (s) => /BUG-001/.test(s) && /charCodeAt\(0\)\.toString\(16\)/.test(s),
    why: "Arabic ByteString-safe escape (b6724a1) must remain",
  },
  {
    id: "P-push-service",
    file: "artifacts/api-server/src/services/PushService.ts",
    test: (s) => /EXPO_PUSH_ENDPOINT/.test(s) && /registerPushToken/.test(s),
    why: "Push delivery path must remain",
  },
  {
    id: "P-push-chokepoint",
    file: "artifacts/api-server/src/services/NotificationService.ts",
    test: (s) =>
      /sendPushToUser/.test(s) &&
      /createNotification/.test(s) &&
      /data:\s*\{\s*type:\s*input\.type/.test(s),
    why: "Push must fan out only via createNotification with data.type",
  },
  {
    id: "P-push-expo-go-guard",
    file: "artifacts/banco-mobile/hooks/usePushNotifications.tsx",
    test: (s) =>
      /isExpoGo/.test(s) &&
      /ExecutionEnvironment\.StoreClient/.test(s) &&
      /routeForNotification/.test(s),
    why: "Expo Go must stay no-remote-push; taps use shared router",
  },
  {
    id: "P-push-routing-shared",
    file: "artifacts/banco-mobile/lib/notificationRouting.ts",
    test: (s) =>
      /export function routeForNotification/.test(s) &&
      /type === "message"/.test(s) &&
      /listingId:\s*d\.listing_id/.test(s) &&
      /financing_lead_id/.test(s) &&
      /payment_success/.test(s),
    why: "Shared feed+push router must keep message listingId + banks + billing",
  },
  {
    id: "P-fi-agent-authz",
    file: "artifacts/api-server/src/services/FinancingService.ts",
    test: (s) => /agentCanAccessRequest/.test(s),
    why: "FI branch agent AuthZ must remain",
  },
  {
    id: "P-fi-admin-queue",
    file: "artifacts/admin-os/src/pages/users.tsx",
    test: (s) =>
      /users-role-filter/.test(s) &&
      /users-fi-queue/.test(s) &&
      /fiInboxUnlinked/.test(s) &&
      /GetAdminUsersRole\.financial_institution/.test(s) &&
      /ownedByOther/.test(s),
    why: "Admin FI awaiting-link queue + unlinked badge + no overwrite other owners (N1.3)",
  },
  {
    id: "P-fi-inbox-forbidden-unlinked",
    file: "artifacts/api-server/src/services/FinancingService.test.ts",
    test: (s) =>
      /denies institution inbox for FI role without owner\/seat link/.test(s) &&
      /listInstitutionRequests/.test(s) &&
      /FORBIDDEN/.test(s),
    why: "Regression: unlinked FI must get FORBIDDEN on institution inbox",
  },
  {
    id: "P-section-route-discover",
    file: "artifacts/banco-mobile/components/SearchDiscover.tsx",
    test: (s) => /SECTION_ROUTE/.test(s) && /router\.push\(SECTION_ROUTE\[cat\]\)/.test(s),
    why: "Discover must ENTER mini-apps (anti-melt)",
  },
  {
    id: "P-clerk-load-gate",
    file: "artifacts/banco-mobile/app/_layout.tsx",
    test: (s) =>
      /function ClerkLoadGate/.test(s) &&
      /CLERK_LOAD_TIMEOUT_MS/.test(s) &&
      /getToken\(\)\.catch\(\(\)\s*=>\s*null\)/.test(s) &&
      /FONT_WAIT_MS/.test(s),
    why: "ClerkLoadGate + font wait prevent infinite white screen (bancoo C-WEB-BASE)",
  },
  {
    id: "P-web-export-build",
    file: "artifacts/banco-mobile/scripts/build.js",
    test: (s) => /function exportWebBuild/.test(s) && /exportWebBuild\(\)/.test(s),
    why: "Replit deploy must export web SPA (not QR-only browsers)",
  },
  {
    id: "P-web-serve-spa",
    file: "artifacts/banco-mobile/server/serve.js",
    test: (s) =>
      /WEB_ROOT/.test(s) &&
      /static-build.*web/.test(s) &&
      /serveWebIndex|hasWebBuild/.test(s),
    why: "serve.js must prefer static-build/web for browsers without expo-platform",
  },
  {
    id: "P-edit-media-wired",
    file: "artifacts/banco-mobile/app/listings/edit/[id].tsx",
    test: (s) =>
      /ListingMediaEditor/.test(s) &&
      /buildMediaPayload/.test(s) &&
      /media,/.test(s),
    why: "Edit listing must PATCH media via ListingMediaEditor (EDIT-MEDIA-DEAD)",
  },
  {
    id: "P-landing-clerk-domain",
    file: "artifacts/landing/src/App.tsx",
    test: (s) =>
      /banco\.today\/market\//.test(s) &&
      /banco\.today\//.test(s) &&
      /VITE_WEB_URL/.test(s) &&
      !/banco\.today\/banco-mobile\//.test(s),
    why: "deals→/market/ and autos→VITE_WEB_URL|apex on banco.today (no dead /banco-mobile/)",
  },
  {
    id: "P-buyer-phone-from-me",
    file: "artifacts/banco-mobile/app/listing/[id].tsx",
    test: (s) =>
      /meQuery\.data\?\.data\?\.phone/.test(s) &&
      /buyer_phone/.test(s),
    why: "Lead/booking buyer phone must prefer /me.phone (profile SoT)",
  },
  {
    id: "P-edit-listing-invalidate",
    file: "artifacts/banco-mobile/app/listings/edit/[id].tsx",
    test: (s) =>
      /invalidateQueries/.test(s) &&
      /getGetListingQueryKey\(id\)/.test(s),
    why: "Edit save must invalidate listing RQ cache (not only session bump)",
  },
  {
    id: "P-post-signup-no-nav-on-fail",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) =>
      /let synced = false/.test(s) &&
      /if \(!synced\) return/.test(s) &&
      /post-signup account_type save failed/.test(s) &&
      /setNeedsAccountType\(true\)/.test(s),
    why: "Failed post-signup updateMe must not navigate and must reopen retry gate",
  },
  {
    id: "P-account-type-chosen-after-me",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) => {
      const i = s.indexOf("const chooseAccountType");
      if (i < 0) return false;
      const sl = s.slice(i, i + 2800);
      const u = sl.indexOf("await updateMe({ account_type");
      const c = sl.indexOf("accountTypeChosen: true");
      return u >= 0 && c >= 0 && u < c;
    },
    why: "Clerk accountTypeChosen must be set only after /me updateMe succeeds",
  },
  {
    id: "P-consent-type-chosen-after-me",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) => {
      const terms = s.indexOf("termsAcceptedAt: new Date().toISOString()");
      const post = s.indexOf("post-signup account_type save failed");
      if (terms < 0 || post < 0 || terms > post) return false;
      // Consent metadata write before /me must not stamp accountTypeChosen.
      if (s.slice(terms, post).includes("accountTypeChosen: true")) return false;
      const after = s.slice(post, post + 1600);
      // Flag write appears after successful sync block (after !synced return).
      const chosenAt = after.indexOf("accountTypeChosen: true");
      const syncedGuardAt = after.indexOf("if (!synced) return");
      return syncedGuardAt >= 0 && chosenAt > syncedGuardAt;
    },
    why: "Email signup consent must not set accountTypeChosen before /me succeeds",
  },
  {
    id: "P-verify-go-back-locked",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) =>
      /testID="verify-go-back"/.test(s) &&
      /disabled=\{isSigningUp\}/.test(s),
    why: "Verify Go Back must not clear consent while finalize is in flight",
  },
  {
    id: "P-mobile-archive-wired",
    file: "artifacts/banco-mobile/app/listings/mine.tsx",
    test: (s) =>
      /updateListing\(id, \{ status \}\)/.test(s) &&
      /confirmArchive/.test(s) &&
      /confirmReactivate/.test(s),
    why: "Mine must archive/reactivate via updateListing status (dealer parity)",
  },
  {
    id: "P-listing-detail-archive",
    file: "artifacts/banco-mobile/app/listing/[id].tsx",
    test: (s) =>
      /handleArchive/.test(s) &&
      /handleReactivate/.test(s) &&
      /status: "archived"/.test(s),
    why: "Owner listing detail must archive/reactivate like mine",
  },
  {
    id: "P-mine-mark-sold",
    file: "artifacts/banco-mobile/app/listings/mine.tsx",
    test: (s) =>
      /confirmSold/.test(s) &&
      /runStatus\(item\.id as string, "sold"\)/.test(s) &&
      /notifyListingsChanged/.test(s),
    why: "Mine must mark sold + invalidate profile/feed listings cache",
  },
  {
    id: "P-status-mutation-bump",
    file: "artifacts/banco-mobile/app/listing/[id].tsx",
    test: (s) =>
      /notifyListingsChanged/.test(s) &&
      /bumpListings/.test(s) &&
      /getGetMyListingsQueryKey/.test(s),
    why: "Owner status mutations must bump + invalidate my listings",
  },
  {
    id: "P-chat-sold-bump",
    file: "artifacts/banco-mobile/app/messages/[id].tsx",
    test: (s) =>
      /bumpListings\(\)/.test(s) &&
      /getGetMyListingsQueryKey/.test(s) &&
      /status: "sold"/.test(s),
    why: "Chat mark-sold must refresh profile/mine listings, not only detail",
  },
  {
    id: "P-dealer-mark-sold",
    file: "artifacts/dealer-os/src/pages/listings.tsx",
    test: (s) =>
      /handleMarkSold/.test(s) &&
      /status: "sold"/.test(s) &&
      /useUpdateListing/.test(s),
    why: "Dealer-os must close deals via updateListing status=sold",
  },
  {
    id: "P-dealer-edit-media",
    file: "artifacts/dealer-os/src/components/listing-form-sheet.tsx",
    test: (s) =>
      /buildMediaPayload/.test(s) &&
      /detail\.media/.test(s) &&
      /media: mediaArr/.test(s) &&
      !/Media \+ financing are create-only/.test(s),
    why: "Dealer edit must hydrate + PATCH media (UpdateListingBody.media)",
  },
  {
    id: "P-feed-safe-thumbnail",
    file: "artifacts/api-server/src/services/SearchService.ts",
    test: (s) =>
      /pickListingThumbnailUrl/.test(s) &&
      /thumbnailUrl: m\.thumbnailUrl/.test(s),
    why: "Feed enrich must never use raw video URL as card Image",
  },
  {
    id: "P-video-poster-client",
    file: "artifacts/banco-mobile/app/listings/create.tsx",
    test: (s) =>
      /thumbnail_url = posterUrl/.test(s) &&
      /VIDEO-POSTER/.test(s),
    why: "Create must set video thumbnail_url from sibling cover image",
  },
  {
    id: "P-poster-claim-assert",
    file: "artifacts/api-server/src/services/ListingService.ts",
    test: (s) =>
      /if \(m\.thumbnail_url\)/.test(s) &&
      /assertCallerMayUseUpload\(m\.thumbnail_url/.test(s),
    why: "thumbnail_url must be ownership-asserted like media.url",
  },
  {
    id: "P-expo-identity-canonical",
    file: "artifacts/banco-mobile/app.json",
    test: (s) => {
      try {
        const j = JSON.parse(s);
        return (
          j?.expo?.name === "BANCO" &&
          j?.expo?.scheme === "bancooom" &&
          j?.expo?.ios?.bundleIdentifier === "com.bancooom.app" &&
          j?.expo?.android?.package === "com.bancooom.app"
        );
      } catch {
        return false;
      }
    },
    why: "Display name BANCO + package com.bancooom.app + scheme bancooom",
  },
  {
    id: "P-no-facebook-oauth",
    file: "artifacts/banco-mobile/app/(tabs)/profile.tsx",
    test: (s) =>
      // Facebook is allowed ONLY when fail-closed behind tenant-enabled providers.
      // Absolute ban was outdated: Clerk can enable FB later without dead-end buttons.
      /oauth_facebook/.test(s) &&
      /socialProviders\.includes\("facebook"\)/.test(s) &&
      /oauth_google/.test(s) &&
      /useSocialProviders/.test(s),
    why: "Facebook OAuth must stay fail-closed via useSocialProviders (no ungated invent)",
  },
  {
    id: "P-no-fi-autocreate-onboarding",
    file: "artifacts/banco-mobile/app/business/onboarding.tsx",
    test: (s) =>
      /financial_institution/.test(s) &&
      !/createIntermediary/.test(s) &&
      !/createBank/.test(s),
    why: "FI onboarding must not auto-create intermediary orgs",
  },
  {
    id: "P-auth-reject-tombstone",
    file: "artifacts/api-server/src/middlewares/authGuard.ts",
    test: (s) =>
      /ACCOUNT_DELETED/.test(s) &&
      /deletedAt/.test(s) &&
      /findActiveUserByClerkId/.test(s),
    why: "requireAuth must reject soft-deleted accounts (not only dealer/admin guards)",
  },
  {
    id: "P-intent-before-psp",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function createTopupIntent"));
      const insertAt = fn.indexOf("insert(paymentIntents)");
      const chargeAt = fn.indexOf("createProviderCharge");
      return insertAt >= 0 && chargeAt >= 0 && insertAt < chargeAt;
    },
    why: "Durable payment_intents row must exist before PSP charge (no stranded money)",
  },
  {
    id: "P-plug-redirect-not-rewrite",
    file: "artifacts/banco-website/middleware.ts",
    test: (s) =>
      /NextResponse\.redirect\(url\)/.test(s) &&
      !/NextResponse\.rewrite\(url\)/.test(s) &&
      /REDIRECTED to \/maintenance/.test(s),
    why: "Plug-off must redirect (not rewrite) so SiteChrome pathname matches maintenance",
  },
  {
    id: "P-delete-revokes-fi-seats",
    file: "artifacts/api-server/src/services/UserService.ts",
    test: (s) =>
      /financingSeats/.test(s) &&
      /delete\(financingSeats\)/.test(s) &&
      /eq\(financingSeats\.userId/.test(s),
    why: "Account deletion must revoke FI seats (inbox PII)",
  },
  {
    id: "P-ad-budget-atomic",
    file: "artifacts/api-server/src/services/AdsService.ts",
    test: (s) =>
      /budget_exhausted/.test(s) &&
      /budgetSpent\}\)::numeric/.test(s) &&
      /budgetTotal\}\)::numeric/.test(s),
    why: "Ad impression spend must be conditional UPDATE (no concurrent overspend)",
  },
  {
    id: "P-fi-status-predicate",
    file: "artifacts/api-server/src/services/FinancingService.ts",
    test: (s) =>
      /statusChanging/.test(s) &&
      /eq\(financingRequests\.status, existing\.status\)/.test(s) &&
      /CONFLICT/.test(s),
    why: "FI request status updates must be conditional (no last-write-wins reopen)",
  },
  {
    id: "P-chat-media-assert-before-insert",
    file: "artifacts/api-server/src/services/ConversationService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function sendMessage"));
      const assertAt = fn.indexOf("assertCallerMayUseUpload");
      const insertAt = fn.indexOf("insert(messages)");
      return assertAt >= 0 && insertAt >= 0 && assertAt < insertAt;
    },
    why: "Chat media ownership must be proven before message insert (no durable stolen URL)",
  },
  {
    id: "P-company-brand-assert-before-write",
    file: "artifacts/api-server/src/services/CompanyService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function upsertMyCompanyProfile"));
      const assertAt = fn.indexOf("assertCallerMayUseUpload");
      const insertAt = fn.indexOf("insert(companyProfiles)");
      return assertAt >= 0 && insertAt >= 0 && assertAt < insertAt;
    },
    why: "Company brand media ownership must be proven before profile write",
  },
  {
    id: "P-notif-enum-car-import",
    file: "artifacts/api-server/src/validators/schemas.ts",
    test: (s) =>
      /NotificationTypeEnum[\s\S]*car_import/.test(s) &&
      /subscription_expiring/.test(s),
    why: "Response Zod enum must include car_import or GET /notifications 500s",
  },
  {
    id: "P-prefs-billing-mutable",
    file: "artifacts/api-server/src/services/ProfileService.ts",
    test: (s) =>
      /"booking"/.test(s) &&
      /"payment_success"/.test(s) &&
      /"car_import"/.test(s) &&
      /NOTIFICATION_TYPES/.test(s),
    why: "Settings must expose booking/billing/import mute categories",
  },
  {
    id: "P-delete-clerk-fail-soft",
    file: "artifacts/api-server/src/services/UserService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function deleteAccount"));
      return (
        /clerkClient\.users\.deleteUser/.test(fn) &&
        /returning success so client signs out/.test(fn) &&
        !/AUTH_PROVIDER_ERROR/.test(fn)
      );
    },
    why: "Clerk delete failure must not block client sign-out after privacy wipe",
  },
  {
    id: "P-push-response-dedupe",
    file: "artifacts/banco-mobile/hooks/usePushNotifications.tsx",
    test: (s) =>
      /handledResponseIds/.test(s) &&
      /getLastNotificationResponseAsync/.test(s) &&
      /addNotificationResponseReceivedListener/.test(s),
    why: "Cold-start push deep-link must dedupe last-response vs listener",
  },
  {
    id: "P-biometric-bg-only",
    file: "artifacts/banco-mobile/context/BiometricContext.tsx",
    test: (s) =>
      /state === "background"/.test(s) &&
      !/state === "background" \|\| state === "inactive"/.test(s) &&
      !/\(state === "background" \|\| state === "inactive"\)/.test(s),
    why: "Biometric must not re-lock on inactive (permission sheet storms)",
  },
  {
    id: "P-svg-icon-registry",
    file: "artifacts/banco-mobile/components/icons.tsx",
    test: (s) =>
      /lucide-react-native/.test(s) &&
      /react-native-svg/.test(s) &&
      !/from ["']@expo\/vector-icons["']/.test(s),
    why: "SVG icon registry must remain the sole runtime glyph source (no vector-font regression)",
  },
  {
    id: "P-push-unregister-scoped",
    file: "artifacts/api-server/src/services/PushService.ts",
    test: (s) =>
      /eq\(pushTokens\.userId, user\.id\)/.test(s) &&
      /delete\(pushTokens\)/.test(s),
    why: "unregisterPushToken must scope DELETE to caller userId (no cross-user wipe)",
  },
  {
    id: "P-message-notif-cooldown",
    file: "artifacts/api-server/src/services/ConversationService.ts",
    test: (s) =>
      /MESSAGE_NOTIF_COOLDOWN_MS/.test(s) &&
      /conversation_id/.test(s) &&
      /recentNotif/.test(s),
    why: "Message push/email must cooldown per thread (no chat storms)",
  },
  {
    id: "P-follower-notif-route",
    file: "artifacts/banco-mobile/lib/notificationRouting.ts",
    test: (s) =>
      /follower_id/.test(s) &&
      /\/notifications/.test(s) &&
      /open_notifications/.test(s),
    why: "Follower system pings must deep-link to notifications feed (not dead null)",
  },
  {
    id: "P-signout-unregister-first",
    file: "artifacts/banco-mobile/app/settings.tsx",
    test: (s) =>
      /unregisterCachedPushTokenBestEffort/.test(s) &&
      /confirmSignOut/.test(s),
    why: "Sign-out must unregister push while session is still valid",
  },
  {
    id: "P-account-deleted-signout",
    file: "artifacts/banco-mobile/app/_layout.tsx",
    test: (s) =>
      /setAuthFailureHandler/.test(s) &&
      /ACCOUNT_DELETED/.test(s) &&
      /signOut/.test(s),
    why: "Lingering JWT after soft-delete must force client sign-out",
  },
  {
    id: "P-search-market-country-wired",
    file: "artifacts/api-server/src/controllers/searchController.ts",
    test: (s) =>
      /query\.market_country/.test(s) &&
      /parsed\.market_country/.test(s) &&
      /query\.material/.test(s) &&
      /parsed\.material/.test(s),
    why: "Search controller must forward market_country + material into ParsedSearchQuery",
  },
  {
    id: "P-search-material-sql",
    file: "artifacts/api-server/src/services/SearchService.ts",
    test: (s) =>
      /market_country\?:/.test(s) &&
      /f\.material/.test(s) &&
      /specs\}->>'material'/.test(s),
    why: "Search SQL must apply material + market_country attribute filters",
  },
  {
    id: "P-mobile-emit-market-country",
    file: "artifacts/banco-mobile/lib/searchParams.ts",
    test: (s) =>
      /market_country/.test(s) &&
      /marketCountry\.trim\(\)/.test(s) &&
      !/UI-only market selector/.test(s),
    why: "Mobile buildSearchParams must emit market_country to the API",
  },
  {
    id: "P-rq-focus-bridge",
    file: "artifacts/banco-mobile/app/_layout.tsx",
    test: (s) =>
      /focusManager\.setFocused/.test(s) &&
      /ReactQueryFocusBridge/.test(s) &&
      /<ReactQueryFocusBridge\s*\/>/.test(s),
    why: "React Query must pause background polls via AppState focus bridge",
  },
  {
    id: "P-push-mute-cold-unregister",
    file: "artifacts/banco-mobile/hooks/usePushNotifications.tsx",
    test: (s) =>
      /getCachedPushToken/.test(s) &&
      /isSignedIn && !notificationsEnabled/.test(s) &&
      /obtainExpoPushToken/.test(s) &&
      /unregisterPushToken/.test(s),
    why: "Muted push after cold start must still resolve token and unregister",
  },
  {
    id: "P-review-notify-first-only",
    file: "artifacts/api-server/src/services/ReviewService.ts",
    test: (s) =>
      /isNewReview/.test(s) &&
      /Notify only on first review/.test(s) &&
      /onConflictDoUpdate/.test(s),
    why: "Re-rate must not storm seller with duplicate review notifications",
  },
  {
    id: "P-booking-reject-tombstone",
    file: "artifacts/api-server/src/services/BookingService.ts",
    // The tombstone check MOVED, it did not disappear. It used to be an inline
    // `isNull(users.deletedAt)` repeated in all three functions; it now lives in
    // the shared resolveUserId → getOrCreateUser, which throws ACCOUNT_DELETED —
    // a more specific answer than the UNAUTHORIZED the inline version gave.
    //
    // So this asserts the behaviour where it now lives rather than the old
    // marker: every booking mutation must route the caller through the one
    // helper, and that helper must be the tombstone-rejecting one. Checking the
    // literal string in three places would now fail on correct code while still
    // passing if someone hand-rolled a fourth lookup that skipped the check.
    test: (s) => {
      const fnBody = (name) => {
        const start = s.indexOf(`export async function ${name}`);
        if (start === -1) return "";
        const next = s.indexOf("\nexport ", start + 1);
        return s.slice(start, next === -1 ? s.length : next);
      };
      const routed = ["createBooking", "listBookings", "updateBookingStatus"].every(
        (n) => /resolveUserId\(clerkId\)/.test(fnBody(n)),
      );
      const helperRejectsTombstones = /async function resolveUserId[\s\S]*?getOrCreateUser\(/.test(s);
      const noStrayLookup = !/eq\(users\.clerkId/.test(s);
      return routed && helperRejectsTombstones && noStrayLookup;
    },
    why: "Booking mutations must reject soft-deleted clerk sessions — via the shared resolveUserId/getOrCreateUser path, with no hand-rolled lookup bypassing it",
  },
  {
    id: "P-optional-auth-tombstone",
    file: "artifacts/api-server/src/middlewares/authGuard.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export function optionalAuth"));
      return (
        /ACCOUNT_DELETED/.test(fn) &&
        /deletedAt/.test(fn) &&
        /Authentication unavailable/.test(fn)
      );
    },
    why: "optionalAuth must fail-closed on soft-deleted JWTs (no private owner leak)",
  },
  {
    id: "P-rfq-award-cas",
    file: "artifacts/api-server/src/services/RfqService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function acceptOffer"));
      return (
        /FOR UPDATE/.test(fn) &&
        /eq\(rfqs\.status, "open"\)/.test(fn) &&
        /awarded\.length === 0/.test(fn)
      );
    },
    why: "RFQ award must serialize open→awarded (no dual winner notify)",
  },
  {
    id: "P-has-installment-boolparam",
    file: "artifacts/api-server/src/validators/schemas.ts",
    test: (s) => {
      const block = s.slice(s.indexOf("export const SearchQuerySchema"));
      return /has_installment: boolParam\.optional\(\)/.test(block);
    },
    why: "has_installment=false must not coerce truthy via z.coerce.boolean",
  },
  {
    id: "P-import-stage-cas",
    file: "artifacts/api-server/src/services/ImportOrderService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function updateImportOrderStage"));
      return (
        /eq\(importOrders\.stage, row\.stage\)/.test(fn) &&
        /CONFLICT/.test(fn)
      );
    },
    why: "Import stage transitions must CAS on current stage (no dual notify)",
  },
  {
    id: "P-company-reject-tombstone",
    file: "artifacts/api-server/src/services/CompanyService.ts",
    test: (s) =>
      /isNull\(users\.deletedAt\)/.test(s) &&
      /Soft-deleted accounts are also suppressed/.test(s),
    why: "Deleted businesses must not remain public/followable",
  },
  {
    id: "P-session-scoped-storage",
    file: "artifacts/banco-mobile/context/SessionContext.tsx",
    test: (s) =>
      /scopedKey/.test(s) &&
      /userId/.test(s) &&
      /:u:/.test(s) &&
      /feedCacheRef\.current\.clear/.test(s),
    why: "Account switch must not leak saves/searches across users",
  },
  {
    id: "P-rq-clear-on-identity",
    file: "artifacts/banco-mobile/app/_layout.tsx",
    test: (s) =>
      /queryClient\.clear\(\)/.test(s) &&
      /cancelQueries/.test(s) &&
      /userId/.test(s),
    why: "React Query must drop private cache on Clerk identity change",
  },
  {
    id: "P-plan-respects-expiry",
    file: "artifacts/api-server/src/services/PlanService.ts",
    test: (s) =>
      /gt\(subscriptions\.expiresAt/.test(s) &&
      /eq\(subscriptions\.status, "active"\)/.test(s),
    why: "Expired subscriptions must not grant entitlements while cron lags",
  },
  {
    id: "P-settle-reject-tombstone",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) =>
      /isNull\(users\.deletedAt\)/.test(s) &&
      /Soft-deleted owners must not receive wallet credit/.test(s),
    why: "Late PSP webhooks must not credit soft-deleted accounts",
  },
  {
    id: "P-alert-once-per-user",
    file: "artifacts/api-server/src/services/AlertService.ts",
    test: (s) =>
      /notified\.has\(search\.userId\)/.test(s) &&
      /Atomic cooldown claim/.test(s) &&
      /cooldownCutoff/.test(s) &&
      /listingMatchesSavedSearchFilters/.test(s),
    why: "Overlapping saved searches must not multiply new_match storms; structured filters fail-closed",
  },
  {
    id: "P-boost-idempotency-required",
    file: "artifacts/api-server/src/validators/schemas.ts",
    test: (s) => {
      const block = s.slice(s.indexOf("export const BoostListingSchema"));
      return /idempotency_key: z\.string\(\)\.min\(8\)/.test(block);
    },
    why: "Boost retries without idempotency key must be rejected",
  },
  {
    id: "P-topup-idempotency-required",
    file: "artifacts/api-server/src/validators/schemas.ts",
    test: (s) => {
      const block = s.slice(s.indexOf("export const TopupCreateSchema"));
      return /idempotency_key: z\.string\(\)\.uuid\(\)/.test(block);
    },
    why: "Wallet top-up must require client UUID idempotency key",
  },
  {
    id: "P-subscribe-idempotency-required",
    file: "artifacts/api-server/src/validators/schemas.ts",
    test: (s) => {
      const block = s.slice(s.indexOf("export const SubscribeSchema"));
      return /idempotency_key: z\.string\(\)\.uuid\(\)/.test(block);
    },
    why: "Subscribe must require client UUID idempotency key",
  },
  {
    id: "P-topup-intent-uses-idempotency-id",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) =>
      /idempotencyKey: string/.test(s) &&
      /const intentId = input\.idempotencyKey\.trim\(\)/.test(s) &&
      /assertTopupIdempotencyMatch/.test(s),
    why: "Top-up intent id must equal client idempotency key with replay guard",
  },
  {
    id: "P-saved-search-match-version",
    file: "artifacts/api-server/src/services/savedSearchMatch.ts",
    test: (s) =>
      /SAVED_SEARCH_MATCH_VERSION = 1/.test(s) &&
      /match_version !== SAVED_SEARCH_MATCH_VERSION/.test(s) &&
      /market_country/.test(s),
    why: "Saved-search alerts must fail-closed without match_version 1",
  },
  {
    id: "P-mobile-saved-search-versioned-filters",
    file: "artifacts/banco-mobile/context/SessionContext.tsx",
    test: (s) =>
      /match_version: 1/.test(s) &&
      /buildSearchParams\(input\.criteria/.test(s),
    why: "Mobile must persist versioned snake_case filters for alert matching",
  },
  {
    id: "P-feed-material-wired",
    file: "artifacts/api-server/src/controllers/feedController.ts",
    test: (s) => /material: query\.material/.test(s),
    why: "Feed must forward material filter (search parity)",
  },
  {
    id: "P-paymob-order-bind",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) =>
      /claimPaymobOrderForIntent/.test(s) &&
      /paymob_order_id/.test(s) &&
      /pg_advisory_xact_lock/.test(s),
    why: "Signed Paymob order.id must bind to exactly one local intent",
  },
  {
    id: "P-paymob-require-callback",
    file: "artifacts/api-server/src/lib/paymentProvider.ts",
    test: (s) =>
      /PUBLIC_API_BASE_URL must be an https URL/.test(s) &&
      /callbackBaseUrl/.test(s),
    why: "Paymob charges must fail closed without https PUBLIC_API_BASE_URL",
  },
  {
    id: "P-delete-scrub-public-content",
    file: "artifacts/api-server/src/services/UserService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function deleteAccount"));
      return (
        /delete\(stories\)/.test(fn) &&
        /sellerReviews\.authorId/.test(fn) &&
        /listingComments/.test(fn) &&
        /paymentIntents/.test(fn)
      );
    },
    why: "Account deletion must scrub stories/reviews/comments and kill pending intents",
  },
  {
    id: "P-rate-limited-contract",
    file: "artifacts/api-server/src/middlewares/rateLimiter.ts",
    test: (s) =>
      /RATE_LIMITED/.test(s) &&
      !/INVALID_DATA/.test(s),
    why: "429 responses must use RATE_LIMITED error contract",
  },
  {
    id: "P-coolify-api-loopback",
    file: "docker-compose.coolify.yml",
    test: (s) => /127\.0\.0\.1:\$\{API_HOST_PORT/.test(s),
    why: "Coolify API host port must not be world-bindable (rate-limit spoof)",
  },
  {
    id: "P-saved-search-nav-emit",
    file: "artifacts/banco-mobile/app/(tabs)/saved.tsx",
    test: (s) =>
      /searchCriteriaToNavParams/.test(s) &&
      /search\.criteria/.test(s),
    why: "Saved-search tap must emit rich criteria via searchNavParams",
  },
  {
    id: "P-saved-search-nav-consume",
    file: "artifacts/banco-mobile/app/(tabs)/search.tsx",
    // Wave8 Tranche C/D (D-W8-04/06/07): dead Discover melt `applySaved` removed.
    // Saved→Search dual-end is nav params only (parse + hasIncoming + commit).
    test: (s) =>
      /parseMobileSearchNavParams/.test(s) &&
      /hasIncomingSearchNavParams/.test(s) &&
      /commit\(next\)/.test(s) &&
      !/const applySaved\s*=/.test(s),
    why: "Search tab restores rich criteria via nav params (Saved emit); Discover applySaved melt removed Wave8 C/D",
  },
  {
    id: "P-b2b-tombstone-investments",
    file: "artifacts/api-server/src/services/InvestmentService.ts",
    test: (s) =>
      /users\.deletedAt\} IS NULL/.test(s) &&
      /owner_deleted_at/.test(s),
    why: "Public investment boards must hide soft-deleted owners",
  },
  {
    id: "P-b2b-tombstone-rfq",
    file: "artifacts/api-server/src/services/RfqService.ts",
    test: (s) =>
      /users\.deletedAt\} IS NULL/.test(s) &&
      /buyerDeletedAt/.test(s),
    why: "Open RFQ board + offers must fail-closed for soft-deleted buyers",
  },
  {
    id: "P-b2b-tombstone-supply",
    file: "artifacts/api-server/src/services/GlobalSupplyService.ts",
    test: (s) =>
      /users\.deletedAt\} IS NULL/.test(s) &&
      /buyerDeletedAt/.test(s),
    why: "Global supply board + respond must fail-closed for soft-deleted buyers",
  },
  {
    id: "P-banco-web-topup-idempotency",
    file: "artifacts/banco-web/components/workspace/WalletPanel.tsx",
    test: (s) =>
      /idempotency_key/.test(s) &&
      /topupAttemptKeyRef/.test(s),
    why: "Frozen banco-web must still send top-up idempotency after Round 7 schema change",
  },
  {
    id: "P-push-prefs-identity-scoped",
    file: "artifacts/banco-mobile/context/SoundContext.tsx",
    test: (s) =>
      /scopedPrefKey/.test(s) &&
      /useAuth\(\)/.test(s) &&
      /userId/.test(s),
    why: "Push/sound mute prefs must not leak across Clerk identities",
  },
  {
    id: "P-listing-draft-identity-scoped",
    file: "artifacts/banco-mobile/lib/listingDraft.ts",
    test: (s) =>
      /listingDraftStorageKey/.test(s) &&
      /:u:/.test(s) &&
      /:guest/.test(s),
    why: "Listing draft phones/prices must be keyed per identity",
  },
  {
    id: "P-listing-draft-create-scoped",
    file: "artifacts/banco-mobile/app/listings/create.tsx",
    test: (s) =>
      /listingDraftStorageKey\(user\?\.id\)/.test(s) &&
      /draftKey/.test(s) &&
      !/AsyncStorage\.(setItem|getItem|removeItem)\(\s*LISTING_DRAFT_KEY\s*,/.test(s),
    why: "Create wizard must read/write identity-scoped draft keys (legacy migrate only)",
  },
  {
    id: "P-home-feed-market-country",
    file: "artifacts/banco-mobile/app/(tabs)/index.tsx",
    test: (s) =>
      /market_country:\s*marketCountry/.test(s) &&
      /loadPreferredMarketCountry/.test(s),
    why: "Home feed + rails must filter by preferred market_country like Search",
  },
  {
    id: "P-web-map-server-clusters",
    file: "artifacts/banco-mobile/components/search/SearchResultsMap.web.tsx",
    test: (s) =>
      /getMapClusters/.test(s) &&
      /BANCO_MAP/.test(s) &&
      /setClusters/.test(s) &&
      /serverTotal/.test(s),
    why: "Web search map must inject server clusters like native WebView host",
  },
  {
    id: "P-lead-charge-idempotency",
    file: "artifacts/api-server/src/services/LeadService.ts",
    test: (s) => /idempotencyKey:\s*`lead_charge:\$\{lead\.id\}`/.test(s),
    why: "CPL lead_charge must use lead-id idempotency key at wallet chokepoint",
  },
  {
    id: "P-listing-detail-tombstone",
    file: "artifacts/api-server/src/services/ListingService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function getListingDetail"));
      return (
        /seller_deleted_at/.test(fn) &&
        /seller_shadow_banned/.test(fn) &&
        /is_flagged/.test(fn) &&
        /!isOwner/.test(fn)
      );
    },
    why: "Public listing detail must hide soft-deleted/shadow-banned/flagged sellers",
  },
  {
    id: "P-topup-provider-opening-cas",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) =>
      /provider_opening/.test(s) &&
      /claimProviderOpening/.test(s) &&
      /waitForTopupCheckout/.test(s),
    why: "Concurrent top-up retries must CAS before opening a second Paymob checkout",
  },
  {
    id: "P-paymob-resolve-bound-order",
    file: "artifacts/api-server/src/controllers/paymentsController.ts",
    test: (s) =>
      /findIntentIdByPaymobOrderId/.test(s) &&
      /boundIntentId/.test(s),
    why: "Webhook must settle the intent already bound to signed order.id",
  },
  {
    id: "P-trending-market-country",
    file: "artifacts/api-server/src/services/SearchService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function getTrending"));
      return /marketCountry/.test(fn) && /buildAttributeConditions/.test(fn);
    },
    why: "Trending must honor market_country like feed/search",
  },
  {
    id: "P-facets-market-country",
    file: "artifacts/api-server/src/services/SearchService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function getFacets"));
      return (
        /marketCountry/.test(fn) &&
        /buildAttributeConditions\(\{\s*market_country:\s*marketCountry/.test(fn)
      );
    },
    why: "Facets must honor market_country like search/trending (P2-M1)",
  },
  {
    id: "P-facets-handler-market",
    file: "artifacts/api-server/src/controllers/searchController.ts",
    test: (s) =>
      /getFacets\(query\.category,\s*query\.market_country\)/.test(s) &&
      /FacetsQuerySchema/.test(s),
    why: "Facets handler must forward market_country into getFacets",
  },
  {
    id: "P-mobile-facets-market",
    file: "artifacts/banco-mobile/lib/facets.ts",
    test: (s) =>
      /marketCountry/.test(s) &&
      /market_country:\s*market/.test(s) &&
      /useGetFacets/.test(s),
    why: "Mobile inventory facets must request market_country from API",
  },
  {
    id: "P-wallet-idempotency-fingerprint",
    file: "artifacts/api-server/src/services/WalletService.ts",
    test: (s) =>
      /Idempotency key already used for a different transaction/.test(s) &&
      /existing\.type === input\.type/.test(s),
    why: "Ledger idempotency replay must fingerprint type/user/amount/reference",
  },
  {
    id: "P-subscription-wallet-key-namespace",
    file: "artifacts/api-server/src/services/SubscriptionService.ts",
    test: (s) => /subscription_wallet:\$\{idempotencyKey\}/.test(s),
    why: "Wallet subscription ledger keys must not collide with top-up intent UUIDs",
  },
  {
    id: "P-boost-listing-for-update",
    file: "artifacts/api-server/src/services/AdsService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function boostListing"));
      return /FOR UPDATE/.test(fn);
    },
    why: "Boost charge must lock listing row against mid-flight archive",
  },
  {
    id: "P-paymob-amount-before-claim",
    file: "artifacts/api-server/src/controllers/paymentsController.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function paymobWebhookHandler"));
      const amountAt = fn.indexOf("amountCents == null");
      const currencyAt = fn.indexOf('currency !== "EGP"');
      const claimAt = fn.indexOf("await claimPaymobOrderForIntent");
      return amountAt > 0 && currencyAt > 0 && claimAt > amountAt && claimAt > currencyAt;
    },
    why: "Paymob must reject bad/missing amount/currency before binding order.id",
  },
  {
    id: "P-booking-tombstone",
    file: "artifacts/api-server/src/services/BookingService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function createBooking"));
      return /publicVisibilityConditions/.test(fn) && /sellerDeletedAt/.test(fn);
    },
    why: "Bookings must fail-closed on soft-deleted/flagged/shadow-banned hosts",
  },
  {
    id: "P-ad-impression-listing-visible",
    file: "artifacts/api-server/src/services/AdsService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function recordImpression"));
      return /listing_hidden/.test(fn) && /publicVisibilityConditions/.test(fn);
    },
    why: "Ad impression billing must stop when listing is publicly hidden",
  },
  {
    id: "P-home-sort-market",
    file: "artifacts/banco-mobile/app/(tabs)/index.tsx",
    test: (s) =>
      /sort:\s*key/.test(s) &&
      /market_country:\s*marketCountry/.test(s),
    why: "Home sort navigation must carry preferred market_country",
  },
  {
    id: "P-web-trending-market",
    file: "artifacts/banco-web/components/HomeTrendingStrip.tsx",
    test: (s) =>
      /useGetTrending\(\{\s*market_country:\s*DEFAULT_MARKET_COUNTRY/.test(s),
    why: "Coolify banco-web trending must not mix markets",
  },
  {
    id: "P-promo-consume-fingerprint",
    file: "artifacts/api-server/src/services/PromoAdCreditService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function consumePromoCredit"));
      return (
        /Idempotency key already used for a different promo consume/.test(fn) &&
        /existing\.userId === userId/.test(fn) &&
        /existing\.type === "consume"/.test(fn)
      );
    },
    why: "Promo consume replay must fingerprint user/type/reference (post-delete key reuse)",
  },
  {
    id: "P-paymob-resume-preserves-order",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) =>
      /resumeFailedPaymentMetadataSql/.test(s) &&
      /paymobOrderIdFromMeta/.test(s) &&
      /already has a provider order/.test(s) &&
      /checkoutBoundPaymentMetadataSql/.test(s),
    why: "Failed Paymob resume must not wipe paymob_order_id / open a second paid order",
  },
  {
    id: "P-dealer-bulk-boost-idempotency",
    file: "artifacts/dealer-os/src/pages/listings.tsx",
    test: (s) => {
      const fn = s.slice(s.indexOf("const handleBulkBoost"));
      return /idempotency_key:\s*`boost:\$\{id\}/.test(fn);
    },
    why: "Dealer-os bulk boost must send required idempotency_key per listing",
  },
  {
    id: "P-prod-compose-api-loopback",
    file: "docker-compose.prod.yml",
    test: (s) => /127\.0\.0\.1:\$\{API_HOST_PORT/.test(s),
    why: "Prod compose must not world-bind API :8080 (X-Forwarded-For trust)",
  },
  {
    id: "P-readyz-money-schema",
    file: "artifacts/api-server/src/routes/health.ts",
    test: (s) =>
      /money_schema/.test(s) &&
      /SELECT 1 FROM payment_intents LIMIT 0/.test(s) &&
      /SELECT 1 FROM transactions LIMIT 0/.test(s),
    why: "readyz must fail closed when money tables are missing",
  },
  {
    id: "P-web-clerk-fail-closed",
    file: "artifacts/banco-web/middleware.ts",
    test: (s) =>
      /NODE_ENV === "production"/.test(s) &&
      /isProtectedRoute\(req\)/.test(s) &&
      /status: 503/.test(s),
    why: "Production web without Clerk key must fail closed on protected routes",
  },
  {
    id: "P-paymob-reject-refund-void-auth",
    file: "artifacts/api-server/src/lib/paymentProvider.ts",
    test: (s) =>
      /is_refunded !== true/.test(s) &&
      /is_voided !== true/.test(s) &&
      /is_auth === true && obj\.is_capture !== true/.test(s),
    why: "Paymob success must reject refunded/voided/auth-only signed outcomes",
  },
  {
    id: "P-wallet-credit-blocks-deleted",
    file: "artifacts/api-server/src/services/WalletService.ts",
    test: (s) =>
      /Soft-deleted owners must never receive credits/.test(s) &&
      /isNull\(users\.deletedAt\)/.test(s),
    why: "Ledger credits must require deleted_at IS NULL",
  },
  {
    id: "P-paymob-claim-for-update-merge",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function claimPaymobOrderForIntent"));
      return (
        /\.for\("update"\)/.test(fn) &&
        /jsonb_build_object\('paymob_order_id'/.test(fn)
      );
    },
    why: "Paymob order claim must lock intent and merge order id into metadata",
  },
  {
    id: "P-boost-idempotency-fingerprint",
    file: "artifacts/api-server/src/services/AdsService.ts",
    test: (s) =>
      /Idempotency key already used for a different boost/.test(s) &&
      /existing\.sellerId !== sellerId/.test(s),
    why: "Boost key replay must fingerprint seller/listing/adType (no cross-tenant free boost)",
  },
  {
    id: "P-mobile-keep-topup-key-pending",
    file: "artifacts/banco-mobile/app/wallet.tsx",
    test: (s) => {
      const pending = s.slice(s.indexOf('polled.status === "pending"'));
      const block = pending.slice(0, pending.indexOf("} else {"));
      return (
        /setPayState\("pending"\)/.test(block) &&
        !/topupAttemptKeyRef\.current = null/.test(block)
      );
    },
    why: "Mobile must not clear top-up attempt key while intent is still pending",
  },
  {
    id: "P-aws-migrate-exports-database-url",
    file: "deploy/aws/scripts/deploy.sh",
    test: (s) =>
      /DATABASE_URL="\$\(grep -E '\^DATABASE_URL='/.test(s) &&
      /export DATABASE_URL/.test(s),
    why: "AWS deploy must export SSM-rendered DATABASE_URL before db-migrate",
  },
  {
    id: "P-paymob-post-settlement-reversal",
    file: "artifacts/api-server/src/controllers/paymentsController.ts",
    test: (s) =>
      /isRefunded \|\| verification\.isVoided/.test(s) &&
      /reverseTopupAfterPspReversal/.test(s) &&
      /reverseSubscriptionAfterPspReversal/.test(s),
    why: "Refund/void webhooks must reverse completed settlements, not no-op mark-failed",
  },
  {
    id: "P-provider-opening-lease",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) =>
      /provider_opening_at/.test(s) &&
      /PROVIDER_OPENING_LEASE_SEC/.test(s),
    why: "provider_opening CAS must expire so crashed openers are not permanent locks",
  },
  {
    id: "P-lead-listing-for-update",
    file: "artifacts/api-server/src/services/LeadService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function contactLead"));
      return (
        /SELECT id FROM listings WHERE id = \$\{input\.listingId\}::uuid FOR UPDATE/.test(fn) &&
        /publicVisibilityConditions\(\)/.test(fn)
      );
    },
    why: "CPL contact must re-lock listing visibility inside the charge transaction",
  },
  {
    id: "P-rfq-accept-supplier-tombstone",
    file: "artifacts/api-server/src/services/RfqService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function acceptOffer"));
      return (
        /isShadowBanned/.test(fn) &&
        /deletedAt/.test(fn) &&
        /This offer is no longer available/.test(fn)
      );
    },
    why: "RFQ award must fail closed on deleted/shadow-banned suppliers",
  },
  {
    id: "P-import-stage-permission",
    file: "artifacts/api-server/src/routes/v1/import-orders.ts",
    test: (s) =>
      /requirePermission\("manage_financing"\)/.test(s) &&
      /updateImportOrderStageHandler/.test(s),
    why: "Import stage/quote changes must require manage_financing, not bare admin role",
  },
  {
    id: "P-comments-active-listing",
    file: "artifacts/api-server/src/services/CommentService.ts",
    test: (s) =>
      /eq\(listings\.status, "active"\)/.test(s) &&
      /publicVisibilityConditions\(\)/.test(s),
    why: "Public comments must require active + public visibility",
  },
  {
    id: "P-paymob-prebind-intention-order",
    file: "artifacts/api-server/src/lib/paymentProvider.ts",
    test: (s) =>
      /intention_order_id/.test(s) &&
      /providerOrderId/.test(s),
    why: "Intention create must capture order id when Paymob returns it (first-bind TOFU)",
  },
  // ── Round 15 ──────────────────────────────────────────────
  {
    id: "P-topup-settle-refuses-psp-reversed",
    file: "artifacts/api-server/src/services/PaymentIntentService.ts",
    test: (s) =>
      /pspReversedFromMeta/.test(s) &&
      /function settleTopupIntent/.test(s) &&
      /for\("update"\)/.test(s) &&
      /type: "adjustment"/.test(s),
    why: "Top-up settle must lock intent and refuse credit after durable PSP reverse; clawback is adjustment debit",
  },
  {
    id: "P-sub-reverse-orphan-and-pending",
    file: "artifacts/api-server/src/services/SubscriptionService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function reverseSubscriptionAfterPspReversal"));
      return (
        /orphan_topup/.test(fn) &&
        /psp_reversed/.test(fn) &&
        /type: "adjustment"/.test(fn) &&
        /status === "pending" \|\| intent\.status === "failed"/.test(fn)
      );
    },
    why: "Subscription reverse must terminalize pending with psp_reversed and claw orphan_topup",
  },
  {
    id: "P-web-keep-topup-key-pending",
    file: "artifacts/banco-web/components/workspace/WalletPanel.tsx",
    test: (s) => {
      const pending = s.slice(s.indexOf('polled.status === "pending"'));
      const block = pending.slice(0, pending.indexOf("} else {"));
      return (
        /setPayState\("pending"\)/.test(block) &&
        !/topupAttemptKeyRef\.current = null/.test(block)
      );
    },
    why: "Web WalletPanel must not clear top-up attempt key while intent is still pending",
  },
  {
    id: "P-dealer-bulk-boost-batch-ref",
    file: "artifacts/dealer-os/src/pages/listings.tsx",
    test: (s) =>
      /bulkBoostBatchRef/.test(s) &&
      /if \(!bulkBoostBatchRef\.current\)/.test(s),
    why: "Dealer bulk boost must reuse one batch token across double-confirm / retries",
  },
  {
    id: "P-save-visibility-gate",
    file: "artifacts/api-server/src/services/SaveService.ts",
    test: (s) =>
      /publicVisibilityConditions\(\)/.test(s) &&
      /eq\(listings\.status, "active"\)/.test(s),
    why: "New saves must require active + public visibility; unsaves stay allowed",
  },
  {
    id: "P-globalsupply-supplier-tombstone",
    file: "artifacts/api-server/src/services/GlobalSupplyService.ts",
    test: (s) => {
      const fetch = s.slice(s.indexOf("async function fetchResponses"));
      const matches = s.slice(s.indexOf("async function computeSupplierMatches"));
      return (
        /deletedAt} IS NULL/.test(fetch) &&
        /deletedAt} IS NULL/.test(matches)
      );
    },
    why: "GlobalSupply must hide deleted suppliers from matches and buyer response lists",
  },
  {
    id: "P-aws-ssm-wait-command",
    file: ".github/workflows/deploy.yml",
    test: (s) =>
      /aws ssm wait command-executed/.test(s) &&
      /get-command-invocation/.test(s) &&
      /STATUS/.test(s) &&
      /Success/.test(s),
    why: "AWS deploy must wait for SSM and fail the job when Status is not Success",
  },
  // ── Round 16 ──────────────────────────────────────────────
  {
    id: "P-paymob-partial-refund-claw",
    file: "artifacts/api-server/src/controllers/paymentsController.ts",
    test: (s) =>
      /isPspReverse/.test(s) &&
      /clawAmountEgp/.test(s) &&
      /amountCents > intentCents/.test(s),
    why: "Refund/void must claw partial amount_cents instead of ACK no-op on mismatch",
  },
  {
    id: "P-boost-seller-tombstone",
    file: "artifacts/api-server/src/services/AdsService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function boostListing"));
      return /deletedAt/.test(fn) && /for\("update"\)/.test(fn);
    },
    why: "Boost must not debit a soft-deleted seller",
  },
  {
    id: "P-review-create-tombstone",
    file: "artifacts/api-server/src/services/ReviewService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function createReview"));
      return /isNull\(users\.deletedAt\)/.test(fn);
    },
    why: "createReview must fail closed on soft-deleted sellers like listReviews",
  },
  {
    id: "P-globalsupply-respond-shadowban",
    file: "artifacts/api-server/src/services/GlobalSupplyService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function respondToRequest"));
      return /Account cannot submit offers/.test(fn) && /isShadowBanned/.test(fn);
    },
    why: "GlobalSupply respond must reject shadow-banned suppliers (RFQ parity)",
  },
  {
    id: "P-delete-account-notif-scrub",
    file: "artifacts/api-server/src/services/UserService.ts",
    test: (s) => {
      const fn = s.slice(s.indexOf("export async function deleteAccount"));
      return (
        /company_user_id/.test(fn) &&
        /follower_id/.test(fn) &&
        /authoredReviewIds/.test(fn) &&
        /authoredCommentIds/.test(fn) &&
        /type,\s*"comment"/.test(fn)
      );
    },
    why: "Account delete must purge follower/review/comment notifications that embed the deleted name",
  },
  {
    id: "P-prod-compose-healthy-depends",
    file: "docker-compose.prod.yml",
    test: (s) =>
      (s.match(/condition: service_healthy/g) || []).length >= 3,
    why: "Prod compose frontends must wait for API readyz health like Coolify",
  },
  // A brand-new Clerk user has no row in `users`: requireAuth explicitly does
  // not create one ("missing DB rows are allowed"). Any service that resolves
  // the CALLER with a bare SELECT and throws UNAUTHORIZED therefore refuses a
  // legitimately signed-in person on their first action — the account reads as
  // broken. Replit fixed exactly this for chat (672bbae) and only for chat.
  // These lock the remaining caller paths to getOrCreateUser.
  //
  // Scoped to the caller. `resolveUserIdOpt` and LeadService's buyerClerkId
  // resolve SOMEONE ELSE and must never auto-create — inventing an account as a
  // side effect of another user's request would fabricate rows.
  ...[
    ["booking", "artifacts/api-server/src/services/BookingService.ts"],
    ["comment", "artifacts/api-server/src/services/CommentService.ts"],
    ["globalsupply", "artifacts/api-server/src/services/GlobalSupplyService.ts"],
    ["importorder", "artifacts/api-server/src/services/ImportOrderService.ts"],
    ["investment", "artifacts/api-server/src/services/InvestmentService.ts"],
    ["company", "artifacts/api-server/src/services/CompanyService.ts"],
  ].map(([name, file]) => ({
    id: `P-first-touch-user-${name}`,
    file,
    test: (s) => {
      // Comments stripped: this gate's own prose names every symbol it checks.
      const code = s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (!/getOrCreateUser\s*\(/.test(code)) return false;
      // The optional resolver legitimately keeps a bare SELECT, so drop it
      // before looking for the forbidden shape.
      const withoutOpt = code.replace(
        /async function resolveUserIdOpt[\s\S]*?\n\}/g,
        "",
      );
      // Forbidden: a clerkId SELECT still followed by an UNAUTHORIZED throw.
      const idx = withoutOpt.indexOf("eq(users.clerkId");
      if (idx === -1) return true;
      return !/UNAUTHORIZED/.test(withoutOpt.slice(idx, idx + 400));
    },
    why: "Caller resolution must create the row on first touch, or a brand-new signed-in user is told UNAUTHORIZED on their first action",
  })),
  {
    id: "P-first-touch-not-for-other-users",
    file: "artifacts/api-server/src/services/LeadService.ts",
    test: (s) => !/getOrCreateUser/.test(s),
    why: "LeadService resolves the BUYER's clerkId, not the caller's — auto-creating there would fabricate accounts from someone else's request",
  },
  {
    // financial_institution is the fourth account type and is NOT in
    // BUSINESS_ROLES. The old two-way split (business plans vs "everyone else
    // gets individual") therefore hid the seeded bank_featured plan from banks
    // and offered them the individual plan instead — an unsellable product.
    // Both the listing and the subscribe gate must use the same rule, or a
    // caller can see a plan they are then refused at checkout.
    id: "P-plan-audience-covers-fi",
    file: "artifacts/api-server/src/services/SubscriptionService.ts",
    test: (s) => {
      const code = s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      const helper = /function planMatchesRole\([\s\S]*?audience === role/.test(code);
      // Neither path may keep the old hardcoded individual fallback, and both
      // must route through the one helper.
      const noHardcodedIndividual = !/audience === "individual"/.test(code);
      const listUses = /\.filter\(\(p\) => planMatchesRole\(role,/.test(code);
      const subscribeUses = /!planMatchesRole\(input\.role,/.test(code);
      return helper && noHardcodedIndividual && listUses && subscribeUses;
    },
    why: "Banks must see and be able to buy their own plan tier; listing and subscribe must agree, or a visible plan is refused at checkout",
  },
  {
    // Tab screens stay mounted after their first visit, so an ungated
    // refetchInterval on the conversations list polled every 8s for the whole
    // session from anywhere in the app. The badge in (tabs)/_layout.tsx already
    // owns the background cadence for the SAME query key on its own timer.
    id: "P-messages-poll-focus-gated",
    file: "artifacts/banco-mobile/app/(tabs)/messages.tsx",
    test: (s) => {
      const code = s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      // The off branch must be `false`, not another number. A guard that only
      // checked for the ternary shape would pass `isFocused ? 8000 : 8000`,
      // which reads as gated and polls exactly as hard as before. Dropping the
      // import alone is not worth guarding — that is a compile error, caught a
      // layer earlier than this gate.
      return (
        /refetchInterval:\s*isFocused\s*\?\s*\d+\s*:\s*false/.test(code) &&
        !/refetchInterval:\s*\d+\s*,/.test(code)
      );
    },
    why: "The conversations list must only poll fast while on screen — the tab badge keeps the same query fresh otherwise, and new messages arrive by push",
  },
  {
    id: "P-messages-badge-owns-background-poll",
    file: "artifacts/banco-mobile/app/(tabs)/_layout.tsx",
    test: (s) => /useListConversations\([\s\S]{0,300}?refetchInterval:\s*\d+/.test(s),
    why: "The tab badge must keep its own interval — it is what stops the unread count going stale once the list screen pauses",
  },
  // The subtlest correctness property in the map, and the only one nothing
  // asserted. Panning fires a cluster request per viewport; without a monotonic
  // sequence check, a slow response for an old viewport lands after a fast one
  // for the new and repaints the map with pins from where the user used to be.
  // It fails silently — no error, no empty state, just plausible pins from the
  // wrong place — which is exactly the kind of invariant a later refactor drops
  // because nothing appears to break.
  ...[
    ["native", "artifacts/banco-mobile/components/search/SearchResultsMap.tsx"],
    ["web", "artifacts/banco-mobile/components/search/SearchResultsMap.web.tsx"],
  ].map(([variant, file]) => ({
    id: `P-map-viewport-monotonic-${variant}`,
    file,
    test: (s) => {
      const code = s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      // Both halves matter: claiming a sequence before the await orders nothing
      // on its own, and comparing against a counter that is never incremented
      // always passes.
      return (
        /const\s+seq\s*=\s*\+\+vpSeqRef\.current/.test(code) &&
        /if\s*\(\s*seq\s*!==\s*vpSeqRef\.current\s*\)\s*return/.test(code)
      );
    },
    why: "A slow cluster response must never repaint the map for a viewport the user has already left",
  })),
  // Every admin route is permission-gated today — 43 in admin.ts, 8 more in
  // import-orders.ts, plus a router-level requireAdminRole. Nothing stopped the
  // next one being added without a guard, and an unguarded admin route is not a
  // subtle bug: it is the staff surface open to any signed-in account.
  //
  // Counted structurally rather than listed, so it holds for routes that do not
  // exist yet. A named-route list would go stale the day someone adds one.
  ...[
    ["admin", "artifacts/api-server/src/routes/v1/admin.ts"],
    ["import-orders", "artifacts/api-server/src/routes/v1/import-orders.ts"],
  ].map(([name, file]) => ({
    id: `P-admin-routes-all-permission-gated-${name}`,
    file,
    test: (s) => {
      const lines = s
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .split("\n");
      let routes = 0;
      let guarded = 0;
      lines.forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;
        if (!/router\.(get|post|patch|put|delete)\(/.test(line)) return;
        routes += 1;
        // Bounded by the NEXT route, not a fixed line count. A five-line window
        // bled into the following route's guard, so a one-line ungated route
        // slipped through the negative test — it borrowed its neighbour's
        // requirePermission. The middleware chain of one route ends where the
        // next router.* call begins.
        let end = i + 1;
        while (end < lines.length && !/router\.(get|post|patch|put|delete|use)\(/.test(lines[end])) {
          end += 1;
        }
        const window = lines.slice(i, end).join(" ");
        if (/requirePermission|requireAdminRole|requireStaff|requireAuth/.test(window)) {
          guarded += 1;
        }
      });
      return routes > 0 && guarded === routes;
    },
    why: "Every route on a staff surface must carry a permission guard — an ungated one is the admin panel open to any signed-in account",
  })),
  // The owner's first rule, and nothing asserted it: publishing must never be
  // blocked. BANCO is an advertising platform before it is a taxonomy — any
  // fixed asset, a plane or a launch as readily as a car, has to be listable
  // with whatever the seller actually has. Verified end to end: the server
  // floor for `car` is `condition` alone, MIN_PHOTOS is 1, the brand is free
  // text, and the publish button is disabled only while a submit is in flight.
  // A Cessna with one photo publishes today.
  //
  // That property is one edit away from being lost. Someone adding "just one
  // required field" to the button's disabled expression would silently
  // reintroduce the gate, and no test would notice.
  {
    id: "P-publish-never-gated-by-fields",
    file: "artifacts/banco-mobile/app/listings/create.tsx",
    test: (s) => {
      const code = s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      // Exactly `submitting` — a double-publish guard, not a validation gate.
      // Any `&&`, `||` or `!` folded in is a field requirement in disguise.
      return /const publishDisabled = submitting;/.test(code);
    },
    why: "The publish button may only be disabled by an in-flight submit — never by a missing field. A seller with an unusual asset must always be able to publish and get actionable feedback instead of a frozen button",
  },
  {
    id: "P-publish-floor-stays-minimal",
    file: "artifacts/api-server/src/services/ListingService.ts",
    test: (s) => {
      const m = s.match(/const required: Record<string, string\[\]> = \{[\s\S]*?\};/);
      if (!m) return false;
      // `car` carries every movable asset — plane, boat, launch, bike. Demanding
      // mileage or fuel type there is a car assumption, not a universal truth:
      // aircraft count flight hours and marine fuel is not in the app's list.
      const car = m[0].match(/car:\s*\[([^\]]*)\]/);
      if (!car) return false;
      const keys = car[1].split(",").map((k) => k.trim()).filter(Boolean);
      return keys.length === 1 && /["']condition["']/.test(keys[0]);
    },
    why: "The car floor must stay `condition` alone — it is the section every movable asset publishes under, and mileage/fuel/year are car assumptions that block a plane or a boat outright",
  },
  {
    id: "P-bank-plan-audience-seeded",
    file: "artifacts/api-server/src/seed.ts",
    test: (s) => /slug: "bank_featured"[\s\S]{0,200}audience: "financial_institution"/.test(s),
    why: "The bank plan must stay targeted at financial_institution — pointing it at company is what originally hid it from banks (audit S5)",
  },
  // A notification row is written once and read later — there is no re-render
  // that could translate it, so the language has to be in the row. The app's
  // answer is one bilingual string, `عربي · English`. Twenty-one of twenty-two
  // call sites already did that; car import was the exception, and it is the
  // flow a buyer follows for weeks. These lock every service that notifies.
  ...[
    "AlertService",
    "BillingNotificationService",
    "BookingService",
    "CommentService",
    "CompanyService",
    "ConversationService",
    "FinancingService",
    "GlobalSupplyService",
    "ImportOrderService",
    "InvestmentService",
    "LeadService",
    "ReviewService",
    "RfqService",
    "SaveService",
  ].map((svc) => ({
    id: `P-notif-bilingual-${svc.replace(/Service$/, "").toLowerCase()}`,
    file: `artifacts/api-server/src/services/${svc}.ts`,
    test: (s) => {
      const code = s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (!/createNotification\(/.test(code)) return true;

      // Judge ONLY the copy that reaches a user: the title/body of a
      // createNotification call, plus any message map feeding one. A first
      // version scanned everything after the first call site and failed all
      // fourteen services on correct code — it was reading error messages, log
      // lines and SQL as if they were notification text.
      const spans = [];
      const call = /createNotification\(\{/g;
      let m;
      while ((m = call.exec(code))) {
        // Balance braces from the opening `{` so the span is the real argument,
        // not a fixed window that stops mid-string or swallows the next call.
        let depth = 0;
        let i = m.index + m[0].length - 1;
        for (; i < code.length; i += 1) {
          if (code[i] === "{") depth += 1;
          else if (code[i] === "}") {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        spans.push(code.slice(m.index, i + 1));
      }
      // Copy one level removed from the call. BookingService builds its strings
      // in a `const notify = isHostAction ? {...} : {...}` and passes
      // `title: notify.title`, so scanning only the call site left a whole
      // service unguarded — the negative test caught that, which is the entire
      // reason to run one.
      //
      // Extracted as a real statement (walk to the `;` at depth zero, skipping
      // string bodies) rather than a character window. A first attempt used
      // `[\s\S]{0,900}` and swallowed neighbouring code, which made
      // BillingNotificationService fail on correct source: the window reached
      // past the payload into ledger labels like "Wallet top-up", which are
      // accounting text, not notification copy.
      const decl = /\bconst\s+\w+\s*=/g;
      let d;
      while ((d = decl.exec(code))) {
        let depth = 0;
        let quote = null;
        let j = d.index + d[0].length;
        for (; j < code.length; j += 1) {
          const c = code[j];
          if (quote) {
            if (c === "\\") j += 1;
            else if (c === quote) quote = null;
            continue;
          }
          if (c === '"' || c === "'" || c === "`") quote = c;
          else if (c === "{" || c === "(" || c === "[") depth += 1;
          else if (c === "}" || c === ")" || c === "]") depth -= 1;
          else if (c === ";" && depth === 0) break;
        }
        const stmt = code.slice(d.index, j);
        // A statement holding BOTH a title and a body IS a notification payload,
        // wherever it is written. Anything else is not judged here.
        if (/\btitle:/.test(stmt) && /\bbody:/.test(stmt)) spans.push(stmt);
      }
      const mapBlock = code.match(/(?:stageMessages|MESSAGES)[^=]*=\s*\{[\s\S]*?\n {2}\};/);
      if (mapBlock) spans.push(mapBlock[0]);

      const AR = /[؀-ۿ]/;
      for (const span of spans) {
        // Every literal inside the span, not `key: "literal"` pairs. The span is
        // already precisely a notification payload, so the precision comes from
        // it — matching on the key missed BookingService entirely, where the
        // title is a multi-line ternary and no literal sits next to `title:`.
        const literals = span.match(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [];
        for (const lit of literals) {
          const bare = lit.replace(/\$\{[^}]*\}/g, "");
          // A real English phrase — two words — with no Arabic anywhere is the
          // failure. Single tokens (ids, keys, enum values) and pure
          // interpolation are caller data, not copy.
          if (/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(bare) && !AR.test(lit)) return false;
        }
      }
      return true;
    },
    why: "Notification copy is stored, not re-rendered — every user-facing string must be bilingual `عربي · English` or Arabic speakers get English-only alerts",
  })),
  // The render layer, protected the same way every other adopted fix here is.
  // It is a new layer and therefore the easiest thing in this repository to
  // lose: delete one script from a chain and 25 mounting assertions stop
  // running, while `pnpm test` still prints a wall of green from the static
  // guards that never noticed.
  {
    id: "P-render-layer-chained",
    file: "artifacts/banco-mobile/package.json",
    test: (s) => {
      const pkg = JSON.parse(s);
      return (
        typeof pkg.scripts?.["test:render"] === "string" &&
        /pnpm run test:render-coverage\b/.test(pkg.scripts?.test ?? "") &&
        /pnpm run test:render(\s|$)/.test(pkg.scripts?.test ?? "")
      );
    },
    why: "The render suite and its coverage guard must stay IN the test chain — a suite that is never invoked reads as coverage while proving nothing",
  },
  {
    id: "P-presence-render-both-halves",
    file: "artifacts/banco-mobile/components/PresenceDot.tsx",
    test: (s) => {
      // Both exports make the same promise: away and unknown indistinguishable.
      // The allow-list has to be present twice, once per renderer, and the
      // deny-list form must not creep back for either.
      const allow = s.match(
        /if \(presence !== "online" && presence !== "recently"\) return null;/g,
      );
      return (
        allow?.length === 2 &&
        !/presence === "away"/.test(s) &&
        !/presence === "unknown"/.test(s)
      );
    },
    why: "PresenceDot and PresenceLabel must BOTH refuse anything outside online/recently — half the guarantee is not the guarantee",
  },

];

function main() {
  console.log("BANCO chain-integrity-gate (source markers only)\n");
  const failed = [];
  for (const c of CHECKS) {
    const full = path.join(ROOT, c.file);
    if (!fs.existsSync(full)) {
      failed.push({ id: c.id, detail: `missing file ${c.file}` });
      console.error(`[FAIL] ${c.id}: missing file ${c.file}`);
      continue;
    }
    const src = fs.readFileSync(full, "utf8");
    if (!c.test(src)) {
      failed.push({ id: c.id, detail: c.why });
      console.error(`[FAIL] ${c.id}: ${c.why}`);
    } else {
      console.log(`[PASS] ${c.id}`);
    }
  }
  console.log(`\n--- ${CHECKS.length - failed.length}/${CHECKS.length} passed ---`);
  if (failed.length) {
    console.error("\nChain broken — do not ship until markers are restored.");
    process.exit(1);
  }
  console.log("Chain integrity OK.");
}

main();
