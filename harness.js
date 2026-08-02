/* Tally 全体チェック用ハーネス
   実物のindex.htmlからインラインJSを抽出し、DOMスタブ上で起動して
   全画面のview関数を実際に呼ぶ。v3.58で確立した方式。 */
const fs = require("fs"), vm = require("vm"), path = require("path");
/* v3.97b: 置き場所に依存しないルート探索。
   iOSのWorking Copyへ手作業で入れるとリポジトリ直下に置かれることがあるため、
   「自分と同じ階層」→「1つ上」の順に index.html を探す */
function findRoot(){
  const c = [__dirname, path.join(__dirname, "..")];
  for(const d of c){ try{ if(fs.existsSync(path.join(d,"index.html"))) return d; }catch(e){} }
  return __dirname;
}
const ROOT = findRoot();

function makeEl(tag){
  const el = {
    tagName:(tag||"div").toUpperCase(), _html:"", children:[], dataset:{}, style:{},
    classList:{ _s:new Set(), add(x){this._s.add(x);}, remove(x){this._s.delete(x);},
                toggle(x,on){ if(on===undefined){ this._s.has(x)?this._s.delete(x):this._s.add(x); } else { on?this._s.add(x):this._s.delete(x); } },
                contains(x){return this._s.has(x);} },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); },
    get textContent(){ return this._html.replace(/<[^>]*>/g,""); },
    set textContent(v){ this._html = String(v); },
    get offsetHeight(){ return 60; },
    scrollTop:0, scrollHeight:1000, value:"", checked:false,
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ return c; },
    insertAdjacentHTML(pos,h){ this._html += h; },
    setAttribute(k,v){ if(k.indexOf("data-")===0) this.dataset[k.slice(5)]=v; },
    getAttribute(){ return null; },
    removeAttribute(){},
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    focus(){}, blur(){}, click(){ if(this.onclick) this.onclick({stopPropagation(){},preventDefault(){},target:this}); },
    scrollIntoView(){}, closest(){ return null; },
    getBoundingClientRect(){ return {top:0,left:0,width:390,height:60,bottom:60,right:390}; },
    onclick:null, oninput:null, onchange:null
  };
  return el;
}

function buildContext(){
  const els = {};
  const doc = {
    _els: els,
    documentElement: Object.assign(makeEl("html"), { style:{ setProperty(){}, getPropertyValue(){return "";} } }),
    body: Object.assign(makeEl("body"), {}),
    head: makeEl("head"),
    createElement: t => makeEl(t),
    createTextNode: t => makeEl("span"),
    getElementById(id){ if(!els[id]) els[id]=makeEl("div"); return els[id]; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){},
    execCommand(){ return true; },
    visibilityState:"visible", hidden:false,
    cookie:""
  };
  const store = {};
  const localStorage = {
    getItem:k=>(k in store? store[k]:null),
    setItem:(k,v)=>{ store[k]=String(v); },
    removeItem:k=>{ delete store[k]; },
    key:i=>Object.keys(store)[i],
    get length(){ return Object.keys(store).length; }
  };
  const ctx = {
    console,
    document: doc,
    localStorage,
    location:{ href:"https://sai2943.github.io/Tally/", search:"", hash:"", reload(){} },
    navigator:{ userAgent:"harness", serviceWorker:{ register(){ return Promise.resolve({addEventListener(){}}); }, addEventListener(){}, ready:Promise.resolve({}) }, share(){ return Promise.resolve(); }, canShare(){ return false; }, clipboard:{ writeText(){ return Promise.resolve(); } }, onLine:true },
    screen:{ width:390, height:874 },
    innerWidth:390, innerHeight:812,
    visualViewport:{ height:812, width:390, addEventListener(){} },
    devicePixelRatio:3,
    setTimeout(fn,ms){ return 0; },            /* 非同期は発火させない(起動時fetch等を止める) */
    clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    requestAnimationFrame(){ return 0; },
    fetch(){ return Promise.resolve({ ok:true, json:()=>Promise.resolve({}), text:()=>Promise.resolve("") }); },
    alert(){}, confirm(){ return true; }, prompt(){ return null; },
    matchMedia(){ return { matches:false, addEventListener(){}, addListener(){} }; },
    Image: function(){ return makeEl("img"); },
    URL:{ createObjectURL(){ return "blob:x"; }, revokeObjectURL(){} },
    Blob: function(){ return {}; },
    FileReader: function(){ return { readAsText(){}, addEventListener(){} }; },
    XMLHttpRequest: function(){ return { open(){}, send(){}, setRequestHeader(){} }; },
    performance:{ now:()=>Date.now() },
    crypto:{ getRandomValues(a){ for(let i=0;i<a.length;i++) a[i]=i; return a; } },
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    __harness:true
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

function extractJS(path){
  const html = fs.readFileSync(path,"utf8");
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  return blocks.join("\n;\n");
}

module.exports = { buildContext, extractJS, makeEl };
