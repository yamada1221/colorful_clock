const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const listeners = () => ({ handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } });
const panel = { ...listeners(), hidden: false, contains: node => !!node?.inside };
const reveal = { ...listeners(), attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, focus() { document.activeElement = reveal; } };
const document = { ...listeners(), hidden: false, activeElement: reveal, getElementById: id => id === 'music-controls' ? panel : reveal };
const timers = new Map(); let id = 0;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controls.js'), 'utf8'), {
  document, setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id)
});
const expire = delay => {
  const entry = [...timers].find(([, value]) => value.delay === delay);
  assert.ok(entry, `Expected timer ${delay}`);
  timers.delete(entry[0]); entry[1].fn();
};
assert.equal(panel.hidden, true);
reveal.handlers.click(); assert.equal(panel.hidden, false); assert.equal(reveal.attrs['aria-expanded'], 'true');
expire(6000); assert.equal(panel.hidden, true);
reveal.handlers.click();
const range = { inside: true, tagName: 'INPUT' };
document.handlers.pointerdown({ target: range }); assert.equal(timers.size, 0);
document.handlers.pointerup(); assert.equal(timers.size, 1);
panel.handlers.input(); assert.equal(timers.size, 1);
const select = { inside: true, tagName: 'SELECT' };
document.handlers.pointerdown({ target: select }); document.handlers.pointerup(); assert.equal(timers.size, 0);
panel.handlers.change(); expire(6000); assert.equal(panel.hidden, true);
reveal.handlers.click(); document.handlers.keydown({ key: 'Tab' }); document.activeElement = range;
panel.handlers.focusin(); assert.equal(timers.size, 0);
document.activeElement = reveal; panel.handlers.focusout({ target: range, relatedTarget: reveal }); expire(0); expire(6000);
assert.equal(panel.hidden, true);
reveal.handlers.click(); document.handlers.keydown({ key: 'Escape' }); assert.equal(panel.hidden, true);
reveal.handlers.click(); document.hidden = true; document.handlers.visibilitychange(); assert.equal(panel.hidden, true);
assert.equal(timers.size, 0);
console.log('PASS: initially hidden, reveal, 6s idle hide, drag/select/keyboard protection, Escape and tab visibility');
