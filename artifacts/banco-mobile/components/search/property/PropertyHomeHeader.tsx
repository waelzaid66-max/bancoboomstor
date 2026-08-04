/**
 * B-PROPERTIES — premium black header (visual shell).
 *
 * Stay-parity bands (A–D): back / stays / request / save · wordmark ·
 * search+filter pill · offer+Wanted · type tabs (Commercial + More pickers).
 * Country/currency (micro) + sort sit next to BANCO above the search pill.
 * Presentational only — parent owns criteria and sheets. RE-only.
 */
import { Feather, Ionicons } from "@/components/icons";
import { Image } from "expo-image";
import { AppTextInput as TextInput } from "@/components/AppTextInput";
import type { TextInput as RNTextInput } from "react-native";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { AppText } from "@/components/AppText";
import { MarketCountryButton } from "@/components/MarketCountryPicker";
import { PROPERTY_TYPES } from "@/constants/listingCreateTaxonomy";
import { useI18n } from "@/context/LanguageContext";
import { SECTION_NEUTRAL, sectionAccent } from "@/lib/sectionTheme";

const BANCO_LOGO = require("../../../assets/images/banco-logo.png");
const B_MARK = require("../../../assets/images/b-mark.png");
const PROPERTY_MARK = require("../../../assets/images/property-mark.png");

/** Neutrals come from `SECTION_NEUTRAL` — the same values every section header
 *  is built on. They used to be written out here, once per header, and they
 *  drifted: Cars ran the owner's brief palette while this one stayed on an
 *  older black and grey. A value with five homes always drifts.
 *
 *  The ACCENT stays per-section. That is the part that is meant to differ. */
const ACCENT = sectionAccent("real_estate"); // #B81E3C
const VOID = SECTION_NEUTRAL.void;
const SNOW = SECTION_NEUTRAL.snow;
const ASH = SECTION_NEUTRAL.ash;
const HAIRLINE = SECTION_NEUTRAL.hairline;

/** Scroll travel the collapse is mapped over — matched to Cars so the two
 *  sections answer a finger at the same rate. */
const COLLAPSE_SCROLL = 96;
/** The brand lockup's resting height, now that it is one row rather than three
 *  (wordmark · ruled tagline · powered-by). It still carries two short stacked
 *  lines on each side — name over tagline, caption over BANCO — so 40 is what
 *  holds them without clipping, against the 8dp rhythm this file keeps. */
const LOCKUP_HEIGHT = 40;
const LOCKUP_SCALE_MIN = 0.82;

/** Band D sentinel — opens commercial subtype picker (never sent to API). */
export const RE_COMMERCIAL_TAB = "__commercial__";
/** Band D sentinel — opens deep residential/hotel picker (never sent to API). */
export const RE_MORE_TAB = "__more__";

/** Real API property_type values under the Commercial Band D tab. */
export const RE_COMMERCIAL_TYPES = [
  "office",
  "shop",
  "warehouse",
  "commercial_land",
] as const;

/** Deep types under More — primary apartment/villa/land stay as direct tabs. */
export const RE_MORE_TYPES = [
  "studio",
  "chalet",
  "townhouse",
  "duplex",
  "penthouse",
  "hotel",
] as const;

export type PropertyTypeTab = {
  value: string;
  label: string;
};

type TypePickerKind = "commercial" | "more" | null;

