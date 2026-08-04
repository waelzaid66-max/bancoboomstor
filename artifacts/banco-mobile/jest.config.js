/**
 * Render tests — the layer this app did not have.
 *
 * Everything in `tests/*.test.mjs` reads source files as TEXT and matches
 * patterns with regex. Not one of them imports a renderer, so a component can
 * fail at runtime — a bad import, a broken branch, an element that never
 * mounts — while all of them pass. Those guards are worth keeping: they catch
 * things a render cannot, like a colour literal escaping into a screen. But
 * they were the only layer, and "313 passing" was being read as "the app
 * works" when it means "the source text matches the expected shape".
 *
 * This config is deliberately narrow so the two layers cannot collide:
 *
 *   node --test tests/*.test.mjs     ← the static guards, untouched
 *   jest (this config)               ← tests/render/**, real mounting
 *
 * `testMatch` sees only `tests/render`, so adding a render test can never
 * change what the static chain runs, and the static chain's .mjs files are
 * never handed to babel.
 *
 * Single platform on purpose: the jest-expo default preset fans out across
 * ios/android/web as separate projects, which triples CI time to re-prove the
 * same assertion for components that contain no native branches.
 */
module.exports = {
  preset: "jest-expo/ios",
  testMatch: ["<rootDir>/tests/render/**/*.test.tsx"],
  // `@/` is a tsconfig path that Metro resolves through its own resolver.
  // Jest does not use Metro, so without this every `@/components/...` import
  // fails to resolve and the suite dies before rendering anything.
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  setupFiles: ["<rootDir>/tests/render/jest.setup.js"],
  // Two exclusions in ONE key — a second `testPathIgnorePatterns` would
  // silently replace the first rather than add to it. The .mjs guards must
  // stay with `node --test`, and the setup file is support code, not a suite.
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "\\.test\\.mjs$",
    "jest\\.setup\\.js$",
  ],
  clearMocks: true,
};
