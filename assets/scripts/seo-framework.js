(function initTeerSeoFramework(root, factory) {
  const framework = factory(
    typeof module === "object" && module.exports
      ? require("./game-config.js")
      : root && root.TEER_GAME_CONFIG
  );

  if (typeof module === "object" && module.exports) module.exports = framework;
  if (root) root.TEER_SEO_FRAMEWORK = framework;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTeerSeoFramework(gameConfig) {
  "use strict";

  if (!gameConfig) throw new Error("TEER_GAME_CONFIG is required by the SEO framework.");

  const SITE = Object.freeze({
    name: "TeerOnline",
    legalName: "TeerOnline.com",
    origin: gameConfig.siteOrigin,
    language: "en-IN",
    locale: "en_IN",
    logo: `${gameConfig.siteOrigin}/assets/img/logo.webp`,
    image: `${gameConfig.siteOrigin}/assets/img/logo.webp`,
    publisherId: `${gameConfig.siteOrigin}/#organization`,
    websiteId: `${gameConfig.siteOrigin}/#website`,
    contactPath: "/contact"
  });

  const LIMITS = Object.freeze({
    titleMin: 25,
    titleMax: 65,
    descriptionMin: 90,
    descriptionMax: 165,
    faqMin: 3,
    faqMax: 12
  });

  const STATIC_PAGES = Object.freeze({
    "/dream-numbers": Object.freeze({ type: "guide", topic: "Dream Numbers", breadcrumb: "Dream Numbers" }),
    "/teer-formula": Object.freeze({ type: "guide", topic: "Teer Formula", breadcrumb: "Teer Formula" }),
    "/about": Object.freeze({ type: "about", topic: "About TeerOnline", breadcrumb: "About" }),
    "/contact": Object.freeze({ type: "contact", topic: "Contact TeerOnline", breadcrumb: "Contact" }),
    "/privacy-policy": Object.freeze({ type: "policy", topic: "Privacy Policy", breadcrumb: "Privacy Policy" }),
    "/terms-and-conditions": Object.freeze({ type: "policy", topic: "Terms and Conditions", breadcrumb: "Terms and Conditions" }),
    "/disclaimer": Object.freeze({ type: "policy", topic: "Disclaimer", breadcrumb: "Disclaimer" }),
    "/404": Object.freeze({ type: "error", topic: "Page Not Found", breadcrumb: "Page Not Found", noindex: true })
  });

  function cleanPath(value) {
    let pathname = String(value || "/").trim();
    if (!pathname.startsWith("/")) pathname = `/${pathname}`;
    pathname = pathname.replace(/\.html$/i, "");
    pathname = pathname.replace(/\/{2,}/g, "/");
    if (pathname.length > 1) pathname = pathname.replace(/\/$/, "");
    return pathname || "/";
  }

  function absoluteUrl(pathname) {
    const path = cleanPath(pathname);
    return path === "/" ? `${SITE.origin}/` : `${SITE.origin}${path}`;
  }

  function htmlFileToPath(file) {
    const name = String(file || "");
    return name === "index.html" ? "/" : cleanPath(name);
  }

  function findGameByPath(pathname) {
    const path = cleanPath(pathname);
    for (const gameId of gameConfig.gameOrder) {
      const game = gameConfig.games[gameId];
      if (cleanPath(game.canonicalPath) === path || (gameId === "SHD" && path === "/")) {
        return { gameId, game, pageKind: "live" };
      }
      if (cleanPath(game.previousResultsPath) === path) {
        return { gameId, game, pageKind: "archive" };
      }
    }
    return null;
  }

  function classify(pathname) {
    const path = cleanPath(pathname);
    const gameMatch = findGameByPath(path);
    if (gameMatch) {
      return Object.freeze({
        path,
        type: gameMatch.pageKind === "live" ? "game-live" : "game-archive",
        gameId: gameMatch.gameId,
        game: gameMatch.game,
        breadcrumb: gameMatch.pageKind === "live"
          ? `${gameMatch.game.name} Result Today`
          : `${gameMatch.game.name} Previous Results`
      });
    }
    const page = STATIC_PAGES[path];
    return page ? Object.freeze({ path, ...page }) : Object.freeze({ path, type: "other", topic: path });
  }

  function organisationNode() {
    return {
      "@type": "Organization",
      "@id": SITE.publisherId,
      name: SITE.legalName,
      url: `${SITE.origin}/`,
      logo: { "@type": "ImageObject", url: SITE.logo },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: absoluteUrl(SITE.contactPath)
      }
    };
  }

  function websiteNode() {
    return {
      "@type": "WebSite",
      "@id": SITE.websiteId,
      url: `${SITE.origin}/`,
      name: SITE.legalName,
      publisher: { "@id": SITE.publisherId },
      inLanguage: SITE.language
    };
  }

  function breadcrumbNode(pathname, label) {
    const canonical = absoluteUrl(pathname);
    const items = [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE.origin}/` }];
    if (cleanPath(pathname) !== "/") {
      items.push({ "@type": "ListItem", position: 2, name: label, item: canonical });
    }
    return {
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: items
    };
  }

  function webpageNode({ pathname, title, description, breadcrumbLabel, about = [] }) {
    const canonical = absoluteUrl(pathname);
    const node = {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      inLanguage: SITE.language,
      isPartOf: { "@id": SITE.websiteId },
      breadcrumb: { "@id": `${canonical}#breadcrumb` },
      isAccessibleForFree: true,
      publisher: { "@id": SITE.publisherId }
    };
    if (about.length) node.about = about;
    return node;
  }

  function faqNode(pathname, items) {
    if (!Array.isArray(items) || !items.length) return null;
    const canonical = absoluteUrl(pathname);
    return {
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: items.map(item => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    };
  }

  function buildGraph(input) {
    const classification = classify(input.pathname);
    const breadcrumbLabel = input.breadcrumbLabel || classification.breadcrumb || input.title;
    const graph = [
      organisationNode(),
      websiteNode(),
      webpageNode({ ...input, breadcrumbLabel }),
      breadcrumbNode(input.pathname, breadcrumbLabel)
    ];
    const faq = faqNode(input.pathname, input.faq || []);
    if (faq) {
      graph[2].mainEntity = { "@id": faq["@id"] };
      graph.push(faq);
    }
    return { "@context": "https://schema.org", "@graph": graph };
  }

  function buildMetadata({ pathname, title, description, robots, image = SITE.image }) {
    const canonical = absoluteUrl(pathname);
    const page = classify(pathname);
    const noindex = page.noindex === true;
    return Object.freeze({
      title,
      description,
      canonical,
      robots: robots || (noindex
        ? "noindex,follow"
        : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"),
      openGraph: Object.freeze({
        type: "website",
        siteName: SITE.legalName,
        locale: SITE.locale,
        url: canonical,
        title,
        description,
        image
      }),
      twitter: Object.freeze({ card: "summary_large_image", title, description, image })
    });
  }

  function validateDraft({ pathname, title, description, faq = [] }) {
    const errors = [];
    if (!pathname) errors.push("pathname is required");
    if (String(title || "").length < LIMITS.titleMin || String(title || "").length > LIMITS.titleMax) {
      errors.push(`title must contain ${LIMITS.titleMin}-${LIMITS.titleMax} characters`);
    }
    if (String(description || "").length < LIMITS.descriptionMin || String(description || "").length > LIMITS.descriptionMax) {
      errors.push(`description must contain ${LIMITS.descriptionMin}-${LIMITS.descriptionMax} characters`);
    }
    if (faq.length && (faq.length < LIMITS.faqMin || faq.length > LIMITS.faqMax)) {
      errors.push(`FAQ should contain ${LIMITS.faqMin}-${LIMITS.faqMax} visible questions when used`);
    }
    for (const [index, item] of faq.entries()) {
      if (!item || !String(item.question || "").trim() || !String(item.answer || "").trim()) {
        errors.push(`FAQ item ${index + 1} requires a question and answer`);
      }
    }
    return Object.freeze({ ok: errors.length === 0, errors });
  }

  const PAGE_PATHS = Object.freeze([
    "/",
    ...gameConfig.gameOrder.filter(id => id !== "SHD").map(id => cleanPath(gameConfig.games[id].canonicalPath)),
    ...gameConfig.gameOrder.map(id => cleanPath(gameConfig.games[id].previousResultsPath)),
    ...Object.keys(STATIC_PAGES)
  ]);

  return Object.freeze({
    version: 1,
    site: SITE,
    limits: LIMITS,
    staticPages: STATIC_PAGES,
    pagePaths: PAGE_PATHS,
    cleanPath,
    absoluteUrl,
    htmlFileToPath,
    classify,
    buildMetadata,
    buildGraph,
    validateDraft
  });
});
