(() => {
  const link = document.getElementById('project-permalink');
  const copy = document.getElementById('project-copy-link');
  const status = document.getElementById('project-share-status');
  if (!link || !copy || !status) return;

  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      status.textContent = 'Profile link copied.';
    } catch {
      link.focus();
      link.select();
      status.textContent = 'Profile link selected. Copy the selected address.';
    }
  });
})();
