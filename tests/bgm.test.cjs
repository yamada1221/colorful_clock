const vm = require('node:vm');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const flush = () => new Promise(resolve => setImmediate(resolve));
let hour = 12;
class FakeDate extends Date { getHours() { return hour; } }
const elements = Object.fromEntries(['music-toggle', 'music-mode', 'music-volume', 'music-status', 'music-source'].map(id => [id, {
  value: id === 'music-mode' ? 'auto' : '25', handlers: {}, attrs: {},
  addEventListener(name, fn) { this.handlers[name] = fn; },
  setAttribute(name, value) { this.attrs[name] = value; }
}]));
const events = {}, audios = [], gains = [], timers = new Map(); let timer = 0;
let playBehavior = () => Promise.resolve();
class Audio {
  constructor(src) { this.src = src; this.paused = true; this.handlers = {}; audios.push(this); }
  play() { this.paused = false; return playBehavior(); }
  pause() { this.paused = true; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
}
class AudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; }
  createGain() {
    const gain = { gain: {value: 0, cancelScheduledValues(){}, cancelAndHoldAtTime(){}, setValueAtTime(v){this.value=v;}, linearRampToValueAtTime(v,t){this.value=v;this.end=t;}}, connect(){} };
    gains.push(gain); return gain;
  }
  createMediaElementSource() { return { connect(gain) { return gain; } }; }
  resume() { return Promise.resolve(); }
}
const localStorage = {getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
const context = vm.createContext({Date:FakeDate, Audio, document:{getElementById:id=>elements[id]}, window:{AudioContext,addEventListener:(name,fn)=>events[name]=fn},localStorage,setTimeout:(fn)=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../bgm.js'),'utf8'), context);
const click = () => elements['music-toggle'].handlers.click();
(async () => {
  assert.equal(audios.length,0, 'No audio is loaded or played before a gesture');
  click();await flush();assert.equal(audios.length,2);assert.equal(audios[0].paused,false);assert.equal(gains[0].gain.value,.25);
  assert.match(elements['music-status'].textContent,/スターライトパフェ/);
  hour=18;events.clocktick();await flush();assert.equal(audios[1].paused,false);assert.equal(gains[0].gain.value,0);assert.equal(gains[1].gain.end,5);
  elements['music-volume'].value='0';elements['music-volume'].handlers.input();assert.equal(gains[1].gain.value,0);
  elements['music-volume'].value='40';elements['music-volume'].handlers.input();assert.equal(gains[1].gain.value,.4);
  click();assert.ok(audios.every(a=>a.paused));assert.equal(timers.size,0);
  // A pending playback promise must not undo a later stop.
  let resolvePlay;playBehavior=()=>new Promise(r=>resolvePlay=r);click();click();resolvePlay();await flush();assert.ok(audios.every(a=>a.paused));assert.equal(elements['music-toggle'].attrs['aria-pressed'],'false');
  playBehavior=()=>Promise.reject(Error('blocked'));click();await flush();assert.match(elements['music-status'].textContent,/再生できませんでした/);assert.ok(audios.every(a=>a.paused));
  playBehavior=()=>Promise.resolve();hour=5;click();await flush();assert.match(elements['music-status'].textContent,/プラネタリウム/);
  hour=6;events.clocktick();await flush();assert.match(elements['music-status'].textContent,/スターライトパフェ/);
  elements['music-mode'].value='night';elements['music-mode'].handlers.change();await flush();hour=12;events.clocktick();assert.match(elements['music-status'].textContent,/プラネタリウム/);
  audios[1].handlers.error();assert.equal(elements['music-toggle'].attrs['aria-pressed'],'false');assert.ok(audios.every(a=>a.paused));
  click();await flush();events.pagehide();assert.ok(audios.every(a=>a.paused));
  console.log('PASS: no autoplay, day/night boundaries, manual mode, crossfade, volume, stop races, retry, blocked storage, page exit');
})().catch(error=>{console.error(error);process.exitCode=1;});
