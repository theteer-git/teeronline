"use strict";

(() => {
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function injectOverrides() {
    if (document.getElementById("teer-ux-overrides")) return;
    const style = document.createElement("style");
    style.id = "teer-ux-overrides";
    style.textContent = 'main.container>*,main.container>.hero,main.container>.page-mast,main.container>#live_result{order:unset!important}html.dark .result-monitor-ribbon__message,body.dark .result-monitor-ribbon__message,html.dark [data-rm-message],body.dark [data-rm-message]{color:#f6f1ea!important}html body .hero,html body .page-mast .hero{text-align:center!important}html body .hero p,html body .page-mast .hero p{max-width:none!important}';
    document.head.appendChild(style);
  }

  function layoutChrome() {
    injectOverrides();
    const header = document.querySelector(".sticky-header");
    const nav = document.querySelector("nav.nav-links, nav.nav, nav.primary-nav");
    const brand = header && header.querySelector(".logo-wrapper");
    const toggle = document.getElementById("darkModeToggle");
    if (brand && toggle && toggle.parentElement !== brand) brand.appendChild(toggle);
    const crumbs = document.querySelector('nav[aria-label="Breadcrumb"], nav.task4-breadcrumb');
    const main = document.querySelector("main");
    if (crumbs && main && crumbs.parentElement !== main) main.insertBefore(crumbs, main.firstChild);
    else if (crumbs && main && main.firstElementChild !== crumbs) main.insertBefore(crumbs, main.firstChild);
    const hero = main && main.querySelector(":scope > .hero, .page-mast > .hero");
    if (hero && !hero.closest(".page-mast")) {
      const mast = document.createElement("div");
      mast.className = "page-mast";
      hero.parentNode.insertBefore(mast, hero);
      mast.appendChild(hero);
    }
    const mast = main && main.querySelector(":scope > .page-mast");
    if (mast && crumbs && crumbs.nextElementSibling !== mast) crumbs.insertAdjacentElement("afterend", mast);
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
