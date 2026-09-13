"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "game-unified-page.js"), "utf8");
const hooks = {};
const classList = { toggle() {}, contains() { return false; } };
const context = {
  __TEER_TEST_HOOKS__: hooks,
  TEER_GAME_CONFIG: { getGame: () => ({ rounds: { fr: "15:30", sr: "16:30" } }) },
  document: {
    documentElement: { classList },
    body: { classList, dataset: { gameId: "SHD" } },
    getElementById: () => null,
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  console: { error() {}, warn() {} },
  Intl,
  Date,
  Math,
  Object,
  String,
  RegExp,
  setTimeout: () => 0,
  clearTimeout() {}
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "game-unified-page.js" });

const version = "a".repeat(64);
const same = { gameId: "SHD", businessDate: "2026-09-13", v: version };
const immutable = {
  gameId: "SHD",
  businessDate: "2026-09-13",
  version,
  game: { publicationDate: "2026-09-13", commonNumbers: { direct: ["41"] } }
};

assert.equal(hooks.pointerCacheMatches(same, same, true), true, "matching payload and pointer skip the large reload");
assert.equal(hooks.pointerCacheMatches({ ...same, v: "b".repeat(64) }, same, true), false, "changed version refetches");
assert.equal(hooks.pointerCacheMatches({ ...same, businessDate: "2026-09-14" }, same, true), false, "changed business date refetches");
assert.equal(hooks.pointerCacheMatches(same, null, true), false, "missing cache refetches");
assert.equal(hooks.pointerCacheMatches(same, { ...same, v: "invalid" }, true), false, "corrupt cache refetches");
assert.equal(hooks.pointerCacheMatches(same, same, false), false, "mismatched payload refetches");
assert.equal(hooks.shouldFetchCommonNumbers({ ...same, available: false }), false, "unavailable pointer never fetches an immutable object");
assert.equal(hooks.shouldFetchCommonNumbers({ ...same, available: true }), true, "available pointer may fetch its immutable object");
assert.equal(
  hooks.commonNumbersPayloadUrl({ ...same, objectKey: `common-numbers/SHD/${version}.json` }),
  `https://static-results.teeronline.com/common-numbers/SHD/${version}.json`,
  "Common Numbers pointer selects an immutable versioned object"
);
assert.throws(
  () => hooks.commonNumbersPayloadUrl({ ...same, objectKey: `common-numbers/KH/${version}.json` }),
  /object key is invalid/,
  "cross-game object keys fail closed"
);
assert.throws(
  () => hooks.commonNumbersPayloadUrl({ available: true, gameId: "SHD", businessDate: "2026-09-13", v: version }),
  /object key is invalid/,
  "an available pointer without an immutable key fails closed"
);
assert.throws(
  () => hooks.commonNumbersPayloadUrl({ ...same, objectKey: `common-numbers/SHD/${"b".repeat(64)}.json` }),
  /object key is invalid/,
  "a pointer cannot select a different immutable version"
);
assert.equal(hooks.isValidImmutableCommonNumbersPayload(immutable, same), true, "valid immutable Common Numbers payload is accepted");
assert.equal(hooks.isValidImmutableCommonNumbersPayload({ ...immutable, gameId: "KH" }, same), false, "wrong-game immutable payload is rejected");
assert.equal(hooks.isValidImmutableCommonNumbersPayload({ ...immutable, businessDate: "2026-09-12" }, same), false, "wrong-date immutable payload is rejected");
assert.equal(hooks.isValidImmutableCommonNumbersPayload({ ...immutable, version: "b".repeat(64) }, same), false, "wrong-version immutable payload is rejected");
assert.equal(hooks.isValidImmutableCommonNumbersPayload({ ...immutable, game: null }, same), false, "corrupt immutable payload is rejected");

console.log("Public read-cache contract tests: PASS");