type PropertyHomeHeaderProps = {
  searchOpen: boolean;
  draftQuery: string;
  searchSaved: boolean;
  activeFilterCount: number;
  activePropertyType: string;
  /** Offer axis: "all" | "sale" | "rent" */
  activeOfferKey: string;
  /** Wanted browse (`listingMode=buy`) — composes with offer. */
  wantedActive: boolean;
  /** Live propertyType for picker row highlight. */
  selectedPropertyType: string | null;
  typeTabs: PropertyTypeTab[];
  marketCountry: string;
  sort: string;
  inputRef: React.RefObject<RNTextInput | null>;
  onBack: () => void;
  onSaveSearch: () => void;
  onOpenStays: () => void;
  onOpenRequest: () => void;
  /** Open / latch map (FAB parity after desks map retirement). */
  onOpenMap: () => void;
  onOpenFilters: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onQueryChange: (text: string) => void;
  onSubmitQuery: () => void;
  onClearQuery: () => void;
  onSelectType: (value: string) => void;
  onSelectOffer: (engineKey: string) => void;
  onToggleWanted: () => void;
  onOpenMarket: () => void;
  onCycleSort: () => void;
  /**
   * Which slice to paint — the Facilities model, applied here.
   *
   *   "pinned"  everything — top bar · brand lockup · search · offer · types
   *   "scroll"  nothing today
   *   "all"     identical to "pinned"
   *
   * The blocker on this header was never the animation: BANCO lived in a brand
   * block BELOW the top bar, so splitting at the top bar alone would have sent
   * the brand down under the filter chips. Pinning the lockup WITH the top bar
   * solves it without moving a single node in the tree.
   *
   * Why "scroll" is empty. The offer axis and the type strip are the only two
   * bands that could go, and they are browse CONTROLS. The non-results overlay
   * is an absoluteFill on an opaque background, so it covers the list and its
   * ListHeaderComponent together — a control handed down there disappears in
   * precisely the state a buyer needs it, staring at zero results and wanting
   * to widen. The prop stays because the height win here comes from the lockup
   * collapsing on scroll, and because the day this header grows a hero or a
   * counts strip, that is what "scroll" is for.
   */
  slot?: "all" | "pinned" | "scroll";
  /**
   * List scroll offset, published by SearchResultsSurface. Only the pinned
   * slice reads it, and only to collapse. Optional — without it the header
   * paints expanded and never moves, exactly as before.
   */
  scrollY?: SharedValue<number>;
};

/** Names must exist in `@/components/icons` ICONS registry (Android/Expo safe). */
function tabIcon(value: string): React.ComponentProps<typeof Ionicons>["name"] {
  switch (value) {
    case "__all__":
      return "grid-outline";
    case "apartment":
      return "business-outline";
    case "villa":
      return "home";
    case RE_COMMERCIAL_TAB:
    case "office":
      return "storefront-outline";
    case "land":
      return "map-outline";
    case RE_MORE_TAB:
      return "ellipsis-horizontal";
    default:
      return "radio-button-off";
  }
}

function sortIcon(sort: string): React.ComponentProps<typeof Feather>["name"] {
  if (sort === "price_asc") return "trending-up";
  if (sort === "price_desc") return "trending-down";
  if (sort === "newest") return "clock";
  return "list";
}

