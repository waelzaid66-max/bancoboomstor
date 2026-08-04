/**
 * The first render test in this app.
 *
 * WHY THIS COMPONENT FIRST
 *
 * `presence-privacy-guard.test.mjs` already protects this file, and it does it
 * by reading the source as text: it checks that the renderers use an allow-list
 * rather than a deny-list, that neither branches on `away` or `unknown`, and
 * that no screen reads a raw timestamp. Those are good checks and they stay.
 *
 * But every one of them is an argument about how the code is WRITTEN. The
 * promise the feature actually makes is about what a user SEES:
 *
 *   a person who switched presence off must be indistinguishable from a person
 *   nobody has observed
 *
 * The server reports both as `unknown`, and reports a stale account as `away`.
 * The moment the UI draws anything for one that it does not draw for the other,
 * the absence of that mark announces "this person opted out" — and an opt-out
 * that announces itself is not an opt-out.
 *
 * A regex cannot see that. Someone could add a wrapper with a margin, a
 * spacer, an accessibility label, a zero-opacity view — every static assertion
 * still passes and the states stop being identical. So the central test here
 * mounts both and compares the rendered trees.
 *
 *   pnpm --filter @workspace/banco-mobile run test:render
 */
import React from "react";
import { render } from "@testing-library/react-native";

import { PresenceDot, type Presence } from "@/components/PresenceDot";

// PresenceDot needs no providers: useColors falls back to the default dark
// palette outside a ThemeProvider (ThemeContext documents this), and the
// component never calls useI18n. Mounting it bare is the real thing, not a
// stand-in.

/** The two states that must never be told apart. */
const INDISTINGUISHABLE: Presence[] = ["away", "unknown"];
/** The two the product deliberately does show. */
const MARKED: Presence[] = ["online", "recently"];

/**
 * The dot sets `accessibilityElementsHidden` and `importantForAccessibility="no"`,
 * and that is correct: it is decorative, and PresenceLabel is what actually says
 * the state out loud — a screen reader announcing a bare dot would be noise.
 *
 * React Native Testing Library excludes accessibility-hidden elements from
 * queries by default, so finding it has to be explicit. Writing the option out
 * here rather than flipping it globally keeps the fact visible: if someone
 * removes those two props, this stays green while the app starts reading a
 * decorative dot aloud — so the assertion below pins the props themselves.
 */
const HIDDEN = { includeHiddenElements: true } as const;

describe("PresenceDot", () => {
  it.each(MARKED)("draws a mark for %s", (presence) => {
    const { getByTestId } = render(<PresenceDot presence={presence} />);
    expect(getByTestId(`presence-dot-${presence}`, HIDDEN)).toBeTruthy();
  });

  it.each(MARKED)("keeps the %s mark out of the accessibility tree", (presence) => {
    const dot = render(<PresenceDot presence={presence} />).getByTestId(
      `presence-dot-${presence}`,
      HIDDEN,
    );
    expect(dot.props.accessibilityElementsHidden).toBe(true);
    expect(dot.props.importantForAccessibility).toBe("no");
  });

  it.each(INDISTINGUISHABLE)("draws nothing at all for %s", (presence) => {
    expect(render(<PresenceDot presence={presence} />).toJSON()).toBeNull();
  });

  it.each([[null], [undefined]])("draws nothing for %s", (presence) => {
    expect(render(<PresenceDot presence={presence} />).toJSON()).toBeNull();
  });

  // The one that matters. Not "both are null" — that is two separate
  // assertions and a future change could satisfy each while making them
  // differ. This compares the trees to each other, so any mark, wrapper or
  // spacer added to one and not the other fails here.
  it("renders away and unknown identically — the opt-out must not announce itself", () => {
    const away = render(<PresenceDot presence="away" />).toJSON();
    const unknown = render(<PresenceDot presence="unknown" />).toJSON();
    expect(away).toEqual(unknown);
  });

  // An opted-out account is reported as `unknown`, so it must also be
  // indistinguishable from an account that simply has no observation. Same
  // comparison, stated from the privacy side rather than the rendering side.
  it("renders unknown identically to a never-observed account", () => {
    const optedOut = render(<PresenceDot presence="unknown" />).toJSON();
    const neverSeen = render(<PresenceDot presence={null} />).toJSON();
    expect(optedOut).toEqual(neverSeen);
  });

  // Green is allowed in this component and nowhere else, and only for the
  // live state. A green "recently" would overstate what the server observed.
  it("uses the live green only for online", () => {
    const online = render(<PresenceDot presence="online" />).getByTestId(
      "presence-dot-online",
      HIDDEN,
    );
    const recently = render(<PresenceDot presence="recently" />).getByTestId(
      "presence-dot-recently",
      HIDDEN,
    );
    expect(online).toHaveStyle({ backgroundColor: "#22C55E" });
    expect(recently).toHaveStyle({ backgroundColor: "transparent" });
  });

  it("honours the size it is given, and stays a circle", () => {
    const dot = render(<PresenceDot presence="online" size={14} />).getByTestId(
      "presence-dot-online",
      HIDDEN,
    );
    expect(dot).toHaveStyle({ width: 14, height: 14, borderRadius: 7 });
  });
});
