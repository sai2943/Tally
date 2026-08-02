/* 計算の不変量・データ整合のチェック(実物の関数を直接呼ぶ) */
const vm = require("vm");
const { buildContext, extractJS } = require("./harness");
const fs = require("fs"), path = require("path");
/* v3.97b: 置き場所に依存しないルート探索。
   iOSのWorking Copyへ手作業で入れるとリポジトリ直下に置かれることがあるため、
   「自分と同じ階層」→「1つ上」の順に index.html を探す */
function findRoot(){
  const c = [__dirname, path.join(__dirname, "..")];
  for(const d of c){ try{ if(fs.existsSync(path.join(d,"index.html"))) return d; }catch(e){} }
  return __dirname;
}
const ROOT = findRoot();
const js = extractJS(path.join(ROOT,"index.html"));
const _e=console.error; console.error=()=>{};

const ctx = buildContext();
vm.runInContext(js, ctx, {filename:"index.html"});
const run = code => vm.runInContext(code, ctx);

let pass=0, fail=0;
function chk(name, cond, detail){
  if(cond){ pass++; console.log("  ok  "+name+(detail?"  "+detail:"")); }
  else { fail++; console.log("  NG  "+name+(detail?"  "+detail:"")); }
}

/* ---------- 1. 麻雀の精算不変量(v2.73-2.81の設計) ---------- */
console.log("\n【1】麻雀 精算の不変量");
const tables = [
  { name:"通常(場代あり・切捨100)", t:{ id:1,date:"2026-08-01",rule:"3",ruleName:"t",
      players:["A","B","C"], meIdx:0,
      rows:[["25.1","-10.0","-15.1"],["3.3","5.2","-8.5"]],
      chipStart:["","",""],chipEnd:["","",""], fees:["1000","1200","800"], pexp:["500","",""],
      locked:[],chipLocked:[],feeRelief:[], roundPay:100, scoreRate:100, chipRate:0 } },
  { name:"切捨なし", t:{ id:2,date:"2026-08-01",rule:"3",players:["A","B","C"],meIdx:0,
      rows:[["12.3","-5.1","-7.2"]], chipStart:["","",""],chipEnd:["","",""],
      fees:["900","900","900"], pexp:["","",""], locked:[],chipLocked:[],feeRelief:[],
      roundPay:0, scoreRate:100, chipRate:0 } },
  { name:"場代ゼロ・4麻", t:{ id:3,date:"2026-08-01",rule:"4",players:["A","B","C","D"],meIdx:1,
      rows:[["30.0","-10.0","-10.0","-10.0"]], chipStart:["","","",""],chipEnd:["","","",""],
      fees:["","","",""], pexp:["","","",""], locked:[],chipLocked:[],feeRelief:[],
      roundPay:1000, scoreRate:100, chipRate:0 } },
  { name:"免除あり(全額・負担者指定)", t:{ id:4,date:"2026-08-01",rule:"3",players:["A","B","C"],meIdx:0,
      rows:[["20.0","-8.0","-12.0"]], chipStart:["","",""],chipEnd:["","",""],
      fees:["1000","1000","1000"], pexp:["","",""], locked:[],chipLocked:[],
      feeRelief:[null,{m:"full",by:0},null], roundPay:100, scoreRate:100, chipRate:0 } }
];
tables.forEach(({name,t})=>{
  ctx.__t = t;
  const r = run("mjtSettle(__t)");
  const sumAdj = (r.adjs||[]).reduce((a,b)=>a+b,0);
  const sumPay = (r.pays||[]).reduce((a,b)=>a+b,0);
  const sumFee = (r.fees||[]).reduce((a,b)=>a+b,0);
  const sumRaw = (r.rawFees||[]).reduce((a,b)=>a+b,0);
  const sumExp = (r.pexp||[]).reduce((a,b)=>a+b,0);
  chk(name+" : Σ調整=0", Math.abs(sumAdj)<1e-9, "Σ調整="+sumAdj);
  chk(name+" : Σ場代(移転後)=Σ場代(生)", Math.abs(sumFee-sumRaw)<1e-9, sumFee+" vs "+sumRaw);
  chk(name+" : Σ支払 = −(Σ場代+Σ経費)", Math.abs(sumPay+sumRaw+sumExp)<1e-9,
      "Σ支払="+sumPay+" / 店総額="+(sumRaw+sumExp));
});

