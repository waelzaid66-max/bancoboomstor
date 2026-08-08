import type { Category } from "@workspace/taxonomy/categories";

/**
 * Per-section accent tokens — each browse category is its own "company"
 * visually, not only on Discover cards. Accents stay in the BANCO red/charcoal
 * family so publish chrome never fights brand, but active Search tabs/chips
 * shift enough that cars ≠ real-estate ≠ facilities ≠ materials.
 */
// ⚑ IDENTITY RULE (user-locked): BANCO's visual identity is THE LOGO RED and
// its derivatives — every section color is a red-family derivative. Sections
// differentiate through DEPTH and slight warmth shifts (small percentages),
// never by leaving the red family. An earlier palette (burnt orange / bronze /
// magenta) came from a misread report and is corrected here. The single
// deliberate exception is Banks & Financiers (trust-blue, below).
export const SECTION_ACCENT: Record<Category, string> = {
  all: "#B4121A",
  car: "#CC1E24", // the vivid flagship red, nearest the logo
  real_estate: "#B81E3C", // crimson — a touch cooler, same red family
  facilities: "#BE3222", // warm red — a slight ember hint, still red
  materials: "#A82A1C", // deep brick red — darkest of the family
};

export function sectionAccent(category: Category | null | undefined): string {
  if (!category) return SECTION_ACCENT.all;
  return SECTION_ACCENT[category] ?? SECTION_ACCENT.all;
}

/**
 * The accent at a whisper — for the tinted disc behind an icon, a soft chip
 * ground, a hairline border.
 *
 * These are the places identity leaks. `const RED = sectionAccent("car")` gets
 * audited because it is named; the same red written `rgba(229,57,53,0.12)`
 * three hundred lines down inside a StyleSheet does not. Seven of those
 * survived the import hub's migration to the token for exactly that reason —
 * they were the OLD Material red (`#E53935`, ΔE ≈ 19 from the logo) in a
 * notation no audit was reading.
 *
 * A tint has no identity of its own. It is the section's accent, quieter.
 */
// sectionAccentAlpha is defined once, further down (the clamped implementation).
// A second, un-clamped copy used to live here and landed via a clean merge (no
// conflict markers), so two `export function sectionAccentAlpha` sat in one
// module — a TS2323 (cannot redeclare) + TS2393 (duplicate implementation) build
// break. Removed; the canonical clamped definition below is the only one.

/**
 * Banks & Financiers is its own world — the ONLY section that steps outside the
 * red family, into a trust-blue. It is not a feed `Category`, so it lives here
 * as a standalone key (`SectionKey`) used by the business hub + finance surfaces.
 * A confident mid-blue that still keeps white foreground contrast.
 */
export const BANKS_ACCENT = "#1668B5";

export type SectionKey = Category | "banks" | "industrial";

/**
 * Two-stop identity gradients (accent → deeper shade of the SAME hue). These are
 * the section-indicating BACKDROP every card falls back to when a listing has no
 * photo — so a card is never a blank grey box; it always says which world it is.
 */
export const SECTION_GRADIENT: Record<SectionKey, readonly [string, string]> = {
  all: ["#B4121A", "#7E0C12"],
  car: ["#CC1E24", "#8E1519"],
  real_estate: ["#B81E3C", "#7A1226"],
  facilities: ["#BE3222", "#7E1F14"],
  materials: ["#A82A1C", "#6E1A10"],
  industrial: ["#B22E1F", "#731D11"],
  banks: ["#1E7BD0", "#0E4C92"],
};

/**
 * The GROUND a section's hero sits on — not its accent.
 *
 * SECTION_GRADIENT above is the accent at full strength: right for a card that
 * must shout which world it belongs to, far too loud behind a screenful of
 * text. A hero needs the same hue at a whisper, so a section still reads as
 * itself without the copy fighting the backdrop.
 *
 * These three stops were written by hand inside the import hub, where no audit
 * would ever have found them. They live here now because that is where a
 * section's identity is decided, and because the next hero that needs a ground
 * should take one rather than invent one.
 *
 * The ramp is deliberately not derived by math from the accent: a computed tint
 * of a red this saturated goes muddy brown at low luminance. These are chosen
 * values that hold the hue.
 */
