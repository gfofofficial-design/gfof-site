(() => {
  const views = [...document.querySelectorAll("[data-fed-evidence]")];
  if (!views.length) return;
  const watch = new MutationObserver(load);
  for (const view of views) watch.observe(view, { attributes: true, attributeFilter: ["data-fed-readout"] });
  load();

  function load() {
    if (!views.some(view => view.hasAttribute("data-fed-readout"))) return;
    watch.disconnect();
    // The existing results and source disclosures work independently of this view.
    import("/assets/federation/fed-tool-evidence.mjs").catch(() => {});
  }
})();