/* ---------- 2. 予算・所持金の恒等式 ---------- */
console.log("\n【2】予算・所持金");
ctx.__S = {
  schemaV:3, wallet:{seed:50000},
  budgets:{"消費":"70000|50%","娯楽":"30000|25%"}, waterfall:{sink:"70",invest:"30"},
  entries:[
    {id:1,date:"2026-08-01",type:"income",amount:300000,category:"給与"},
    {id:2,date:"2026-08-01",type:"expense",amount:210000,category:"消費",fixedId:"fx1"},
    {id:3,date:"2026-08-01",type:"expense",amount:1521,category:"消費"},
    {id:4,date:"2026-08-01",type:"expense",amount:2830,category:"娯楽"},
    {id:5,date:"2026-08-01",type:"expense",amount:9000,category:"消費",src:"slot"}
  ],
  savings:{txns:[]}, bank:{txns:[]}, invest:{holdings:[],bufferTxns:[]}
};
run("applyData(__S)");
const mk = "2026-08";
const base = run(`disposableBase("${mk}")`);
chk("可処分 = 収入−固定費(遊技除外)", base===90000, "="+base);
const nc = run(`nowCaps("${mk}")`);
chk("nowCaps: 月枠を超えない(消費)", nc.varc.cap<=nc.varc.monthCap, nc.varc.cap+" <= "+nc.varc.monthCap);
chk("nowCaps: 月枠を超えない(娯楽)", nc.amuse.cap<=nc.amuse.monthCap, nc.amuse.cap+" <= "+nc.amuse.monthCap);
chk("nowCaps: 割合を100%に引き伸ばさない",
    (nc.varc.pct+nc.amuse.pct)<100, "消費"+nc.varc.pct+"% + 娯楽"+nc.amuse.pct+"% = "+(nc.varc.pct+nc.amuse.pct)+"%");
const ps = run(`preSplit("${mk}")`);
chk("按分: 貯金+投資 ≤ 残余", (ps.sv+ps.iv)<=ps.rest+0.5, "sv"+ps.sv+"+iv"+ps.iv+" vs rest"+ps.rest);
const w0 = run("walletBalance()");
run(`S.entries.push({id:99,date:"2026-08-01",type:"expense",amount:1000,category:"消費"})`);
const w1 = run("walletBalance()");
chk("所持金: 支出1000で残高が1000減る", w0-w1===1000, w0+" → "+w1);
run(`S.entries.push({id:98,date:"2026-08-01",type:"expense",amount:5000,category:"消費",src:"slot"})`);
const w2 = run("walletBalance()");
chk("所持金: 遊技(src=slot)は所持金に影響しない", w1===w2, w1+" → "+w2);

/* ---------- 3. 保存 → 復元 のラウンドトリップ ---------- */
console.log("\n【3】保存/復元");
const before = run("JSON.stringify({e:S.entries.length,s:(S.sessions||[]).length,m:(S.mjSessions||[]).length,t:(S.mjTables||[]).length,sum:S.entries.reduce((a,x)=>a+x.amount,0)})");
run("saveLocal()");
const raw = run("localStorage.getItem(KEY)");
chk("localStorageへ書けている", !!raw && raw.length>50, (raw?raw.length:0)+"バイト");
run("applyData(JSON.parse(localStorage.getItem(KEY)))");
const after = run("JSON.stringify({e:S.entries.length,s:(S.sessions||[]).length,m:(S.mjSessions||[]).length,t:(S.mjTables||[]).length,sum:S.entries.reduce((a,x)=>a+x.amount,0)})");
chk("件数・金額合計が一致", before===after, before+" / "+after);

/* ---------- 4. applyDataのホワイトリスト漏れ(v3.13の事故型) ---------- */
console.log("\n【4】applyData ホワイトリスト(v3.13の事故型)");
const src = require("fs").readFileSync(path.join(ROOT,"index.html"),"utf8");
const jsOnly = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
/* S直下に代入されるキーを収集 */
const assigned = new Set();
for(const m of jsOnly.matchAll(/\bS\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) assigned.add(m[1]);
/* applyData本文を切り出す */
const ai = jsOnly.indexOf("function applyData(");
let depth=0, body="";
for(let k=jsOnly.indexOf("{",ai);k<jsOnly.length;k++){
  if(jsOnly[k]==="{")depth++; else if(jsOnly[k]==="}"){depth--; if(!depth){ body=jsOnly.slice(ai,k+1); break; }}
}
const ignore = new Set(["entries","sessions","mjSessions","mjTables","updatedAt","schemaV"]);
const missing=[...assigned].filter(k=>!ignore.has(k) && body.indexOf(k)<0).sort();
chk("S直下の全キーがapplyDataに載っている", missing.length===0,
    missing.length? "未掲載: "+missing.join(" ") : "検査 "+assigned.size+"キー");

console.log("\n=== 不変量チェック: "+pass+" 通過 / "+fail+" 失敗 ===");
