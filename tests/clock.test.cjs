const {readFileSync}=require('node:fs');
const vm=require('node:vm'); const assert=require('node:assert/strict');
const script=readFileSync(require('node:path').join(__dirname, '../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const handlers={}, media={matches:false,addEventListener:(name,fn)=>handlers.motion=fn};
const display={style:{}}, clock={}; let next=1; const pending=new Map();
const document={hidden:false,body:{style:{}},getElementById:id=>id==='clock'?clock:display,addEventListener:(name,fn)=>handlers[name]=fn};
const context=vm.createContext({document,window:{dispatchEvent:()=>{},matchMedia:()=>media,addEventListener:(name,fn)=>handlers[name]=fn},Date,Math,Event, setTimeout:(fn,ms)=>{pending.set(next,{fn,ms});return next++},clearTimeout:id=>pending.delete(id)});
vm.runInContext(script,context);
assert.match(clock.textContent,/^\d{2}:\d{2}:\d{2}$/); assert.equal(clock.dateTime,clock.textContent);assert.equal(pending.size,1);assert.equal(display.style.backgroundColor,document.body.style.backgroundColor);
for(let i=0;i<5000;i++){
 const prev=display.style.backgroundColor;const anim=display.style.animation;vm.runInContext('tick()',context);
 assert.equal(document.body.style.backgroundColor,prev);assert.notEqual(display.style.animation,anim);
 const rgb=display.style.backgroundColor.match(/\d+/g).map(Number);const lum=rgb.reduce((s,v,i)=>{v/=255;return s+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)},0);assert.ok(1.05/(lum+.05)>=4.5);assert.equal(pending.size,1);
}
document.hidden=true;handlers.visibilitychange();assert.equal(pending.size,0);document.hidden=false;handlers.visibilitychange();assert.equal(pending.size,1);assert.equal(display.style.animation,'none');
media.matches=true;handlers.motion();assert.equal(display.style.animation,'none');assert.equal(document.body.style.backgroundColor,display.style.backgroundColor);handlers.pageshow();assert.equal(pending.size,1);
console.log('PASS: 5000 background transitions, contrast >=4.5, timer uniqueness, tab restoration, reduced motion, time format');
