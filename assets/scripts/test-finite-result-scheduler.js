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
  TEER_GAME_CONFIG: { getGame: () => ({ rounds: { fr: "15:30", sr: "16:30" }, weeklyOffDays: [0], crossesMidnight: false }) },
  document: { documentElement: { classList }, body: { classList, dataset: { gameId: "SHD" } }, getElementById: () => null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  console: { error() {}, warn() {} }, Intl, Date, Math, Object, String, RegExp,
  setTimeout: () => 0, clearTimeout() {}, navigator: { onLine: true }, addEventListener() {}
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "game-unified-page.js" });

const fallback = hooks.roundTarget("fr", "2026-09-14");
assert.equal(fallback.targetAt, Date.parse("2026-09-14T15:30:00+05:30"), "missing/malformed plan falls back to the declared FR time");
const wrongDatePlan = { businessDate: "2026-09-13", games: { SHD: { rounds: { fr: {
  expectedDate: "2026-09-13", windowStart: "2026-09-13T15:00:00+05:30", windowEnd: "2026-09-13T16:00:00+05:30",
  beforeMinutes: 30, predictedOffsetMinutes: 0
} } } } };
assert.equal(hooks.roundTarget("fr", "2026-09-14", wrongDatePlan).targetAt, fallback.targetAt,
  "wrong-business-date plan falls back without extending automatic checks");
assert.equal(hooks.roundTarget("fr", "2026-09-14", { games: { SHD: { rounds: { fr: { expectedDate: "2026-09-14" } } } } }).targetAt,
  fallback.targetAt, "malformed plan falls back without creating a retry loop");
assert.equal(hooks.parsePlanTimestamp("2026-09-14T16:15:00+05:30"), Date.parse("2026-09-14T16:15:00+05:30"), "IST-offset plan timestamp is accepted");
assert.equal(hooks.parsePlanTimestamp("2026-09-14T10:45:00Z"), Date.parse("2026-09-14T10:45:00Z"), "UTC plan timestamp is accepted");
assert.ok(Number.isNaN(hooks.parsePlanTimestamp("2026-09-14T16:15:00")), "timezone-less plan timestamp is rejected");
assert.ok(Number.isNaN(hooks.parsePlanTimestamp("not-a-timestamp")), "malformed plan timestamp is rejected");
assert.equal(hooks.isOffDay("2026-09-13"), true, "SHD is off on Sunday");
assert.equal(hooks.isOffDay("2026-09-14"), false, "SHD resumes normal finite checks on Monday");
const validPlan = { businessDate: "2026-09-14", games: { SHD: { rounds: { fr: {
  expectedDate: "2026-09-14", windowStart: "2026-09-14T15:00:00+05:30", windowEnd: "2026-09-14T16:00:00+05:30",
  beforeMinutes: 30, predictedOffsetMinutes: 2
} } } } };
const planned = hooks.roundTarget("fr", "2026-09-14", validPlan);
assert.equal(planned.targetAt, Date.parse("2026-09-14T15:32:00+05:30"), "valid current plan supplies T0");
assert.equal(planned.thirdDelayMs, 45000, "third plan check remains bounded at 45 seconds");

const nightHooks = {};
const nightContext = {
  ...context,
  __TEER_TEST_HOOKS__: nightHooks,
  TEER_GAME_CONFIG: { getGame: () => ({ rounds: { fr: "23:10", sr: "00:10" }, weeklyOffDays: [], crossesMidnight: true }) },
  document: { documentElement: { classList }, body: { classList, dataset: { gameId: "SHN2" } }, getElementById: () => null, addEventListener() {} }
};
nightContext.globalThis = nightContext;
vm.runInNewContext(source, nightContext, { filename: "game-unified-page.js" });
assert.equal(nightHooks.fallbackRoundTarget("sr", "2026-09-14").targetAt,
  Date.parse("2026-09-15T00:10:00+05:30"), "SHN2 SR fallback remains on the next clock date for its business date");
assert.equal(nightHooks.currentBusinessDate(new Date("2026-09-14T18:40:00Z")), "2026-09-14",
  "SHN2 after-midnight SR window retains the previous business date");
assert.equal(nightHooks.currentBusinessDate(new Date("2026-09-15T05:01:00Z")), "2026-09-15",
  "SHN2 rolls to the next business date only after its established morning boundary");

const morningHooks = {};
const morningContext = {
  ...context,
  __TEER_TEST_HOOKS__: morningHooks,
  TEER_GAME_CONFIG: { getGame: () => ({ rounds: { fr: "10:30", sr: "11:30" }, weeklyOffDays: [], crossesMidnight: false }) },
  document: { documentElement: { classList }, body: { classList, dataset: { gameId: "SHM" } }, getElementById: () => null, addEventListener() {} }
};
morningContext.globalThis = morningContext;
vm.runInNewContext(source, morningContext, { filename: "game-unified-page.js" });
assert.equal(morningHooks.isOffDay("2026-09-13"), false, "morning games remain active on Sunday");

function harness({ completeOn = null, completeAt = {}, canRun = () => true, offDay = () => false, target = () => ({ targetAt: 1000, thirdDelayMs: 30000 }) } = {}) {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const calls = [];
  const complete = { fr: false, sr: false };
  const scheduler = hooks.createFiniteRoundScheduler({
    now: () => now,
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: now + delay, cancelled: false }); return id; },
    clearTimeout(id) { const timer = timers.get(id); if (timer) timer.cancelled = true; },
    canRun, isOffDay: offDay, isComplete: round => complete[round],
    target,
    async check(round) {
      calls.push(round);
      if (round === completeOn || calls.filter(value => value === round).length === completeAt[round]) complete[round] = true;
    }
  });
  return { scheduler, timers, calls, complete, setNow: value => { now = value; }, async runAll() {
    for (const [, timer] of [...timers.entries()].sort((a, b) => a[1].at - b[1].at)) if (!timer.cancelled) await timer.fn();
  } };
}

