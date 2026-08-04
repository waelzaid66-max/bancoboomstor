/**
 * The other half of the presence promise.
 *
 * `PresenceDot` and `PresenceLabel` are exported from the same file and make
 * the SAME guarantee — `presence-privacy-guard.test.mjs` counts two allow-list
 * guards for exactly that reason: "both the dot and the label must refuse
 * anything outside online/recently". The render layer landed covering one of
 * them. This covers the other.
 *
 * The label is the riskier of the two, not the safer one:
 *
 *   - it renders TEXT, and text is where a leak is legible. A dot that differs
 *     by one pixel of border is subtle; a label that says one word for `away`
 *     and nothing for `unknown` tells the viewer outright who opted out.
 *   - it goes through `useI18n`, so it has a whole translation table between
 *     the state and what is drawn. `t()` falls back to English, and then to the
 *     KEY ITSELF, when a string is missing — so a deleted translation does not
 *     render blank, it renders "chat.presence.away". A static guard reading
 *     this file would see nothing wrong.
 *   - unlike the dot it is NOT hidden from the accessibility tree, by design:
 *     the dot is decorative and the label is what says the state out loud. That
 *     division only holds if nobody flips it, so it is pinned here.
 *
 * Mounted inside the real `LanguageProvider`, not a stub. The provider gates
 * its children behind an async read of stored language (`ready ? children :
 * null`), so every case here waits for that gate rather than asserting on the
 * empty first frame — which would make every "renders nothing" test pass for
 * the wrong reason.
 *
 *   pnpm --filter @workspace/banco-mobile run test:render
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import { PresenceLabel, type Presence } from "@/components/PresenceDot";
import { LanguageProvider } from "@/context/LanguageContext";

/** The two states that must never be told apart. */
const INDISTINGUISHABLE: Presence[] = ["away", "unknown"];
/** The two the product deliberately does show. */
const MARKED: Presence[] = ["online", "recently"];

const LIVE = "#22C55E";

function mount(presence: Presence | null | undefined) {
  return render(
    <LanguageProvider>
      <PresenceLabel presence={presence} />
    </LanguageProvider>,
  );
}

/**
 * Wait for the provider's `ready` gate before reading the tree.
 *
 * Without this, `toJSON()` is null for EVERY state — including online — because
 * the provider has not resolved its stored-language read yet. Tests asserting
 * "renders nothing" would all pass while the component was never given a
 * chance to render anything at all.
 */
async function mountReady(presence: Presence | null | undefined) {
  const view = mount(presence);
  await waitFor(() => expect(view.toJSON()).toBeDefined());
  return view;
}

describe("PresenceLabel", () => {
  // Proves the gate above actually opens. If this fails, every "renders
  // nothing" assertion below is meaningless and should be read as such.
  it.each(MARKED)("says the state out loud for %s", async (presence) => {
    await mountReady(presence);
    expect(
      await screen.findByTestId(`presence-label-${presence}`),
    ).toBeTruthy();
  });

  it.each(MARKED)("renders a real word, never the raw key, for %s", async (presence) => {
    await mountReady(presence);
    const label = await screen.findByTestId(`presence-label-${presence}`);
    const text = String(label.props.children ?? "");
    expect(text.length).toBeGreaterThan(0);
    // `t()` returns the key when the string is missing from both trees. That is
    // a sane runtime fallback and a terrible thing to ship — "chat.presence.online"
    // in a chat header. The static guard checks the keys exist in i18n.ts; this
    // checks the component actually resolved one.
    expect(text).not.toMatch(/^chat\.presence\./);
  });

  it.each(MARKED)("keeps the %s label IN the accessibility tree", async (presence) => {
    await mountReady(presence);
    const label = await screen.findByTestId(`presence-label-${presence}`);
    // The mirror image of the dot's assertion. The dot sets these two props on
    // purpose; the label must not, or the state stops being announced at all
    // and the pair goes silent together.
    expect(label.props.accessibilityElementsHidden).toBeFalsy();
    expect(label.props.importantForAccessibility).not.toBe("no");
  });

  it.each(INDISTINGUISHABLE)("says nothing at all for %s", async (presence) => {
    const view = await mountReady(presence);
    expect(view.toJSON()).toBeNull();
  });

  it.each([[null], [undefined]])("says nothing for %s", async (presence) => {
    const view = await mountReady(presence);
    expect(view.toJSON()).toBeNull();
  });

  // The one that matters, stated as a comparison rather than as two separate
  // nulls. Two independent "is null" assertions can both be satisfied by a
  // future change that still makes the states differ — an empty string, a
  // zero-height wrapper, a lone space. Comparing the trees cannot be.
  it("renders away and unknown identically — the opt-out must not announce itself", async () => {
    const away = (await mountReady("away")).toJSON();
    const unknown = (await mountReady("unknown")).toJSON();
    expect(away).toEqual(unknown);
  });

  // An opted-out account is reported as `unknown`, so it must also be
  // indistinguishable from an account nobody has ever observed.
  it("renders unknown identically to a never-observed account", async () => {
    const optedOut = (await mountReady("unknown")).toJSON();
    const neverSeen = (await mountReady(null)).toJSON();
    expect(optedOut).toEqual(neverSeen);
  });

  // Green means "there now". `recently` is a weaker claim and must not borrow
  // the colour that overstates it. Asserted as "not the live green" rather than
  // against a specific muted value, so a palette change does not fail a test
  // about presence.
  it("uses the live green only for online", async () => {
    await mountReady("online");
    expect(await screen.findByTestId("presence-label-online")).toHaveStyle({
      color: LIVE,
    });

    await mountReady("recently");
    const recently = await screen.findByTestId("presence-label-recently");
    const flat = Object.assign({}, ...[recently.props.style].flat(2));
    expect(flat.color).not.toBe(LIVE);
  });
});
