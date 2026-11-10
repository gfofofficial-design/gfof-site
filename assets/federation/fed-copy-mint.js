(() => {
  const mintPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  function bind(button, address, compact = false) {
    const status = document.createElement('span');
    status.className = compact ? 'mint-copy-status mint-copy-status--compact' : 'mint-copy-status';
    status.setAttribute('role', 'status');
    button.after(status);
    const label = compact ? button.querySelector('.ncc-txt') : null;
    let attempt = 0;
    let resetLabel;
    button.addEventListener('click', async () => {
      const turn = ++attempt;
      const mint = address.textContent.trim();
      status.textContent = '';
      clearTimeout(resetLabel);
      if (label) label.textContent = 'COPY CA';
      if (!mintPattern.test(mint)) {
        status.textContent = 'No contract address to copy.';
        return;
      }
      try {
        await navigator.clipboard.writeText(mint);
        if (turn !== attempt || address.textContent.trim() !== mint) return;
        status.textContent = 'Copied!';
        if (label) {
          label.textContent = 'COPIED';
          resetLabel = setTimeout(() => { label.textContent = 'COPY CA'; }, 1800);
        }
      } catch {
        if (turn !== attempt) return;
        status.textContent = 'Copy unavailable. Select the address to copy it manually.';
      }
    });
  }

  for (const address of document.querySelectorAll('[data-copy-mint]')) {
    const button = document.createElement('button');
    button.className = 'mint-copy-button';
    button.type = 'button';
    button.textContent = 'Copy CA';
    const link = address.closest('a');
    (link ?? address).after(button);
    bind(button, address);
  }

  for (const button of document.querySelectorAll('button[data-copy-mint-target]')) {
    const address = document.getElementById(button.dataset.copyMintTarget);
    if (address) bind(button, address, true);
  }
})();
