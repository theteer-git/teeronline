(function initTeerGameConfig(root, factory) {
  const config = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = config;
  }

  if (root) {
    root.TEER_GAME_CONFIG = config;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTeerGameConfig() {
  "use strict";

  const SITE_ORIGIN = "https://teeronline.com";
  const RESULTS_ORIGIN = "https://results.teeronline.com";

  const SECTION_IDS = Object.freeze({
    liveResult: "live_result",
    previousSevenDays: "previous_7_days",
    commonNumbers: "common_numbers",
    statistics: "statistics",
    relatedGames: "related_games"
  });

  const GAME_ORDER = Object.freeze([
    "SHD",
    "KH",
    "JWD",
    "SHM",
    "KHM",
    "JWM",
    "SHN1",
    "SHN2"
  ]);

  const GAMES = Object.freeze({
    SHD: Object.freeze({
      id: "SHD",
      name: "Shillong Teer",
      resultTitle: "Shillong Teer Result",
      navLabel: "Shillong Teer",
      primaryTopic: "Shillong Teer",
      canonicalPath: "/",
      legacyArchivePath: "/shillong-teer-previous-results",
      previousResultsPath: "/shillong-teer-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "16:15", sr: "17:15" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([0]),
      crossesMidnight: false,
      aliases: Object.freeze(["SHILLONG", "SHILLONG TEER"])
    }),
    KH: Object.freeze({
      id: "KH",
      name: "Khanapara Teer",
      resultTitle: "Khanapara Teer Result",
      navLabel: "Khanapara Teer",
      primaryTopic: "Khanapara Teer",
      canonicalPath: "/khanapara-teer-previous-results",
      legacyArchivePath: "/khanapara-teer-previous-results",
      previousResultsPath: "/khanapara-teer-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "16:25", sr: "17:00" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([0]),
      crossesMidnight: false,
      aliases: Object.freeze(["KHANAPARA", "KHANAPARA TEER"])
    }),
    JWD: Object.freeze({
      id: "JWD",
      name: "Juwai Teer",
      resultTitle: "Juwai Teer Result",
      navLabel: "Juwai Teer",
      primaryTopic: "Juwai Teer",
      canonicalPath: "/juwai-teer-previous-results",
      legacyArchivePath: "/juwai-teer-previous-results",
      previousResultsPath: "/juwai-teer-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "14:30", sr: "15:15" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([0]),
      crossesMidnight: false,
      aliases: Object.freeze(["JUWAI", "JUWAI TEER", "JUWAI DAY"])
    }),
    SHM: Object.freeze({
      id: "SHM",
      name: "Shillong Morning Teer",
      resultTitle: "Shillong Morning Teer Result",
      navLabel: "Shillong Morning",
      primaryTopic: "Shillong Morning Teer",
      canonicalPath: "/shillong-morning-teer-previous-results",
      legacyArchivePath: "/shillong-morning-teer-previous-results",
      previousResultsPath: "/shillong-morning-teer-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "10:30", sr: "11:30" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([]),
      crossesMidnight: false,
      aliases: Object.freeze(["SHILLONG MORNING", "SHILLONG MORNING TEER"])
    }),
    KHM: Object.freeze({
      id: "KHM",
      name: "Khanapara Morning Teer",
      resultTitle: "Khanapara Morning Teer Result",
      navLabel: "Khanapara Morning",
      primaryTopic: "Khanapara Morning Teer",
      canonicalPath: "/khanapara-morning-teer-previous-results",
      legacyArchivePath: "/khanapara-morning-teer-previous-results",
      previousResultsPath: "/khanapara-morning-teer-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "11:00", sr: "12:00" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([]),
      crossesMidnight: false,
      aliases: Object.freeze(["KHANAPARA MORNING", "KHANAPARA MORNING TEER"])
    }),
    JWM: Object.freeze({
      id: "JWM",
      name: "Juwai Morning Teer",
      resultTitle: "Juwai Morning Teer Result",
      navLabel: "Juwai Morning",
      primaryTopic: "Juwai Morning Teer",
      canonicalPath: "/juwai-morning-teer-previous-results",
      legacyArchivePath: "/juwai-morning-teer-previous-results",
      previousResultsPath: "/juwai-morning-teer-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "10:30", sr: "11:30" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([]),
      crossesMidnight: false,
      aliases: Object.freeze(["JUWAI MORNING", "JUWAI MORNING TEER"])
    }),
    SHN1: Object.freeze({
      id: "SHN1",
      name: "Shillong Night Teer",
      resultTitle: "Shillong Night Teer Result",
      navLabel: "Shillong Night",
      primaryTopic: "Shillong Night Teer",
      canonicalPath: "/shillong-night-teer-previous-results",
      legacyArchivePath: "/shillong-night-teer-previous-results",
      previousResultsPath: "/shillong-night-teer-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "20:45", sr: "21:45" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([]),
      crossesMidnight: false,
      aliases: Object.freeze(["SHILLONG NIGHT", "SHILLONG NIGHT TEER", "SHILLONG NIGHT 1"])
    }),
    SHN2: Object.freeze({
      id: "SHN2",
      name: "Shillong Night Teer 2",
      resultTitle: "Shillong Night Teer 2 Result",
      navLabel: "Shillong Night 2",
      primaryTopic: "Shillong Night Teer 2",
      canonicalPath: "/shillong-night-teer-2-previous-results",
      legacyArchivePath: "/shillong-night-teer-2-previous-results",
      previousResultsPath: "/shillong-night-teer-2-previous-results",
      commonNumbersPath: "/common-numbers",
      rounds: Object.freeze({ fr: "23:10", sr: "00:10" }),
      roundLabels: Object.freeze({ fr: "First Round", sr: "Second Round" }),
      weeklyOffDays: Object.freeze([]),
      crossesMidnight: true,
      aliases: Object.freeze(["SHILLONG NIGHT 2", "SHILLONG NIGHT TEER 2", "NIGHT TEER 2"])
    })
  });

  const NAVIGATION = Object.freeze([
    Object.freeze({ label: "Home", path: "/", type: "home" }),
    ...GAME_ORDER.map((id) => Object.freeze({
      label: GAMES[id].navLabel,
      path: GAMES[id].canonicalPath,
      type: "game",
      gameId: id
    })),
    Object.freeze({ label: "Dream Numbers", path: "/dream-numbers", type: "content" }),
    Object.freeze({ label: "Teer Formula", path: "/teer-formula", type: "content" })
  ]);

  const FOOTER_LINKS = Object.freeze([
    Object.freeze({ label: "About", path: "/about" }),
    Object.freeze({ label: "Contact", path: "/contact" }),
    Object.freeze({ label: "Privacy Policy", path: "/privacy-policy" }),
    Object.freeze({ label: "Terms and Conditions", path: "/terms-and-conditions" }),
    Object.freeze({ label: "Disclaimer", path: "/disclaimer" })
  ]);

  const ENDPOINTS = Object.freeze({
    latestResults: `${RESULTS_ORIGIN}/latest-results.json`,
    recentResults: `${RESULTS_ORIGIN}/recent-results.json`,
    pollingPlan: `${RESULTS_ORIGIN}/polling-plan.json`
  });

  const ALIAS_TO_GAME_ID = Object.freeze(GAME_ORDER.reduce((map, gameId) => {
    map[gameId] = gameId;
    for (const alias of GAMES[gameId].aliases) {
      map[alias] = gameId;
    }
    return map;
  }, {}));

  function getGame(gameId) {
    return GAMES[String(gameId || "").toUpperCase()] || null;
  }

  function normalizeGameId(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return ALIAS_TO_GAME_ID[normalized] || null;
  }

  function absoluteUrl(path) {
    if (!path || path === "/") return `${SITE_ORIGIN}/`;
    return `${SITE_ORIGIN}${path}`;
  }

  return Object.freeze({
    version: 1,
    siteOrigin: SITE_ORIGIN,
    resultsOrigin: RESULTS_ORIGIN,
    gameOrder: GAME_ORDER,
    games: GAMES,
    navigation: NAVIGATION,
    footerLinks: FOOTER_LINKS,
    sectionIds: SECTION_IDS,
    endpoints: ENDPOINTS,
    getGame,
    normalizeGameId,
    absoluteUrl
  });
});
