const fs=require("fs"), vm=require("vm"), path=require("path");
/* v3.97b: 置き場所に依存しないルート探索。
   iOSのWorking Copyへ手作業で入れるとリポジトリ直下に置かれることがあるため、
   「自分と同じ階層」→「1つ上」の順に index.html を探す */
function findRoot(){
  const c = [__dirname, path.join(__dirname, "..")];
  for(const d of c){ try{ if(fs.existsSync(path.join(d,"index.html"))) return d; }catch(e){} }
  return __dirname;
}
const ROOT = findRoot();
const WPATH = path.join(ROOT,"tally-widget.js");
if(!fs.existsSync(WPATH)){
  console.log("  --  tally-widget.js が見つかりません(Scriptable内にのみ存在するリポジトリ外ファイル)。");
  console.log("      検査するにはユーザーに現物を貼ってもらい "+WPATH+" に置いてから再実行してください。");
  process.exit(0);
}
const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8"), wsrc=fs.readFileSync(WPATH,"utf8");
const grab=(s,n)=>{const i=s.indexOf("function "+n+"(");let d=0;for(let k=s.indexOf("{",i);k<s.length;k++){if(s[k]==="{")d++;else if(s[k]==="}"){d--;if(!d)return s.slice(i,k+1);}}};
const A={},W={};vm.createContext(A);vm.createContext(W);
vm.runInContext(`const num=v=>{const n=parseInt(v,10);return isNaN(n)?0:n;};var S={};function todayStr(){return TODAY;}\n`+["disposableBase","budgetAmt","walletFlows","walletBalance","nowCaps"].map(n=>grab(html,n)).join("\n"),A);
vm.runInContext(`const num=v=>{const n=parseInt(v,10);return isNaN(n)?0:n;};const NET=["slot","mahjong"];const isNet=e=>NET.includes(e.src);\n`+["budgetAmt","disposableBase","walletBalance","nowCaps"].map(n=>grab(wsrc,n)).join("\n"),W);
const S={wallet:{seed:50000},budgets:{"消費":"70000|50%","娯楽":"30000|25%"},
 entries:[{date:"2026-08-01",type:"income",amount:300000},{date:"2026-08-01",type:"expense",amount:210000,category:"消費",fixedId:"f"},
 {date:"2026-08-01",type:"expense",amount:1521,category:"消費"},{date:"2026-08-01",type:"expense",amount:1830,category:"娯楽"},
 {date:"2026-08-01",type:"expense",amount:1000,category:"娯楽",fixedId:"g"},{date:"2026-08-01",type:"expense",amount:9000,category:"消費",src:"slot"}],
 savings:{txns:[{type:"deposit",date:"2026-08-01",amount:20000}]},bank:{txns:[]},invest:{holdings:[],bufferTxns:[]}};
A.S=S;A.TODAY="2026-08-02";W.S=S;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
[["disposableBase",vm.runInContext("disposableBase('2026-08')",A),vm.runInContext("disposableBase(S,'2026-08')",W)],
 ["walletBalance",vm.runInContext("walletBalance()",A),vm.runInContext("walletBalance(S,'2026-08-02')",W)],
 ["nowCaps.varc",vm.runInContext("nowCaps('2026-08').varc",A),vm.runInContext("nowCaps(S,'2026-08','2026-08-02').varc",W)],
 ["nowCaps.amuse",vm.runInContext("nowCaps('2026-08').amuse",A),vm.runInContext("nowCaps(S,'2026-08','2026-08-02').amuse",W)]
].forEach(([n,a,b])=>console.log("  "+(eq(a,b)?"ok  ":"NG  ")+n+"  "+JSON.stringify(a)));
