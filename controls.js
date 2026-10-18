'use strict';

(() => {
  const panel = document.getElementById('music-controls');
  const reveal = document.getElementById('controls-reveal');
  let timer;
  let keyboard = false;
  let pointerHeld = false;
  let selecting = false;
  function hide() {
    clearTimeout(timer);
    selecting = false;
    pointerHeld = false;
    panel.hidden = true;
    reveal.setAttribute('aria-expanded', 'false');
    reveal.setAttribute('aria-label', 'BGMの操作を表示');
    if (panel.contains(document.activeElement)) reveal.focus({ preventScroll: true });
  }
  function schedule() {
    clearTimeout(timer);
    if (panel.hidden || pointerHeld || selecting || (keyboard && panel.contains(document.activeElement))) return;
    timer = setTimeout(hide, 6000);
  }
  function show() {
    panel.hidden = false;
    reveal.setAttribute('aria-expanded', 'true');
    reveal.setAttribute('aria-label', 'BGMの操作を隠す');
    schedule();
  }
  reveal.addEventListener('click', () => { if (panel.hidden) show(); else hide(); });
  document.addEventListener('keydown', event => {
    keyboard = true;
    if (event.key === 'Escape') { selecting = false; hide(); }
    else if (!panel.hidden) schedule();
  });
  document.addEventListener('pointerdown', event => {
    keyboard = false;
    if (panel.contains(event.target)) {
      pointerHeld = true;
      if (event.target.tagName === 'SELECT') selecting = true;
      clearTimeout(timer);
    }
  });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => {
    pointerHeld = false;
    schedule();
  });
  for (const type of ['input', 'change']) panel.addEventListener(type, () => {
    selecting = false;
    schedule();
  });
  panel.addEventListener('click', schedule);
  panel.addEventListener('focusin', schedule);
  panel.addEventListener('focusout', event => {
    if (event.target.tagName === 'SELECT' || !panel.contains(event.relatedTarget)) selecting = false;
    clearTimeout(timer);
    timer = setTimeout(schedule, 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pointerHeld = false; selecting = false; hide(); }
  });
  hide();
})();