export const SECTION_HERO_RAMP: Record<"car", readonly [string, string, string]> = {
  car: ["#1A0A0C", "#2A0E12", "#151518"],
};

/**
 * The section's motif icon (Ionicons name), drawn large + faint on the backdrop
 * so the world reads instantly even with no product photo.
 */
// Names MUST exist in the custom icon registry (components/icons.tsx), which
// maps a subset of Ionicons/MaterialCommunity names to lucide SVGs. Unmapped
// names silently render the fallback warning glyph — every value here is a
// confirmed-mapped name.
export const SECTION_MOTIF: Record<SectionKey, string> = {
  all: "grid",
  car: "car",
  real_estate: "home",
  facilities: "business",
  materials: "package",
  industrial: "cog",
  banks: "credit-card",
};

export function sectionGradient(key: string | null | undefined): readonly [string, string] {
  if (!key) return SECTION_GRADIENT.all;
  return SECTION_GRADIENT[key as SectionKey] ?? SECTION_GRADIENT.all;
}

export function sectionMotif(key: string | null | undefined): string {
  if (!key) return SECTION_MOTIF.all;
  return SECTION_MOTIF[key as SectionKey] ?? SECTION_MOTIF.all;
}

/**
 * The neutrals every section header is built on.
 *
 * They were written out five times — once per header — and drifted, which is
 * what always happens to a value with five homes. Cars moved to the owner's
 * 2026-08-02 brief palette and the other four stayed on the older one, so the
 * app was quietly running two greys and two blacks at the same time:
 *
 *     Cars                          #090909 · #A5A5A5 · hairline 0.06
 *     Property · Materials ·        #000000 · #8E8E93 · hairline 0.16
 *     Facilities · Stays
 *
 * The values here are the brief's, verbatim. That is not a preference — the
 * owner specified them, Cars already ships them by that decision, and the job
 * of this constant is to stop the other headers disagreeing with it.
 *
 * Why not pure black. #090909 is a hair off it so a card, a sheet or a pinned
 * bar laid on top has something to be lighter THAN. On a true #000000 ground
 * every surface above it has to invent its own separation, which is where four
 * different hairline opacities came from in the first place.
 *
 * The accent is deliberately NOT here. That belongs to SECTION_ACCENT above,
 * where each world keeps its own — these are the parts that must not differ.
 */
export const SECTION_NEUTRAL = {
  /** Page ground. */
  void: "#090909",
  /** One step up — the plane a pinned bar or a sheet sits on. */
  secondary: "#121212",
  /** Two steps up — cards, pills, the search field. */
  surface: "#181818",
  /** Primary text. */
  snow: "#FFFFFF",
  /** Secondary text: labels, captions, the inactive half of a chip row. */
  ash: "#A5A5A5",
  /** Tertiary text — still readable, never a heading. */
  steel: "#C7C7CC",
  /** The only divider. Four different opacities existed before this line. */
  hairline: "rgba(255,255,255,0.06)",
} as const;

/**
 * A section's accent at a given opacity — for tinted grounds and soft borders.
 *
 * This exists because an auditor found the hole it closes. The import screens
 * were unified onto `sectionAccent("car")`, and the guard written to hold them
 * there matched `#RRGGBB` — so seven values that had been written as
 * `rgba(229,57,53,…)` sailed straight through it. Same wrong red, different
 * notation, and a guard that read as green while the thing it guarded was
 * broken.
 *
 * Deriving the channels from the token means the tint cannot disagree with the
 * accent it is meant to be a tint OF, and there is no second literal to miss.
 */
export function sectionAccentAlpha(
  category: Category | null | undefined,
  alpha: number,
): string {
  const hex = sectionAccent(category);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Clamped: an out-of-range alpha from a caller would render an invalid CSS
  // colour, which React Native drops silently — an invisible element rather
  // than an obvious mistake.
  const a = Math.max(0, Math.min(Number(alpha) || 0, 1));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
