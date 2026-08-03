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

/* ---------- 5. 振替は総資産を変えない(v4.01) ---------- */
console.log("\n【5】振替の資産保存則");
ctx.__S2={schemaV:3, wallet:{seed:200000}, bank:{seed:"100000",txns:[]},
  savings:{goals:[],pots:[{id:"main",name:"貯金"},{id:"p2",name:"箱2"}],txns:[]},
  entries:[], invest:{holdings:[],bufferTxns:[]}};
run("applyData(__S2)");
const tot=()=>run("walletBalance()+bankBalance()+savingsBalance()");
const before5=tot();
[["__wallet__","__bank__",30000],["__bank__","__wallet__",10000],
 ["__wallet__","main",50000],["__wallet__","p2",52000],
 ["__bank__","p2",5000],["main","p2",1000],
 ["p2","__bank__",2000],["p2","__wallet__",3000]].forEach(([f2,t2,a2])=>{
  const b=tot();
  ctx.__f=f2; ctx.__t=t2; ctx.__a=a2;
  const ok=run("doTransfer(__f,__t,__a)");
  chk("振替 "+f2+" → "+t2, ok && tot()===b, "総額 "+b+" → "+tot());
});
chk("8回の振替後も総額不変", tot()===before5, before5+" → "+tot());

/* ---------- 6. 箱の削除は総額を変えない / 最後の1つは残る(v4.04) ---------- */
console.log("\n【6】箱の削除");
ctx.__S3={schemaV:3, wallet:{seed:0}, bank:{seed:"0",txns:[{id:9,type:"sweep",date:"2026-06-01",amount:"5000"}]},
  savings:{goals:[],pots:[{id:"main",name:"A"},{id:"p2",name:"B"},{id:"p3",name:"C"}],
    txns:[{id:1,type:"deposit",date:"2026-07-01",amount:"40000"},
          {id:2,type:"deposit",date:"2026-07-02",amount:"12000",potId:"p2"}]},
  entries:[], invest:{holdings:[],bufferTxns:[]}};
run("applyData(__S3)");
chk("potId無しのtxnが先頭の箱へ移行", run("S.savings.txns.every(t=>!!t.potId)"), run("JSON.stringify(S.savings.txns.map(t=>t.potId))"));
chk("sweepも移行", run("S.bank.txns.every(t=>t.type!=='sweep'||!!t.potId)"));
const tot6=()=>run("savingsBalance()");
const b6=tot6();
run(`(function(){ const sv=S.savings,v="main",dest="p3";
  (sv.txns||[]).forEach(t=>{ if(txPot(t)===v) t.potId=dest; });
  (S.bank.txns||[]).forEach(t=>{ if(t.type==="sweep"&&txPot(t)===v) t.potId=dest; });
  sv.pots=sv.pots.filter(x=>String(x.id)!==v); })()`);
chk("先頭の箱を削除しても総額は不変", tot6()===b6, b6+" → "+tot6());
chk("削除後も箱が残っている", run("savingsPots().length")===2, run("JSON.stringify(savingsPots().map(p=>p.name))"));

/* ---------- 7. 軍資金の月次補充枠(v4.11) ---------- */
console.log("\n【7】軍資金の補充枠");
ctx.__S4={schemaV:3, wallet:{seed:500000}, entries:[],
  bank:{seed:"0",ceiling:"300000",refillCap:"30000",txns:[{id:1,type:"topup",date:"2026-07-28",amount:"50000"}]},
  savings:{goals:[],pots:[{id:"main",name:"貯金"}],txns:[{id:9,type:"deposit",date:"2026-07-01",amount:"100000",potId:"main"}]},
  invest:{holdings:[],bufferTxns:[]}};
run("applyData(__S4)");
chk("先月のtopupは当月枠に数えない", run('bankRefillUsed("2026-08")')===0, "7月分=¥"+run('bankRefillUsed("2026-07")'));
run('doTransfer("__wallet__","__bank__",10000,"2026-08-05")');
chk("所持金からの補充が枠に乗る", run('bankRefillUsed("2026-08")')===10000);
/* 迂回: 貯金→所持金→軍資金 でも同じ枠を消費する(経路で抜けられない) */
run('doTransfer("main","__wallet__",20000,"2026-08-06")');
chk("貯金→所持金は枠を消費しない", run('bankRefillUsed("2026-08")')===10000);
run('doTransfer("__wallet__","__bank__",20000,"2026-08-06")');
chk("迂回しても最後のtopupで枠を消費", run('bankRefillUsed("2026-08")')===30000, "¥"+run('bankRefillUsed("2026-08")'));
/* 箱→軍資金の直行も同じ */
run('doTransfer("main","__bank__",5000,"2026-08-07")');
chk("箱→軍資金の直行も枠を消費", run('bankRefillUsed("2026-08")')===35000, "¥"+run('bankRefillUsed("2026-08")'));
/* 逆流(回収)は枠に影響しない */
const u7=run('bankRefillUsed("2026-08")');
run('doTransfer("__bank__","main",5000,"2026-08-08")');
chk("軍資金→貯金(回収)は枠に無関係", run('bankRefillUsed("2026-08")')===u7);
chk("補正(adjust)は補充に数えない", (function(){
  run('(S.bank.txns=S.bank.txns||[]).push({id:99,date:"2026-08-09",type:"adjust",amount:"9000"})');
  return run('bankRefillUsed("2026-08")')===u7; })());

console.log("\n=== 不変量チェック: "+pass+" 通過 / "+fail+" 失敗 ===");
