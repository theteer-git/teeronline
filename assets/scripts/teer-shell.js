"use strict";

(() => {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function layoutChrome() {
    const header = document.querySelector(".sticky-header");
    const nav = document.querySelector("nav.nav-links, nav.nav, nav.primary-nav");
    const brand = header && header.querySelector(".logo-wrapper");
    const toggle = document.getElementById("darkModeToggle");
    if (brand && toggle && toggle.parentElement !== brand) brand.appendChild(toggle);
    const main = document.querySelector("main");
    const hero = main && main.querySelector(":scope > .hero");
    const crumbs = main && main.querySelector(":scope > .task4-breadcrumb");
    if (hero && !document.querySelector(".page-mast")) {
      const mast = document.createElement("div");
      mast.className = "page-mast";
      if (crumbs) mast.appendChild(crumbs);
      mast.appendChild(hero);
      const live = main.querySelector("#live_result, [data-semantic-section='live_result']");
      if (live) main.insertBefore(mast, live.nextSibling);
      else main.insertBefore(mast, main.firstChild);
    }
    document.querySelectorAll(".more-games, #teer-more-games").forEach((node) => node.remove());
    if (!header || !nav || document.getElementById("teerNavToggle")) return;
    if (!nav.id) nav.id = "siteNav";
    const btn = document.createElement("button");
    btn.id = "teerNavToggle";
    btn.type = "button";
    btn.className = "nav-menu-toggle";
    btn.setAttribute("aria-controls", nav.id);
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Open menu");
    btn.textContent = "Menu";
    (brand || header).appendChild(btn);
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

  ready(() => {
    layoutChrome();
  });
})();