export function PropertyHomeHeader({
  searchOpen,
  draftQuery,
  searchSaved,
  activeFilterCount,
  activePropertyType,
  activeOfferKey,
  wantedActive,
  selectedPropertyType,
  typeTabs,
  marketCountry,
  sort,
  inputRef,
  onBack,
  onSaveSearch,
  onOpenStays,
  onOpenRequest,
  onOpenMap,
  onOpenFilters,
  onOpenSearch,
  onCloseSearch,
  onQueryChange,
  onSubmitQuery,
  onClearQuery,
  onSelectType,
  onSelectOffer,
  onToggleWanted,
  onOpenMarket,
  onCycleSort,
  slot = "all",
  scrollY,
}: PropertyHomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const [typePicker, setTypePicker] = useState<TypePickerKind>(null);
  // Owner rule: never invent a fake 67px web pad (it destroyed headers before).
  // ~2mm tighter than Stay default — reclaim listing space (owner 2026-07-31).
  const topPad = Math.max(insets.top, Platform.OS === "web" ? 10 : 0);
  const rowDir = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";
  const sortActive = sort !== "recommended";
  const offerTabs = [
    { value: "all", label: t("search.listingModeAll") },
    { value: "sale", label: t("home.engines.sale") },
    { value: "rent", label: t("home.engines.rent") },
  ] as const;

  const handleTypePress = (value: string) => {
    if (value === RE_COMMERCIAL_TAB) {
      setTypePicker("commercial");
      return;
    }
    if (value === RE_MORE_TAB) {
      setTypePicker("more");
      return;
    }
    onSelectType(value);
  };

  const pickerOptions =
    typePicker === "commercial"
      ? RE_COMMERCIAL_TYPES
      : typePicker === "more"
        ? RE_MORE_TYPES
        : null;
  const pickerTitle =
    typePicker === "commercial"
      ? t("search.discover.section.propertyTabCommercial")
      : typePicker === "more"
        ? t("search.discover.section.deskMore")
        : "";
  const pickerTestPrefix =
    typePicker === "commercial" ? "re-commercial" : "re-more";

  const showPinned = slot === "all" || slot === "pinned";
  const showScroll = slot === "all" || slot === "scroll";

  // Collapse, same contract as Cars: read off a shared value on the UI thread,
  // interpolate, never re-render. `interpolate` is a straight mapping, so there
  // is no spring and no overshoot to bounce the brand into the top bar.
  const collapseProgress = (v?: SharedValue<number>) => {
    "worklet";
    return v
      ? interpolate(v.value, [0, COLLAPSE_SCROLL], [0, 1], Extrapolation.CLAMP)
      : 0;
  };

  // The lockup is the row that goes. It carries identity, not control — the
  // back button, the search field and the filters all live in bands that stay —
  // so it is the one row a reader can lose without losing their way.
  const lockupCollapse = useAnimatedStyle(() => {
    const p = collapseProgress(scrollY);
    return {
      opacity: 1 - p,
      height: LOCKUP_HEIGHT * (1 - p),
      transform: [{ scale: 1 + (LOCKUP_SCALE_MIN - 1) * p }],
    };
  });

  const liftCollapse = useAnimatedStyle(() => {
    const p = collapseProgress(scrollY);
    return {
      shadowOpacity: 0.18 + 0.34 * p,
      shadowRadius: 8 + 12 * p,
      elevation: 2 + 10 * p,
    };
  });

  return (
    <Animated.View
      style={[
        styles.root,
        { paddingTop: slot === "scroll" ? 0 : Math.max(0, topPad - 1) },
        showPinned && !showScroll ? styles.pinnedShell : null,
        showPinned && !showScroll ? liftCollapse : null,
      ]}
      testID={slot === "scroll" ? "re-property-scroll-band" : "re-property-header"}
    >
      {/* Band A — top actions */}
      {showPinned ? (
      <View style={[styles.topBar, { flexDirection: rowDir }]}>
        <Pressable
          onPress={onBack}
          style={styles.iconHit}
          hitSlop={12}
          testID="section-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather
            name={isRTL ? "arrow-right" : "arrow-left"}
            size={20}
            color={SNOW}
          />
        </Pressable>
        <View style={styles.topSpacer} />
        <Pressable
          onPress={onOpenMap}
          style={styles.iconHit}
          hitSlop={12}
          testID="re-header-map"
          accessibilityRole="button"
          accessibilityLabel={t("search.discover.section.deskMap")}
        >
          <Ionicons name="map" size={18} color={SNOW} />
        </Pressable>
        <Pressable
          onPress={onOpenStays}
          style={styles.iconHit}
          hitSlop={12}
          testID="re-header-stays"
          accessibilityRole="button"
          accessibilityLabel={t("search.discover.section.deskStays")}
        >
          <Ionicons name="calendar" size={18} color={SNOW} />
        </Pressable>
        <Pressable
          onPress={onOpenRequest}
          style={styles.iconHit}
          hitSlop={12}
          testID="re-header-request"
          accessibilityRole="button"
          accessibilityLabel={t("search.discover.section.deskRequest")}
        >
          <Ionicons name="document-text-outline" size={18} color={SNOW} />
        </Pressable>
        <Pressable
          onPress={onSaveSearch}
          disabled={searchSaved}
          style={styles.iconHit}
          testID="section-save-search"
          accessibilityRole="button"
        >
          <Feather
            name="bookmark"
            size={18}
            color={searchSaved ? ACCENT : SNOW}
          />
        </Pressable>
      </View>
      ) : null}

      {/* Band B — B-PROPERTIES identity. ONE row, pinned.
              It used to be three stacked rows — wordmark, then a ruled tagline,
              then a powered-by line carrying market and sort — and those three
              rows are most of why this header stood at 282dp. Nothing is
              dropped: the tagline moves under the wordmark as its second line,
              and powered-by, market and sort weld to the trailing end of the
              same row. Every control keeps its testID and its handler. */}
      {showPinned ? (
      <Animated.View
        style={[
          styles.brandLockup,
          { flexDirection: rowDir },
          slot === "all" ? null : lockupCollapse,
        ]}
        testID="re-property-brand"
      >
        <Image source={B_MARK} style={styles.wordmarkB} contentFit="contain" />
        <View style={styles.brandTextCol}>
          <AppText style={styles.wordmarkProperties} numberOfLines={1}>
            {t("search.discover.section.propertyBrand")}
          </AppText>
          <AppText style={styles.tagline} numberOfLines={1}>
            {t("search.discover.section.propertyTagline")}
          </AppText>
        </View>
        <Image
          source={PROPERTY_MARK}
          style={styles.wordmarkSeal}
          contentFit="contain"
        />

        <View style={styles.brandSpacer} />

        {/* POWERED BY is a CAPTION on the BANCO mark — stacked directly over it
            in a column as wide as the logo (58dp), not a line of its own.

            Two sessions fixed the same owner report from different structures.
            main's 8c86932 moved the label into `poweredRow` beside the logo,
            which is right for the THREE-ROW brand block it was written against.
            This branch replaced that block with a single `brandLockup` row, so
            that fix has nothing left to move: the label is already inside the
            row here. What is kept is the column rather than the side-by-side,
            because side by side the label and the mark cost ~110dp of a 358dp
            row and "PROPERTIES" truncated to "PRO…" — identity damage, which is
            the one thing this item must not do. Stacked they cost ~58dp, and
            they add no height at all: 8pt label + 14dp logo = ~24dp, under the
            32dp B-mark that already sets the row.

            FacilitiesHomeHeader is the reference for the inline shape; if the
            manager wants it here too, the swap is this block plus the style. */}
        <View style={styles.poweredCol}>
          <AppText style={styles.poweredLabel} numberOfLines={1}>
            {t("booking.poweredBy")}
          </AppText>
          <Image
            source={BANCO_LOGO}
            style={styles.poweredLogo}
            contentFit="contain"
            tintColor={ACCENT}
          />
        </View>
        {/* Market + sort stay welded to BANCO — no orphan strip, same as before. */}
        <MarketCountryButton
          selected={marketCountry}
          onPress={onOpenMarket}
          density="micro"
        />
        <Pressable
          onPress={onCycleSort}
          style={[
            styles.sortNearBanco,
            sortActive ? styles.sortNearBancoActive : null,
          ]}
          accessibilityLabel={t(`search.sortOptions.${sort}`)}
          testID="section-sort-cycle"
          hitSlop={8}
        >
          <Feather
            name={sortIcon(sort)}
            size={13}
            color={sortActive ? SNOW : ASH}
          />
        </Pressable>
      </Animated.View>
      ) : null}

      {/* Band C — search pill; filter lives inside (Stay-aligned).
              Pinned, and not negotiable: the empty and error states render as an
              absolute overlay on the results, so anything in the list is
              unreachable there. Search and filters have to stay outside it. */}
      {showPinned ? (
      searchOpen ? (
        <View style={[styles.searchPill, { flexDirection: rowDir }]}>
          <Ionicons name="search" size={17} color={ACCENT} />
          <TextInput
            ref={inputRef}
            value={draftQuery}
            onChangeText={onQueryChange}
            onSubmitEditing={onSubmitQuery}
            placeholder={t("search.discover.section.propertyWhere")}
            placeholderTextColor={ASH}
            style={[styles.searchInput, { textAlign }]}
            returnKeyType="search"
            testID="section-search-input"
            autoCorrect={false}
          />
          {draftQuery.length > 0 ? (
            <Pressable onPress={onClearQuery} hitSlop={8} testID="section-search-clear">
              <Feather name="x" size={15} color={ASH} />
            </Pressable>
          ) : (
            <Pressable onPress={onCloseSearch} hitSlop={8} testID="section-search-close">
              <Feather name="x" size={15} color={ASH} />
            </Pressable>
          )}
          <Pressable
            onPress={onOpenFilters}
            hitSlop={8}
            style={styles.filterInSearch}
            testID="section-filter-toggle"
          >
            <Feather name="sliders" size={16} color={ACCENT} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <AppText style={styles.filterBadgeText}>{activeFilterCount}</AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.searchPill, { flexDirection: rowDir }]}>
          <Pressable
            onPress={onOpenSearch}
            style={[styles.searchMainHit, { flexDirection: rowDir }]}
            testID="section-search-open"
          >
            <Ionicons name="search" size={17} color={ACCENT} />
            <AppText
              style={[
                styles.searchPlaceholder,
                {
                  textAlign,
                  color: draftQuery ? SNOW : ASH,
                },
              ]}
              numberOfLines={1}
            >
              {draftQuery || t("search.discover.section.propertyWhere")}
            </AppText>
          </Pressable>
          {draftQuery.length > 0 ? (
            <Pressable onPress={onClearQuery} hitSlop={8} testID="section-search-clear">
              <Feather name="x" size={15} color={ASH} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onOpenFilters}
            hitSlop={8}
            style={styles.filterInSearch}
            testID="section-filter-toggle"
          >
            <Feather name="sliders" size={16} color={ACCENT} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <AppText style={styles.filterBadgeText}>{activeFilterCount}</AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
      )
      ) : null}

      {/* Offer axis + Wanted (listingMode) — Wanted composes with sale/rent.
              PINNED, and this is not a preference.
              The non-results overlay is an absoluteFill on an opaque
              background, so it covers the list AND its ListHeaderComponent. A
              browse control handed to the list therefore vanishes in exactly
              the state a buyer most needs it: zero results, wanting to widen.
              The accepted pattern in this repo only ever hands DOWN identity —
              the cars hero, the B-CORE tagline — never a control. */}
      {showPinned ? (
      <View
        style={[styles.offerRow, { flexDirection: rowDir }]}
        testID="re-offer-strip"
      >
        {offerTabs.map((tab) => {
          const active = activeOfferKey === tab.value;
          return (
            <Pressable
              key={tab.value}
              onPress={() => onSelectOffer(tab.value)}
              style={[styles.offerChip, active ? styles.offerChipActive : null]}
              testID={`re-offer-${tab.value}`}
            >
              <AppText
                style={[styles.offerChipText, { color: active ? SNOW : ASH }]}
                numberOfLines={1}
              >
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onToggleWanted}
          style={[styles.offerChip, wantedActive ? styles.offerChipActive : null]}
          testID="re-offer-wanted"
        >
          <AppText
            style={[styles.offerChipText, { color: wantedActive ? SNOW : ASH }]}
            numberOfLines={1}
          >
            {t("search.listingModeBuy")}
          </AppText>
        </Pressable>
      </View>
      ) : null}

      {/* Band D — primary types only (market lives next to BANCO above search).
              Pinned for the same reason as the offer axis above. */}
      {showPinned ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabsRow, { flexDirection: rowDir }]}
        style={styles.tabsScroll}
        testID="re-type-strip"
      >
        {typeTabs.map((tab, index) => {
          const active = activePropertyType === tab.value;
          const tint = active ? ACCENT : ASH;
          return (
            <React.Fragment key={tab.value}>
              {index > 0 ? <View style={styles.tabDivider} /> : null}
              <Pressable
                onPress={() => handleTypePress(tab.value)}
                style={[styles.tabItem, active ? styles.tabItemActive : null]}
                testID={`re-type-${tab.value}`}
              >
                <Ionicons name={tabIcon(tab.value)} size={16} color={active ? SNOW : tint} />
                <AppText
                  style={[styles.tabLabel, { color: active ? SNOW : tint }]}
                  numberOfLines={1}
                >
                  {tab.label}
                </AppText>
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollView>
      ) : null}

      {/* The picker is a modal, so it belongs to whichever slice owns the strip
          that opens it — Band D, which is pinned. */}
      {showPinned ? (
      <Modal
        visible={typePicker != null}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePicker(null)}
      >
        <Pressable
          style={styles.typePickerBackdrop}
          onPress={() => setTypePicker(null)}
          testID={`re-${typePicker ?? "type"}-backdrop`}
        >
          <View style={styles.typePickerSheet} testID="re-type-picker-sheet">
            <AppText style={styles.typePickerTitle}>{pickerTitle}</AppText>
            {(pickerOptions ?? []).map((value) => {
              const def = PROPERTY_TYPES.find((p) => p.value === value);
              const label = def ? (isRTL ? def.ar : def.en) : value;
              const rowActive = selectedPropertyType === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    setTypePicker(null);
                    onSelectType(value);
                  }}
                  style={[
                    styles.typePickerRow,
                    { flexDirection: rowDir },
                    rowActive ? styles.typePickerRowActive : null,
                  ]}
                  testID={`${pickerTestPrefix}-${value}`}
                >
                  <AppText
                    style={[
                      styles.typePickerRowText,
                      rowActive ? styles.typePickerRowTextActive : null,
                    ]}
                  >
                    {label}
                  </AppText>
                  <Feather
                    name={isRTL ? "chevron-left" : "chevron-right"}
                    size={16}
                    color={rowActive ? ACCENT : ASH}
                  />
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: VOID,
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  /** Only the pinned slice — it is the piece that sits OVER the results, so it
   *  is the piece that casts a shadow. The scrolling slice is inside the list,
   *  where a shadow would trail the strips down the screen. */
  pinnedShell: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    zIndex: 10,
  },
  topBar: {
    alignItems: "center",
    minHeight: 34,
    marginBottom: 0,
  },
  topSpacer: { flex: 1 },
  iconHit: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  /** One row, replacing the three-row brandBlock. `overflow: hidden` is what
   *  lets the animated height close it cleanly instead of squashing its
   *  children on the way down. */
  brandLockup: {
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    overflow: "hidden",
  },
  /** Wordmark over tagline — the tagline's old ruled row folded into a second
   *  line here, which is where it reads as a subtitle rather than a divider. */
  brandTextCol: {
    justifyContent: "center",
    flexShrink: 1,
  },
  /** Pushes powered-by, market and sort to the trailing end, so identity leads
   *  and controls trail — the same reading order the row had when it was three. */
  brandSpacer: {
    flex: 1,
  },
  wordmarkB: {
    width: 26,
    height: 32,
  },
  wordmarkProperties: {
    // 20 → 15 with the tagline moved under it: the pair reads as one lockup at
    // this size, and it is the size at which the full word survives a 390dp row
    // beside the market control. A truncated section name is not a smaller
    // header, it is a broken one.
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: ACCENT,
    letterSpacing: 0.8,
    // Never the thing that gives: the controls beside it shrink first.
    flexShrink: 0,
  },
  wordmarkSeal: {
    width: 24,
    height: 24,
  },
  tagline: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: ASH,
  },
  // No `marginBottom`: it only made sense when this sat on a line of its own,
  // and it does not — see the caption comment on `poweredCol` above.
  poweredLabel: {
    fontSize: 8,
    fontFamily: "Inter_500Medium",
    color: ASH,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  poweredCol: {
    alignItems: "center",
    flexShrink: 0,
  },
  poweredLogo: {
    width: 58,
    height: 14,
  },
  sortNearBanco: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  sortNearBancoActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  searchPill: {
    height: 46,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
    backgroundColor: VOID,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  searchMainHit: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    minHeight: 44,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: SNOW,
    padding: 0,
  },
  filterInSearch: {
    position: "relative",
    padding: 4,
  },
  filterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9.5,
    fontFamily: "Inter_700Bold",
    color: SNOW,
  },
  offerRow: {
    marginTop: 8,
    gap: 6,
    alignItems: "center",
  },
  offerChip: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
  },
  offerChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  offerChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  typePickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  typePickerSheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    backgroundColor: "#141414",
    overflow: "hidden",
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  typePickerTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: SNOW,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  typePickerRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  typePickerRowActive: {
    backgroundColor: "rgba(184,30,60,0.14)",
  },
  typePickerRowText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: SNOW,
  },
  typePickerRowTextActive: {
    color: ACCENT,
    fontFamily: "Inter_600SemiBold",
  },
  tabsScroll: {
    marginTop: 6,
    marginHorizontal: -16,
  },
  tabsRow: {
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 0,
    minHeight: 44,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    minWidth: 62,
    gap: 3,
    borderRadius: 14,
    paddingVertical: 5,
  },
  tabItemActive: {
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  tabDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "center",
    height: 24,
    backgroundColor: HAIRLINE,
  },
});
