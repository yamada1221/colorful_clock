'use strict';

(() => {
  const tracks = {
    day: { period: 'day', title: 'スターライトパフェ', src: 'assets/audio/starlight-parfait.mp3', url: 'https://bgmer.net/music/333/' },
    night: { period: 'night', title: 'プラネタリウム', src: 'assets/audio/planetarium.mp3', url: 'https://bgmer.net/music/362/' },
    day2: { period: 'day', title: '廻想のレコード', src: 'assets/audio/recollection-record.mp3', url: 'https://bgmer.net/music/339/' },
    day3: { period: 'day', title: '千光年先へ', src: 'assets/audio/thousand-light-years.mp3', url: 'https://bgmer.net/music/292/' },
    night2: { period: 'night', title: 'ヒーリングファイア', src: 'assets/audio/healing-fire.mp3', url: 'https://bgmer.net/music/360/' },
    night3: { period: 'night', title: '宇宙の誕生', src: 'assets/audio/birth-of-universe.mp3', url: 'https://bgmer.net/music/359/' }
  };
  const button = document.getElementById('music-toggle');
  const modeButtons = document.querySelectorAll('[data-mode]');
  const picker = document.getElementById('music-track');
  const volume = document.getElementById('music-volume');
  const status = document.getElementById('music-status');
  const source = document.getElementById('music-source');
  let context;
  let channels;
  let enabled = false;
  let active = null;
  let revision = 0;
  let cleanup;
  let selectedMode = 'auto';
  const cursor = { day: 'day', night: 'night' };

  // Playback stays off on every visit. Only mode and volume are remembered.
  try {
    const saved = JSON.parse(localStorage.getItem('clock-bgm') || 'null');
    if (saved && ['auto', 'day', 'night'].includes(saved.mode)) selectedMode = saved.mode;
    if (saved && Number.isFinite(saved.volume)) volume.value = Math.max(0, Math.min(100, saved.volume));
  } catch (_) { /* Storage may be unavailable in private browsing. */ }

  function save() {
    try { localStorage.setItem('clock-bgm', JSON.stringify({ mode: selectedMode, volume: Number(volume.value) })); } catch (_) {}
  }
  function period() {
    const hour = new Date().getHours();
    return selectedMode === 'auto' ? (hour >= 6 && hour < 18 ? 'day' : 'night') : selectedMode;
  }
  function selected() { return cursor[period()]; }
  // Give the quiet end of the slider more resolution; zero stays fully silent.
  function volumeGain() {
    const value = Number(volume.value);
    const level = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;
    return level * level;
  }
  function setPlaybackState(state) {
    button.dataset.state = state;
    button.setAttribute('aria-pressed', String(state === 'playing'));
    button.setAttribute('aria-busy', String(state === 'loading'));
    const label = state === 'playing' ? 'BGMを停止' : state === 'loading' ? '読み込みを中止' : 'BGMを再生';
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  function describe(key = selected()) {
    source.href = tracks[key].url;
    source.textContent = tracks[key].title;
    const currentPeriod = tracks[key].period;
    if (picker.dataset.period !== currentPeriod) {
      picker.innerHTML = Object.entries(tracks).filter(([, track]) => track.period === currentPeriod)
        .map(([id, track]) => `<option value="${id}">${track.title}</option>`).join('');
      picker.dataset.period = currentPeriod;
    }
    picker.value = key;
    for (const item of modeButtons) item.setAttribute('aria-pressed', String(item.dataset.mode === selectedMode));
  }
  function createChannels() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('unsupported');
    context = new AudioContextClass();
    channels = Object.fromEntries(Object.entries(tracks).map(([key, track]) => {
      const audio = new Audio(track.src);
      audio.loop = false;
      audio.preload = 'none';
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(audio).connect(gain).connect(context.destination);
      audio.addEventListener('error', () => {
        if (enabled && active === key) fail();
      });
      audio.addEventListener('ended', () => {
        if (!enabled || active !== key) return;
        const list = Object.keys(tracks).filter(id => tracks[id].period === period());
        cursor[period()] = list[(list.indexOf(key) + 1) % list.length];
        void play(selected());
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
    setPlaybackState('stopped');
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
    if (!previous) setPlaybackState('loading');
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
      const target = volumeGain();
      for (const [name, { gain }] of Object.entries(channels)) {
        gain.gain.cancelAndHoldAtTime(now);
        gain.gain.linearRampToValueAtTime(name === key ? target : 0, now + duration);
      }
      cleanup = setTimeout(() => {
        for (const [name, { audio }] of Object.entries(channels)) {
          if (name !== active) { audio.pause(); audio.currentTime = 0; }
        }
      }, duration * 1000 + 100);
      setPlaybackState('playing');
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
    void play(selected());
  });
  for (const item of modeButtons) item.addEventListener('click', () => {
    selectedMode = item.dataset.mode;
    save();
    sync();
  });
  picker.addEventListener('change', () => {
    if (!tracks[picker.value] || tracks[picker.value].period !== period()) return;
    cursor[period()] = picker.value;
    sync();
  });
  volume.addEventListener('input', () => {
    save();
    if (!enabled || !channels || !active) return;
    clearTimeout(cleanup);
    const now = context.currentTime;
    for (const [name, { gain }] of Object.entries(channels)) {
      gain.gain.cancelAndHoldAtTime(now);
      gain.gain.linearRampToValueAtTime(name === active ? volumeGain() : 0, now + 0.1);
    }
    cleanup = setTimeout(() => {
      for (const [name, { audio }] of Object.entries(channels)) if (name !== active) audio.pause();
    }, 150);
  });
  window.addEventListener('clocktick', sync);
  window.addEventListener('pagehide', stop);
  sync();
})();
