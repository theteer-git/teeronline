"use strict";

const assert = require("node:assert/strict");
const config = require("./game-config.js");

const EXPECTED_IDS = ["SHD", "KH", "JWD", "SHM", "KHM", "JWM", "SHN1", "SHN2"];
const EXPECTED_PATHS = {
  SHD: "/",
  KH: "/khanapara-teer-results",
  JWD: "/juwai-teer-results",
  SHM: "/shillong-morning-teer-results",
  KHM: "/khanapara-morning-teer-results",
  JWM: "/juwai-morning-teer-results",
  SHN1: "/shillong-night-teer-results",
  SHN2: "/shillong-night-teer-2-results"
};
const EXPECTED_ROUNDS = {
  SHD: { fr: "16:15", sr: "17:15" },
  KH: { fr: "16:25", sr: "17:00" },
  JWD: { fr: "14:30", sr: "15:15" },
  SHM: { fr: "10:30", sr: "11:30" },
  KHM: { fr: "11:00", sr: "12:00" },
  JWM: { fr: "10:30", sr: "11:30" },
  SHN1: { fr: "20:45", sr: "21:45" },
  SHN2: { fr: "23:10", sr: "00:10" }
};

function isTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

assert.equal(config.version, 1);
assert.deepEqual(config.gameOrder, EXPECTED_IDS);
assert.deepEqual(Object.keys(config.games), EXPECTED_IDS);
assert.equal(new Set(config.gameOrder).size, 8, "game IDs must be unique");

const canonicalPaths = new Set();
for (const gameId of EXPECTED_IDS) {
  const game = config.getGame(gameId);
  assert.ok(game, `${gameId} must exist`);
  assert.equal(game.id, gameId);
  assert.equal(game.canonicalPath, EXPECTED_PATHS[gameId]);
  assert.deepEqual(game.rounds, EXPECTED_ROUNDS[gameId]);
  assert.ok(isTime(game.rounds.fr), `${gameId} FR time invalid`);
  assert.ok(isTime(game.rounds.sr), `${gameId} SR time invalid`);
  assert.ok(game.name.length > 3);
  assert.ok(game.navLabel.length > 2);
  assert.ok(game.primaryTopic.length > 3);
  assert.ok(Array.isArray(game.weeklyOffDays));
  assert.ok(game.weeklyOffDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6));
  assert.equal(typeof game.crossesMidnight, "boolean");
  assert.ok(Array.isArray(game.aliases));
  assert.equal(config.normalizeGameId(gameId), gameId);

  assert.ok(!canonicalPaths.has(game.canonicalPath), `duplicate canonical: ${game.canonicalPath}`);
  canonicalPaths.add(game.canonicalPath);
}

assert.deepEqual(config.games.SHD.weeklyOffDays, [0]);
assert.deepEqual(config.games.KH.weeklyOffDays, [0]);
assert.deepEqual(config.games.JWD.weeklyOffDays, [0]);
assert.equal(config.games.SHN2.crossesMidnight, true);
assert.equal(config.games.SHN2.rounds.sr, "00:10");
assert.equal(config.games.SHD.legacyArchivePath, "/shillong-teer-previous-results");
assert.equal(config.games.JWD.legacyArchivePath, "/juwai-teer-previous-results");
assert.equal(config.games.JWD.previousResultsPath, "/juwai-teer-previous-results");

assert.equal(config.navigation.length, 11);
assert.equal(config.navigation[0].label, "Home");
assert.equal(config.navigation[1].gameId, "SHD");
assert.equal(config.navigation[8].gameId, "SHN2");
assert.equal(config.navigation[9].path, "/dream-numbers");
assert.equal(config.navigation[10].path, "/teer-formula");

assert.deepEqual(Object.values(config.sectionIds), [
  "live_result",
  "previous_7_days",
  "common_numbers",
  "statistics",
  "related_games"
]);

assert.equal(config.endpoints.latestResults, "https://results.teeronline.com/latest-results.json");
assert.equal(config.endpoints.recentResults, "https://results.teeronline.com/recent-results.json");
assert.equal(config.endpoints.pollingPlan, "https://results.teeronline.com/polling-plan.json");
assert.equal(Object.prototype.hasOwnProperty.call(config.endpoints, "allResults"), false);

assert.equal(config.absoluteUrl("/"), "https://teeronline.com/");
assert.equal(
  config.absoluteUrl("/juwai-teer-results"),
  "https://teeronline.com/juwai-teer-results"
);

console.log("Game configuration validation: PASS");
console.log(`Games validated: ${EXPECTED_IDS.length}`);
console.log(`Unique canonical paths: ${canonicalPaths.size}`);
console.log("SHN2 midnight policy: PASS");
console.log("Approved navigation order: PASS");
console.log("Approved semantic section IDs: PASS");
console.log("Public JSON endpoint boundary: PASS");
