// The render layer needs a guard of its own, and the reason is the same reason
// the render layer exists.
//
// Every other file in this directory reads source as text. That layer was the
// ONLY layer until `tests/render/` landed, and "313 passing" was being read as
// "the app works" when it meant "the source text matches the expected shape".
// The render layer fixes that for the components it covers — and then inherits
// the exact same problem one level up: nothing says which components need it,
// nothing says the tests actually mount anything, and nothing says the suite
// runs at all. A render test that is never executed is worth less than no test,
// because it reads as coverage.
//
// So this guard defends four things, and none of them is "the source looks
// right":
//
//   1. the declared render-critical set has real render tests
//   2. those tests MOUNT — they are not static guards wearing the name
//   3. every component exported from a render-critical FILE is covered
//   4. the suite is wired into the chain and reachable by jest's config
//
// (3) is the one with teeth. It is what caught `PresenceLabel`: the render
// layer landed covering `PresenceDot` and the file exports TWO components that
// make the identical privacy promise — `presence-privacy-guard.test.mjs` counts
// two allow-list guards for exactly that reason. Half the promise was proved.
// Under this rule, adding a component to a render-critical file fails the build
// until it is covered, without anyone having to notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

/**
 * The render-critical set.
 *
 * A component belongs here when its promise is about what is DRAWN and a text
 * match cannot prove it — where a wrapper, a spacer, an empty string or a
 * zero-opacity view would satisfy every static assertion and break the promise
 * anyway.
 *
 * This is a list, not a detector, and that is deliberate. An earlier version of
 * this guard tried to infer the set by scanning the static guards for claim
 * vocabulary ("identical", "draws nothing", "must not announce"). It matched
 * `production-wiring-guard` on a line about `maintainVisibleContentPosition`.
 * A detector that reports the wrong set reads green while proving nothing —
 * which is the defect this whole layer was built to remove, reintroduced one
 * level up. So the set is declared, each entry carries the claim it defends,
 * and the completeness rule below does the automatic part.
 */
const RENDER_CRITICAL = [
  {
    file: "components/PresenceDot.tsx",
    staticGuard: "tests/presence-privacy-guard.test.mjs",
    claim:
      "away and unknown must be indistinguishable — an opt-out that announces itself is not an opt-out",
  },
];

/** Every *.test.tsx under tests/render, by filename. */
function renderTests() {
  const dir = join(root, "tests/render");
  return readdirSync(dir).filter((f) => f.endsWith(".test.tsx"));
}

/** PascalCase components exported from a source file. */
function exportedComponents(src) {
  return [...src.matchAll(/export function ([A-Z][A-Za-z0-9]*)\s*\(/g)].map(
    (m) => m[1],
  );
}

test("every render-critical file still exists and still has its static guard", () => {
  // The two layers are complements, not replacements. If a file moves, this
  // fails here rather than letting the rules below silently match nothing.
  for (const entry of RENDER_CRITICAL) {
    assert.ok(
      existsSync(join(root, entry.file)),
      `${entry.file} moved — update RENDER_CRITICAL, do not delete the entry`,
    );
    assert.ok(
      existsSync(join(root, entry.staticGuard)),
      `${entry.staticGuard} is gone — the static guard for ${entry.file} must stay; ` +
        `the render layer catches what text cannot, not the other way round`,
    );
  }
});

test("every component exported from a render-critical file is mounted somewhere", () => {
  // The completeness rule. Not "the file has a test" — "each thing the file
  // exports is rendered". PresenceDot.tsx exports PresenceDot and PresenceLabel
  // and they make the same promise; covering one and calling the file done is
  // how half a guarantee ships looking like a whole one.
  const suites = renderTests().map((f) => read(`tests/render/${f}`));
  const all = suites.join("\n");

  for (const entry of RENDER_CRITICAL) {
    const components = exportedComponents(read(entry.file));
    assert.ok(
      components.length > 0,
      `${entry.file} exports no component — update RENDER_CRITICAL`,
    );
    for (const name of components) {
      assert.ok(
        new RegExp(`<${name}[\\s/>]`).test(all),
        `${name} (exported from ${entry.file}) has no render test.\n` +
          `      The claim it must not break: ${entry.claim}\n` +
          `      Add tests/render/${name}.render.test.tsx that mounts it — a static ` +
          `guard cannot prove a claim about what is drawn.`,
      );
    }
  }
});

test("a render test mounts something — it is not a static guard in disguise", () => {
  for (const file of renderTests()) {
    const src = read(`tests/render/${file}`);
    assert.match(
      src,
      /\brender\s*\(/,
      `${file} never calls render() — a file in tests/render that does not mount ` +
        `is counted as render coverage while proving nothing`,
    );
    assert.ok(
      !/readFileSync|readFile\(/.test(src),
      `${file} reads source text. That is what tests/*.test.mjs is for; a test ` +
        `here that greps the source inherits the exact blind spot this layer exists to close`,
    );
    assert.match(
      src,
      /@testing-library\/react-native/,
      `${file} does not use the render library the suite is configured for`,
    );
  }
});

test("no render test drifts outside the declared set", () => {
  // The inverse of the completeness rule. A render test for a component nobody
  // declared render-critical is not wrong — but it means the list has stopped
  // describing the set, and the list is what the next person reads.
  const declared = new Set(
    RENDER_CRITICAL.flatMap((e) => exportedComponents(read(e.file))),
  );
  for (const file of renderTests()) {
    const name = file.replace(/\.render\.test\.tsx$/, "");
    assert.ok(
      declared.has(name),
      `tests/render/${file} covers ${name}, which is not in RENDER_CRITICAL. ` +
        `Add it with the claim it defends, so the set stays readable.`,
    );
  }
});

test("the render suite actually runs — it is chained, not merely present", () => {
  // The whole point of the assignment. A suite that exists and is never invoked
  // is coverage on paper: it goes stale, it breaks, and nobody hears it.
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts?.["test:render"], "test:render script is missing");
  assert.match(
    pkg.scripts.test,
    /pnpm run test:render(\s|$)/,
    "test:render is not in the `test` chain — the suite would never run in CI",
  );
});

test("jest's config can still see the render tests, and only those", () => {
  const cfg = read("jest.config.js");
  assert.match(
    cfg,
    /testMatch:\s*\[[^\]]*tests\/render/,
    "testMatch no longer reaches tests/render — every suite here would be skipped silently",
  );
  // The two layers must not collide in either direction: jest must not try to
  // run the .mjs guards (they are for `node --test`), and the .mjs chain must
  // not try to run the .tsx suites.
  assert.match(
    cfg,
    /\\\\\.test\\\\\.mjs\$|\\.test\\.mjs\$/,
    "the .mjs guards are no longer excluded from jest — they belong to node --test",
  );
});
