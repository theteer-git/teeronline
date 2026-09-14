(() => {
  "use strict";
  // Remote visitor telemetry is intentionally disabled.
  // Ordinary visitors must not execute teer-api-v2 or any other Worker-backed
  // telemetry path. Result/Common/history delivery is handled by the public
  // static-results CDN/R2 path and the finite scheduler.
})();
