'use strict';

(() => {
  const arrival = document.querySelector('.arrival');
  const toggle = document.getElementById('arrival-motion-toggle');
  if (!arrival || !toggle) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !reducedMotion.matches;
  let userChoseMotion = false;

  function render() {
    arrival.classList.toggle('is-paused', !playing);
    arrival.classList.toggle('motion-opt-in', userChoseMotion && playing);
    toggle.textContent = playing ? 'Pause motion' : 'Play motion';
    toggle.setAttribute('aria-pressed', String(!playing));
  }

  toggle.addEventListener('click', () => {
    playing = !playing;
    userChoseMotion = true;
    render();
  });

  reducedMotion.addEventListener('change', event => {
    if (userChoseMotion) return;
    playing = !event.matches;
    render();
  });

  document.addEventListener('visibilitychange', () => {
    arrival.classList.toggle('is-background', document.hidden);
  });

  render();
})();
