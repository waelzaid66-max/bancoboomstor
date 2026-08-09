// Guard: the render layer is wired, reachable, and actually mounts components.
//
// This guard is the load-bearing link between the static guard layer (text
// matching) and the render layer (components mounted + inspected). It was
// written because the render layer landed covering `PresenceDot` but the file
// exports TWO components that make the identical privacy promise — and covering
// one while calling the file done is how half a guarantee ships looking like a
// whole one.
//
// It defends four things, and none of them is "the source looks right":
//   1. the declared render-critical set has real render tests
//   2. those tests MOUNT — they are not static guards wearing the name
//   3. every component exported from a render-critical FILE is covered
//   4. the suite is wired into the chain and reachable by the runner
//
// Today the render suite runs via node:test + react-test-renderer (not jest),
// so the runner assertion below checks package.json's `test:render` script and
// its inclusion in the `test` chain — not jest.config.js.
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
 * anyway. This is a list, not a detector — a detector that reports the wrong
 * set reads green while proving nothing, which is the defect this whole layer
 * was built to remove, reintroduced one level up. So the set is declared, each
 * entry carries the claim it defends, and the completeness rule does the
 * automatic part.
 */
const RENDER_CRITICAL = [
  {
    file: "components/PresenceDot.tsx",
    staticGuard: "tests/presence-privacy-guard.test.mjs",
    claim:
      "away and unknown must be indistinguishable — an opt-out that announces itself is not an opt-out",
  },
  {
    file: "components/icons.tsx",
    staticGuard: "tests/icons.test.mjs",
    claim:
      "an icon whose fill is resolved wrong (the send glyph read as a V) is a render defect no static guard can see",
  },
];

/** Every *.test.tsx under tests/render, by filename. */
function renderTests() {
  const dir = join(root, "tests/render");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".test.tsx"));
}

/** PascalCase components exported from a source file. */
function exportedComponents(src) {
  return [...src.matchAll(/export function ([A-Z][A-Za-z0-9]*)\s*\(/g)].map(
    (m) => m[1],
  );
}

test("every render-critical file still exists and still has its static guard", () => {
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
        new RegExp(`<${name}[\\s/>]`).test(all) || new RegExp(`createElement\\(\\s*${name}\\b`).test(all),
        `${name} (exported from ${entry.file}) has no render test.\n` +
          `      The claim it must not break: ${entry.claim}\n` +
          `      Add a tests/render suite that mounts it — a static guard cannot prove a claim about what is drawn.`,
      );
    }
  }
});

test("a render test mounts something — it is not a static guard in disguise", () => {
  for (const file of renderTests()) {
    const src = read(`tests/render/${file}`);
    assert.match(
      src,
      /\brender\s*\(|create\s*\(/,
      `${file} never mounts — a file in tests/render that does not render ` +
        `is counted as render coverage while proving nothing`,
    );
    assert.ok(
      !/readFileSync|readFile\(/.test(src),
      `${file} reads source text. That is what tests/*.test.mjs is for; a test ` +
        `here that greps the source inherits the exact blind spot this layer exists to close`,
    );
  }
});

test("no render test drifts outside the declared set", () => {
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
  const pkg = JSON.parse(read("package.json"));
  assert.ok(
    pkg.scripts?.["test:render"],
    "test:render script is missing — the suite would never run in CI",
  );
  assert.match(
    pkg.scripts.test,
    /pnpm run test:render(\s|$)/,
    "test:render is not in the `test` chain — the suite would never run in CI",
  );
});
