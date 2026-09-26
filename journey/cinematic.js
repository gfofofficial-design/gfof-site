'use strict';

(() => {
  const arrival = document.querySelector('.arrival');
  const toggle = document.getElementById('arrival-motion-toggle');
  const film = document.getElementById('arrival-film');
  const filmOpen = document.getElementById('arrival-film-open');
  const filmClose = document.getElementById('arrival-film-close');
  const filmVideo = document.getElementById('arrival-film-video');
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
    if (document.hidden && filmVideo) filmVideo.pause();
  });

  if (film && filmOpen && filmClose && filmVideo) {
    filmOpen.addEventListener('click', () => {
      if (!filmVideo.src) filmVideo.src = 'assets/journey-teaser-01.mp4';
      film.showModal();
      arrival.classList.add('is-background');
      filmVideo.play().catch(() => {});
    });
    filmClose.addEventListener('click', () => film.close());
    film.addEventListener('close', () => {
      filmVideo.pause();
      filmVideo.currentTime = 0;
      arrival.classList.toggle('is-background', document.hidden);
    });
  }

  render();
})();
