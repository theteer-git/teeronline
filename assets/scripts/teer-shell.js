"use strict";

(() => {
  const GAMES = [
    ["Shillong Teer", "/"],
    ["Khanapara Teer", "/khanapara-teer-results"],
    ["Juwai Teer", "/juwai-teer-results"],
    ["Shillong Morning", "/shillong-morning-teer-results"],
    ["Khanapara Morning", "/khanapara-morning-teer-results"],
    ["Juwai Morning", "/juwai-morning-teer-results"],
    ["Shillong Night", "/shillong-night-teer-results"],
    ["Shillong Night 2", "/shillong-night-teer-2-results"]
  ];
  const ARCHIVES = [
    ["Shillong archive", "/shillong-teer-previous-results"],
    ["Khanapara archive", "/khanapara-teer-previous-results"],
    ["Juwai archive", "/juwai-teer-previous-results"]
  ];

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function initMenu() {
    const header = document.querySelector(".sticky-header");
    const nav = document.querySelector("nav.nav-links, nav.nav, nav.primary-nav");
    if (!header || !nav || document.getElementById("teerNavToggle")) return;
    if (!nav.id) nav.id = "siteNav";
    const brand = header.querySelector(".logo-wrapper") || header.querySelector(".header-inner") || header;
    const btn = document.createElement("button");
    btn.id = "teerNavToggle";
    btn.type = "button";
    btn.className = "nav-menu-toggle";
    btn.setAttribute("aria-controls", nav.id);
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Open menu");
    btn.textContent = "Menu";
    brand.appendChild(btn);
    const close = () => {
      header.classList.remove("nav-open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Open menu");
      btn.textContent = "Menu";
    };
    btn.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      btn.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a") && window.matchMedia("(max-width: 860px)").matches) close();
    });
  }

  function addMoreGames() {
    if (document.getElementById("teer-more-games")) return;
    const main = document.querySelector("main");
    if (!main) return;
    const section = document.createElement("section");
    section.id = "teer-more-games";
    section.className = "more-games";
    section.setAttribute("aria-labelledby", "teer-more-games-heading");
    const links = [...GAMES, ...ARCHIVES, ["Dream Numbers", "/dream-numbers"], ["Teer Formula", "/teer-formula"]];
    section.innerHTML = `<h2 id="teer-more-games-heading">More Teer Results</h2><div class="more-games-grid">${links
      .map(([label, href]) => `<a href="${href}">${label}</a>`)
      .join("")}</div>`;
    main.appendChild(section);
  }

  ready(() => {
    initMenu();
    addMoreGames();
  });
})();
