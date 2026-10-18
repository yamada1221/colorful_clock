'use strict';

(() => {
  const tracks = {
    day: { title: 'スターライトパフェ', src: 'assets/audio/starlight-parfait.mp3', url: 'https://bgmer.net/music/333/' },
    night: { title: 'プラネタリウム', src: 'assets/audio/planetarium.mp3', url: 'https://bgmer.net/music/362/' }
  };
  const button = document.getElementById('music-toggle');
  const mode = document.getElementById('music-mode');
  const volume = document.getElementById('music-volume');
  const status = document.getElementById('music-status');
  const source = document.getElementById('music-source');
  let context;
  let channels;
  let enabled = false;
  let active = null;
  let revision = 0;
  let cleanup;

  // Playback stays off on every visit. Only mode and volume are remembered.
  try {
    const saved = JSON.parse(localStorage.getItem('clock-bgm') || 'null');
    if (saved && ['auto', 'day', 'night'].includes(saved.mode)) mode.value = saved.mode;
    if (saved && Number.isFinite(saved.volume)) volume.value = Math.max(0, Math.min(100, saved.volume));
  } catch (_) { /* Storage may be unavailable in private browsing. */ }

  function save() {
    try { localStorage.setItem('clock-bgm', JSON.stringify({ mode: mode.value, volume: Number(volume.value) })); } catch (_) {}
  }
  function selected() {
    const hour = new Date().getHours();
    return mode.value === 'auto' ? (hour >= 6 && hour < 18 ? 'day' : 'night') : mode.value;
  }
  function describe(key = selected()) {
    source.href = tracks[key].url;
    source.textContent = tracks[key].title;
  }
  function createChannels() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('unsupported');
    context = new AudioContextClass();
    channels = Object.fromEntries(Object.entries(tracks).map(([key, track]) => {
      const audio = new Audio(track.src);
      audio.loop = true;
      audio.preload = 'none';
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(audio).connect(gain).connect(context.destination);
      audio.addEventListener('error', () => {
        if (enabled && active === key) fail();
      });
      return [key, { audio, gain }];
    }));
  }
  function silence() {
    clearTimeout(cleanup);
    if (!channels) return;
    for (const { audio, gain } of Object.values(channels)) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      audio.pause();
    }
  }
  function stop() {
    enabled = false;
    revision++;
    silence();
    active = null;
    button.textContent = 'BGMを再生';
    button.setAttribute('aria-pressed', 'false');
    status.textContent = '停止中';
  }
  function fail() {
    stop();
    status.textContent = '再生できませんでした。再生ボタンで再試行できます';
  }
  async function play(key) {
    const request = ++revision;
    clearTimeout(cleanup);
    const previous = active;
    active = key;
    describe(key);
    status.textContent = `${tracks[key].title} を読み込み中`;
    try {
      if (!channels) createChannels();
      // Start both operations in the click handler for Safari's gesture policy.
      const resumed = context.resume();
      const started = channels[key].audio.play();
      await Promise.all([resumed, started]);
      if (!enabled || request !== revision) {
        // A newer request may be playing this same channel.
        if (!enabled || active !== key) channels[key].audio.pause();
        return;
      }
      const now = context.currentTime;
      const duration = previous && previous !== key ? 5 : 0.4;
      const target = Number(volume.value) / 100;
      for (const [name, { gain }] of Object.entries(channels)) {
        gain.gain.cancelAndHoldAtTime(now);
        gain.gain.linearRampToValueAtTime(name === key ? target : 0, now + duration);
      }
      cleanup = setTimeout(() => {
        for (const [name, { audio }] of Object.entries(channels)) {
          if (name !== active) { audio.pause(); audio.currentTime = 0; }
        }
      }, duration * 1000 + 100);
      status.textContent = `再生中：${tracks[key].title}`;
    } catch (_) {
      if (enabled && request === revision) fail();
    }
  }
  function sync() {
    const key = selected();
    describe(key);
    if (enabled && active !== key) void play(key);
  }
  button.addEventListener('click', () => {
    if (enabled) return stop();
    enabled = true;
    button.textContent = 'BGMを停止';
    button.setAttribute('aria-pressed', 'true');
    void play(selected());
  });
  mode.addEventListener('change', () => { save(); sync(); });
  volume.addEventListener('input', () => {
    save();
    if (!enabled || !channels || !active) return;
    clearTimeout(cleanup);
    const now = context.currentTime;
    for (const [name, { gain }] of Object.entries(channels)) {
      gain.gain.cancelAndHoldAtTime(now);
      gain.gain.linearRampToValueAtTime(name === active ? Number(volume.value) / 100 : 0, now + 0.1);
    }
    cleanup = setTimeout(() => {
      for (const [name, { audio }] of Object.entries(channels)) if (name !== active) audio.pause();
    }, 150);
  });
  window.addEventListener('clocktick', sync);
  window.addEventListener('pagehide', stop);
  sync();
})();