(async () => {
  const never = harness();
  never.scheduler.armAll();
  assert.equal(never.timers.size, 6, "FR and SR get exactly three precomputed timers each");
  assert.equal([...never.timers.values()].map(timer => timer.at).sort((a, b) => a - b).join(","),
    "1000,1000,9000,9000,31000,31000", "each round uses T0, T0+8 seconds, and one bounded third check");
  await never.runAll();
  assert.equal(never.scheduler.state().attempts.fr, 3, "FR stops after its third automatic check");
  assert.equal(never.scheduler.state().attempts.sr, 3, "SR stops after its third automatic check");
  assert.equal(never.timers.size, 6, "callbacks create no recursive timers");

  // A duplicated browser timer callback cannot consume a fourth automatic
  // request for either round.
  const duplicate = harness();
  duplicate.scheduler.armAll();
  const frTimers = [...duplicate.timers.values()].filter(timer => timer.at === 1000 || timer.at === 9000 || timer.at === 31000);
  await frTimers[0].fn();
  await frTimers[0].fn();
  await frTimers[1].fn();
  await frTimers[2].fn();
  assert.equal(duplicate.scheduler.state().attempts.fr, 3, "duplicate timer callbacks cannot exceed the FR budget");

  const first = harness({ completeOn: "fr" });
  first.scheduler.armAll();
  await first.runAll();
  assert.equal(first.scheduler.state().attempts.fr, 1, "a T0 result cancels FR checks two and three");
  assert.equal(first.scheduler.state().attempts.sr, 3, "FR completion does not replenish or alter SR budget");

  const second = harness({ completeAt: { fr: 2 } });
  second.scheduler.armAll();
  await second.runAll();
  assert.equal(second.scheduler.state().attempts.fr, 2, "a second-check result cancels the third FR check");

  const third = harness({ completeAt: { fr: 3 } });
  third.scheduler.armAll();
  await third.runAll();
  assert.equal(third.scheduler.state().attempts.fr, 3, "a third-check result is accepted without a fourth/window-end check");

  const hidden = harness({ canRun: () => false });
  hidden.scheduler.armAll();
  assert.equal(hidden.timers.size, 0, "hidden/offline state arms no scheduled network checks");
  assert.equal(await hidden.scheduler.reconcile(), false, "hidden/offline reconciliation is suppressed");

  const paused = harness();
  paused.scheduler.armAll();
  paused.scheduler.cancelAll();
  await paused.runAll();
  assert.equal(paused.scheduler.state().attempts.fr, 0, "hidden/offline cancellation prevents FR requests");
  assert.equal(paused.scheduler.state().attempts.sr, 0, "hidden/offline cancellation prevents SR requests");

  const resume = harness();
  assert.equal(await resume.scheduler.reconcile(), true, "resume/reconnect permits one reconciliation");
  for (let index = 0; index < 100; index += 1) {
    assert.equal(await resume.scheduler.reconcile(), false, "repeat resume/reconnect restores timers without another request");
  }
  assert.equal(resume.scheduler.state().attempts.fr, 0, "reconciliation never replenishes FR budget");
  assert.equal(resume.scheduler.state().attempts.sr, 0, "reconciliation never replenishes SR budget");
  assert.equal(resume.calls.filter(value => value === "reconcile").length, 1, "100 resume/reconnect events make one bounded reconciliation request");

  let online = false;
  const recovered = harness({
    canRun: () => online,
    completeAt: {},
    offDay: () => false,
    target: round => round === "fr" ? { targetAt: 1000, thirdDelayMs: 30000 } : { targetAt: 60000, thirdDelayMs: 30000 }
  });
  recovered.scheduler.armAll();
  assert.equal(recovered.timers.size, 0, "offline state owns no pending timers");
  online = true;
  recovered.setNow(40000);
  await recovered.scheduler.reconcile();
  assert.equal(recovered.calls.filter(value => value === "reconcile").length, 1, "recovery performs one current-state read");
  assert.equal(recovered.scheduler.state().attempts.fr, 0, "recovery does not consume FR budget");
  assert.equal(recovered.scheduler.state().attempts.sr, 0, "recovery does not consume SR budget");
  assert.equal(recovered.scheduler.state().pending, 3, "recovery restores only the still-future SR checks");

  const guard = hooks.createResponseGuard();
  const requestA = guard.begin();
  const requestB = guard.begin();
  assert.equal(guard.isCurrent(requestA), false, "late request A cannot apply after newer request B begins");
  assert.equal(guard.isCurrent(requestB), true, "newest request B remains eligible to apply");
  assert.equal(hooks.preservesResultProgress({ gameId: "SHD", businessDate: "2026-09-14", fr: "41", sr: "" }, { gameId: "SHD", businessDate: "2026-09-14", fr: "41", sr: "72" }), false,
    "a stale FR-only payload cannot replace an already displayed SR");
  assert.equal(hooks.preservesResultProgress({ gameId: "SHD", businessDate: "2026-09-14", fr: "41", sr: "72" }, { gameId: "SHD", businessDate: "2026-09-14", fr: "41", sr: "" }), true,
    "a newer SR payload may advance an FR-only display");

  const elapsed = harness();
  elapsed.setNow(32000);
  elapsed.scheduler.armAll();
  assert.equal(elapsed.timers.size, 0, "a page opened after the finite window schedules no catch-up loop");

  const offDay = harness({ offDay: () => true });
  offDay.scheduler.armAll();
  assert.equal(offDay.timers.size, 0, "weekly off day has zero scheduled result checks");

  console.log("Finite result scheduler tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
