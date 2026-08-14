/* ═══════════════════════════════════════════════════════════════════════════
   FEDERATION OS — COMMAND PREVIEW BEHAVIOR
   fed-command.js · BUILD 04 · branch federation-os-v2
   ───────────────────────────────────────────────────────────────────────────
   Vanilla JS, no dependencies. Enhancement only:
   - Seal arrival class (CSS handles motion; reduced-motion static)
   - Federation Network: activate node → mirror description, emphasize line
   - Section reveals via IntersectionObserver (static without JS)
   Nothing here fetches data or fabricates state.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Seal arrival */
  var seal = document.querySelector(".cmd-seal");
  if (seal) {
    if (reduced) { seal.classList.add("is-arrived"); }
    else { requestAnimationFrame(function () { seal.classList.add("is-arrived"); }); }
  }

  /* Federation Network */
  var net = document.querySelector(".cmd-net");
  if (net) {
    var nodes = net.querySelectorAll(".cmd-net__node");
    var panelTitle = document.querySelector("[data-net-title]");
    var panelCoord = document.querySelector("[data-net-coord]");
    var panelBody  = document.querySelector("[data-net-body]");
    var defaults = panelBody ? {
      title: panelTitle.textContent,
      coord: panelCoord.textContent,
      body:  panelBody.textContent
    } : null;

    function activate(node) {
      nodes.forEach(function (n) { n.setAttribute("aria-pressed", n === node ? "true" : "false"); });
      if (node) {
        net.setAttribute("data-active", node.getAttribute("data-system"));
        if (panelBody) {
          panelTitle.textContent = node.querySelector(".cmd-net__label").textContent;
          panelCoord.textContent = node.querySelector("small").textContent;
          panelBody.textContent  = node.querySelector(".cmd-net__desc").textContent;
        }
      } else {
        net.removeAttribute("data-active");
        if (panelBody && defaults) {
          panelTitle.textContent = defaults.title;
          panelCoord.textContent = defaults.coord;
          panelBody.textContent  = defaults.body;
        }
      }
    }

    nodes.forEach(function (node) {
      node.addEventListener("click", function () {
        activate(node.getAttribute("aria-pressed") === "true" ? null : node);
      });
      node.addEventListener("focus", function () { activate(node); });
      node.addEventListener("mouseenter", function () { activate(node); });
    });
    net.addEventListener("mouseleave", function () {
      if (!net.querySelector('[aria-pressed="true"]:focus')) activate(null);
    });
  }

  /* Section reveals — skipped entirely under reduced motion (CSS is static) */
  if (!reduced && "IntersectionObserver" in window) {
    var els = document.querySelectorAll(".cmd-reveal");
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-revealed"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    els.forEach(function (el) { obs.observe(el); });
    /* Safety: force-reveal anything still hidden after 3s */
    setTimeout(function () {
      document.querySelectorAll(".cmd-reveal:not(.is-revealed)").forEach(function (el) {
        el.classList.add("is-revealed");
      });
    }, 3000);
  } else {
    document.querySelectorAll(".cmd-reveal").forEach(function (el) {
      el.classList.add("is-revealed");
    });
  }
})();
