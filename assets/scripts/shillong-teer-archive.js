(() => {
            "use strict";
            const $ = (id) => document.getElementById(id);
            let originalData = [],
               currentData = [],
               currentPage = 1;
            const pageSize = $("pageSize"),
               tbody = document.querySelector("#resultsTable tbody"),
               pagination = $("pagination");
            const numberSearch = $("numberSearch"),
               dateCalendar = $("dateCalendar"),
               daySearch = $("daySearch"),
               roundSearch = $("roundSearch");
            const loadingDiv = $("loadingIndicator"),
               errorDiv = $("errorMessage"),
               resultsCount = $("resultsCount");
            const GAME_NAME = "shillong day";

            function parseDate(dateStr) {
               if (!dateStr || dateStr === "0000-00-00") return null;
               let m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
               if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
               m = String(dateStr).match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
               if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
               const d = new Date(dateStr);
               return Number.isNaN(d.getTime()) ? null : d;
            }
            function ymd(d) {
               return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            }
            function dmy(d) {
               return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
            }
            function dayName(dateStr) {
               const d = parseDate(dateStr);
               return d
                  ? [
                       "Sunday",
                       "Monday",
                       "Tuesday",
                       "Wednesday",
                       "Thursday",
                       "Friday",
                       "Saturday",
                    ][d.getDay()]
                  : "";
            }
            function cleanNumber(v) {
               const s = String(v ?? "")
                  .toLowerCase()
                  .trim();
               if (["xx", "off", "—", "-", "na", ""].includes(s)) return null;
               const n = parseInt(s, 10);
               return !Number.isNaN(n) && n >= 0 && n <= 99
                  ? String(n).padStart(2, "0")
                  : null;
            }
            function extractData(raw) {
               if (!Array.isArray(raw)) return [];

               const idByName = {
                  "shillong day": "SHD",
                  "shillong teer": "SHD",
                  "khanapara day": "KH",
                  "khanapara teer": "KH",
                  "juwai day": "JWD",
                  "juwai teer": "JWD",
                  "juwai morning": "JWM",
                  "khanapara morning": "KHM",
                  "shillong morning": "SHM",
                  "shillong night": "SHN1",
                  "shillong hills night teer": "SHN1",
                  "shillong night 2": "SHN2",
                  "shillong night teer 2": "SHN2",
               };

               // FIXED: Removed "shillong day" from KH aliases to prevent data mixing
               const aliases = {
                  SHD: ["shillong day", "shillong teer"],
                  KH: ["khanapara day", "khanapara teer"],
                  JWD: ["juwai day", "juwai teer"],
                  JWM: ["juwai morning"],
                  KHM: ["khanapara morning"],
                  SHM: ["shillong morning"],
                  SHN1: ["shillong night", "shillong hills night teer"],
                  SHN2: ["shillong night 2", "shillong night teer 2"],
               };

               const targetGame = (
                  typeof GAME_NAME !== "undefined" ? GAME_NAME : "shillong day"
               )
                  .toLowerCase()
                  .trim();
               const targetId = idByName[targetGame] || "";

               return raw
                  .filter((item) => {
                     const gameId = String(
                        item.g || item.gameId || item.game_id || "",
                     )
                        .toUpperCase()
                        .trim();
                     const game = String(item.game || "")
                        .toLowerCase()
                        .trim();
                     if (targetId && gameId === targetId) return true;
                     if (
                        targetId &&
                        aliases[targetId] &&
                        aliases[targetId].includes(game)
                     )
                        return true;
                     return game === targetGame;
                  })
                  .map((item) => {
                     const fr = cleanNumber(
                        item.f || item.fr || item.first_round,
                     );
                     const sr = cleanNumber(
                        item.s || item.sr || item.second_round,
                     );
                     const date = item.d || item.date || "";
                     const d = parseDate(date);
                     return d && fr !== null && sr !== null
                        ? {
                             date,
                             dateValue: ymd(d),
                             displayDate: dmy(d),
                             day: dayName(date),
                             first_round: fr,
                             second_round: sr,
                          }
                        : null;
                  })
                  .filter(Boolean);
            }
            function updateCount() {
               const f = currentData.length,
                  t = originalData.length;
               resultsCount.textContent =
                  f === t
                     ? `📊 Showing all ${t} results`
                     : `📊 Found ${f} result${f === 1 ? "" : "s"} (filtered from ${t} total)`;
               resultsCount.style.color = f === 0 ? "#ef4444" : "var(--accent)";
            }
            function renderTable() {
               const size = parseInt(pageSize.value, 10) || 25,
                  totalPages = Math.max(
                     1,
                     Math.ceil(currentData.length / size),
                  );
               if (currentPage > totalPages) currentPage = totalPages;
               const rows = currentData.slice(
                  (currentPage - 1) * size,
                  currentPage * size,
               );
               tbody.innerHTML = rows.length
                  ? rows
                       .map(
                          (r) =>
                             `<tr><td>${r.displayDate}</td><td>${r.day}</td><td>${r.first_round}</td><td>${r.second_round}</td></tr>`,
                       )
                       .join("")
                  : '<tr><td colspan="4">No matching results found.</td></tr>';
               renderPagination(totalPages);
               updateCount();
            }
            function renderPagination(totalPages) {
               if (totalPages <= 1) {
                  pagination.innerHTML = "";
                  return;
               }
               const items = [
                  `<button class="page-btn" ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">Previous</button>`,
               ];
               const start = Math.max(1, currentPage - 2),
                  end = Math.min(totalPages, currentPage + 2);
               if (start > 1)
                  items.push(
                     '<button class="page-btn" data-page="1">1</button>',
                  );
               if (start > 2) items.push("<span>…</span>");
               for (let i = start; i <= end; i++)
                  items.push(
                     `<button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`,
                  );
               if (end < totalPages - 1) items.push("<span>…</span>");
               if (end < totalPages)
                  items.push(
                     `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`,
                  );
               items.push(
                  `<button class="page-btn" ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">Next</button>`,
               );
               pagination.innerHTML = items.join("");
            }
            function applyFilters() {
               const numberValue = numberSearch.value.trim();
               let numberFilter = null;
               if (numberValue) {
                  const n = parseInt(numberValue, 10);
                  if (Number.isNaN(n) || n < 0 || n > 99) {
                     alert("Please enter a valid number between 00 and 99");
                     return;
                  }
                  numberFilter = n;
               }
               const dateValue = dateCalendar.value,
                  dayValue = daySearch.value,
                  roundValue = roundSearch.value;
               currentData = originalData.filter((item) => {
                  if (numberFilter !== null) {
                     const fr = parseInt(item.first_round, 10),
                        sr = parseInt(item.second_round, 10);
                     if (roundValue === "fr" && fr !== numberFilter)
                        return false;
                     if (roundValue === "sr" && sr !== numberFilter)
                        return false;
                     if (
                        !roundValue &&
                        fr !== numberFilter &&
                        sr !== numberFilter
                     )
                        return false;
                  }
                  if (dateValue && item.dateValue !== dateValue) return false;
                  if (dayValue && item.day !== dayValue) return false;
                  return true;
               });
               currentPage = 1;
               renderTable();
            }
            function resetFilters() {
               numberSearch.value = "";
               dateCalendar.value = "";
               daySearch.value = "";
               roundSearch.value = "";
               currentData = originalData.slice();
               currentPage = 1;
               renderTable();
            }
            async function loadData() {
               try {
                  const res = await fetch(
                     "https://results.teeronline.com/all-results.json",
                     { cache: "default" },
                  );
                  if (!res.ok)
                     throw new Error(
                        `HTTP ${res.status} - File not found at https://results.teeronline.com/all-results.json`,
                     );
                  originalData = extractData(await res.json()).sort(
                     (a, b) => parseDate(b.date) - parseDate(a.date),
                  );
                  if (!originalData.length)
                     throw new Error(
                        `No valid "${GAME_NAME}" records found. Please check your data file.`,
                     );
                  currentData = originalData.slice();
                  const dates = originalData
                     .map((r) => r.dateValue)
                     .filter(Boolean)
                     .sort();
                  if (dates.length) {
                     dateCalendar.min = dates[0];
                     dateCalendar.max = dates[dates.length - 1];
                  }
                  loadingDiv.hidden = true;
                  loadingDiv.style.display = "none";
                  renderTable();
               } catch (err) {
                  loadingDiv.hidden = true;
                  loadingDiv.style.display = "none";
                  errorDiv.hidden = false;
                  errorDiv.style.display = "block";
                  errorDiv.innerHTML = `<strong>❌ Failed to load https://results.teeronline.com/all-results.json</strong><br><br>${err.message}<br><br>Check that the file exists and contains records with <code>"game": "${GAME_NAME}"</code>.`;
                  resultsCount.textContent = "📊 Error loading data";
                  if (!tbody.querySelector('tr[data-static-archive-row="true"]')) {
                     tbody.innerHTML =
                        '<tr><td colspan="4">Unable to load results.</td></tr>';
                  }
               }
            }
            function initDarkMode() {
               const toggle = $("darkModeToggle");
               if (!toggle) return;
               const stored = localStorage.getItem("darkMode") === "true";
               if (stored) { document.documentElement.classList.add("dark"); document.body.classList.add("dark"); }
               toggle.textContent = stored ? "☀️ Light" : "🌓 Dark";
               toggle.addEventListener("click", () => {
                  document.documentElement.classList.toggle("dark"); document.body.classList.toggle("dark", document.documentElement.classList.contains("dark"));
                  const isDark = document.body.classList.contains("dark");
                  localStorage.setItem("darkMode", isDark);
                  toggle.textContent = isDark ? "☀️ Light" : "🌓 Dark";
               });
            }
            $("applyFilters").addEventListener("click", applyFilters);
            $("resetFilters").addEventListener("click", resetFilters);
            numberSearch.addEventListener("keydown", (e) => {
               if (e.key === "Enter") applyFilters();
            });
            pageSize.addEventListener("change", () => {
               currentPage = 1;
               renderTable();
            });
            pagination.addEventListener("click", (e) => {
               const btn = e.target.closest("[data-page]");
               if (!btn || btn.disabled) return;
               currentPage = parseInt(btn.dataset.page, 10);
               renderTable();
            });
            const year = $("copyrightYear");
            if (year) year.textContent = new Date().getFullYear();
            initDarkMode();
            const start = () =>
               "requestIdleCallback" in window
                  ? requestIdleCallback(loadData, { timeout: 1500 })
                  : setTimeout(loadData, 1);
            window.addEventListener("load", start, { once: true });
            setTimeout(() => {
               const s = document.createElement("script");
               s.src =
                  "https://www.googletagmanager.com/gtag/js?id=G-R7H1L7VWZS";
               s.async = true;
               s.onload = () => {
                  window.dataLayer = window.dataLayer || [];
                  window.gtag = function () {
                     dataLayer.push(arguments);
                  };
                  gtag("js", new Date());
                  gtag("config", "G-R7H1L7VWZS");
               };
               document.head.appendChild(s);
            }, 3500);
         })();
