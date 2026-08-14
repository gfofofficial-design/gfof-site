/* ═══════════════════════════════════════════════════════════════════════════
   FEDERATION OS — SHELL BEHAVIOR
   fed-shell.js · BUILD 03 · branch federation-os-v2
   ───────────────────────────────────────────────────────────────────────────
   Small vanilla JS. No dependencies. NOT loaded by any production page.

   Progressive enhancement contract:
   - Navigation is ordinary <a> elements in static markup: it works with
     JS disabled. This script only enhances drawers, the MORE sheet,
     aria-current, and the status control. It never intercepts plain links.

   Configuration contract (window.FED_SHELL_CONFIG, defined per page):
   {
     active: "command",                    // id of current system
     systems: [
       { id, label, coord, url, available }
       // url: real destination or null. null + available:false renders a
       // visibly disabled item — never an invented URL.
     ],
     status: { label: "SYSTEM STATUS", state: "unknown" }
       // state: operational | impaired | failed | unknown
       // The LABEL is supplied, never hardcoded as a factual claim here.
   }
   Production project status does NOT live in this file.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var FOCUSABLE =
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  /* ── Drawer engine ─────────────────────────────────────────────────────
     Accessible dialog: focus trap, Escape closes, focus returns to the
     trigger, scroll lock, aria semantics, reduced-motion handled in CSS. */
  function createDrawer(drawerEl, scrimEl) {
    var lastTrigger = null;

    function trap(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      var items = drawerEl.querySelectorAll(FOCUSABLE);
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }

    function open(trigger) {
      lastTrigger = trigger || document.activeElement;
      drawerEl.setAttribute("data-open", "true");
      if (scrimEl) scrimEl.setAttribute("data-open", "true");
      drawerEl.removeAttribute("aria-hidden");
      document.body.classList.add("fed-scroll-locked");
      document.addEventListener("keydown", trap);
      var target = drawerEl.querySelector("[data-drawer-initial]") ||
                   drawerEl.querySelector(FOCUSABLE);
      if (target) target.focus();
      if (trigger && trigger.setAttribute) trigger.setAttribute("aria-expanded", "true");
    }

    function close() {
      drawerEl.setAttribute("data-open", "false");
      if (scrimEl) scrimEl.setAttribute("data-open", "false");
      drawerEl.setAttribute("aria-hidden", "true");
      document.body.classList.remove("fed-scroll-locked");
      document.removeEventListener("keydown", trap);
      if (lastTrigger) {
        if (lastTrigger.setAttribute) lastTrigger.setAttribute("aria-expanded", "false");
        if (lastTrigger.focus) lastTrigger.focus();
      }
      lastTrigger = null;
    }

    if (scrimEl) scrimEl.addEventListener("click", close);
    drawerEl.querySelectorAll("[data-drawer-close]").forEach(function (btn) {
      btn.addEventListener("click", close);
    });
    drawerEl.setAttribute("aria-hidden", "true");

    return { open: open, close: close };
  }

  /* ── Shell enhancement ─────────────────────────────────────────────── */
  function enhance() {
    var cfg = window.FED_SHELL_CONFIG || {};

    /* aria-current for the active system (desktop + bottom nav) */
    if (cfg.active) {
      document
        .querySelectorAll("[data-fed-system]")
        .forEach(function (el) {
          if (el.getAttribute("data-fed-system") === cfg.active) {
            el.setAttribute("aria-current", "page");
          }
        });
    }

    /* Status control — label/state come from config, never hardcoded */
    var statusBtn = document.querySelector("[data-fed-status-trigger]");
    if (statusBtn && cfg.status) {
      var labelEl = statusBtn.querySelector("[data-fed-status-label]");
      if (labelEl && cfg.status.label) labelEl.textContent = cfg.status.label;
      if (cfg.status.state) statusBtn.setAttribute("data-state", cfg.status.state);
    }

    /* Drawers */
    function wire(triggerSel, drawerSel, scrimSel) {
      var trigger = document.querySelector(triggerSel);
      var drawerEl = document.querySelector(drawerSel);
      var scrimEl = scrimSel ? document.querySelector(scrimSel) : null;
      if (!trigger || !drawerEl) return null;
      var d = createDrawer(drawerEl, scrimEl);
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", function () { d.open(trigger); });
      return d;
    }

    wire("[data-fed-status-trigger]", "[data-fed-drawer='status']", "[data-fed-scrim='status']");
    wire("[data-fed-voss-trigger]",   "[data-fed-drawer='voss']",   "[data-fed-scrim='voss']");
    wire("[data-fed-more-trigger]",   "[data-fed-drawer='more']",   "[data-fed-scrim='more']");

    /* Footer year — static markup should carry a real year as fallback */
    var yearEl = document.querySelector("[data-fed-year]");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* Bottom-nav body padding hook */
    if (document.querySelector(".fed-shell-bottom")) {
      document.body.classList.add("fed-has-bottom-nav");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance);
  } else {
    enhance();
  }

  /* Minimal public surface for later builds */
  window.fedShell = { createDrawer: createDrawer };
})();
