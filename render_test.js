/* 全画面 × 複数データシナリオ の描画スイープ */
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
const _origErr=console.error; console.error=()=>{};
const js = extractJS(path.join(ROOT,"index.html"));

const SCREENS = ["main","entry","fixed","wishlist","leak","invest","investdetail","bank","savings",
  "mjplay","mjsheet","mjtable","mjtlist","budget","wallet","catdrill","mdb","stores","bordertool","backup"];
const TABS = ["ledger","games","assets","tool"];

function scenarioEmpty(){ return {}; }
function scenarioTypical(){
  return {
    schemaV:3,
    wallet:{seed:50000},
    budgets:{"消費":"70000|50%","娯楽":"30000|25%"},
    waterfall:{sink:"100",invest:"0"},
    genreCaps:{"食費":"35%"},
    genres:{"セブンイレブン":"食費","マクドナルド":"食費"},
    furusato:{year:2026,limit:80000},
    entries:[
      {id:1,date:"2026-08-01",type:"income",amount:300000,category:"給与",store:"",item:""},
      {id:2,date:"2026-08-01",type:"expense",amount:60000,category:"消費",fixedId:"fx1",store:"家賃",item:""},
      {id:3,date:"2026-08-01",type:"expense",amount:1521,category:"消費",store:"セブンイレブン 北仙台店",item:"弁当"},
      {id:4,date:"2026-08-02",type:"expense",amount:2830,category:"娯楽",store:"DUO",item:"セット"},
      {id:5,date:"2026-08-02",type:"expense",amount:5000,category:"承認",store:"ふるさと納税",item:"さとふる"},
      {id:6,date:"2026-08-25",type:"expense",amount:9800,category:"消費",fixedId:"fx1",store:"電気",item:""},
      {id:7,date:"2026-08-02",type:"income",amount:12000,category:"副業",src:"daida",store:"店A",item:""},
      {id:8,date:"2026-08-02",type:"income",amount:5000,category:"給与",src:"slot",linkId:"slot-9",store:"",item:""}
    ],
    sessions:[{id:9,date:"2026-08-02",store:"店A",mode:"nori",fee:1000,exchange:5.6,machines:[{name:"台",start:100,end:1500,hold:0,cash:10000}],expenses:[],startAt:"10:00",endAt:"22:00"}],
    mjSessions:[{id:10,date:"2026-07-12",store:"DUO",category:"set",rule:"3",score:251,chips:0,scoreRate:100,chipRate:0,ranks:[1,2,3],players:["チョロ","ゴリ"],baseFee:0,setFee:3000,expenses:[],fromTable:100,startAt:"13:00",endAt:"23:00"}],
    mjTables:[{id:100,date:"2026-07-12",ruleName:"DUO【虹】",rule:"3",players:["自分","チョロ","ゴリ"],meIdx:0,
      rows:[["25.1","-10.0","-15.1"],["3.0","5.0","-8.0"],["","",""]],
      chipStart:["",""," "],chipEnd:["","",""],fees:["1000","1000","1000"],pexp:["","",""],
      locked:[true,false,false],chipLocked:[],feeRelief:[],roundPay:100,scoreRate:100,chipRate:500}],
    mjPresets:[{id:1,name:"DUO【虹】",rule:"3",scoreRate:100}],
    mdb:[{id:1,name:"機種A",segs:[]}],
    stores:[{id:1,name:"店A",rate:5.6}],
    fixed:[{id:"fx1",name:"家賃",amount:60000,type:"expense",category:"消費",freq:"monthly",day:1,start:"2026-01-01"}],
    savings:{seed:0,goals:[{id:1,name:"引越し",target:500000}],txns:[{id:1,type:"deposit",date:"2026-07-15",amount:30000}]},
    bank:{seed:100000,txns:[{id:1,type:"topup",date:"2026-07-01",amount:20000}]},
    invest:{policy:"",holdings:[{id:1,name:"eMAXIS",frame:"つみたて",qty:10,cost:30000,unit:"口",buys:[{id:1,date:"2026-07-01",amount:30000,qty:10}]}],bufferTxns:[]},
    wishlist:[{id:1,name:"リュック",price:20000}],
    borderTool:{},
    updatedAt:Date.now()
  };
}
function scenarioEdge(){
  const S = scenarioTypical();
  S.entries = [];                 /* 収入ゼロ=可処分0(除算) */
  S.budgets = {"消費":"0","娯楽":""};
  S.wallet = {seed:-5000};        /* 所持金マイナス */
  S.waterfall = {sink:"0",invest:"0"};
  S.genreCaps = {"食費":"0"};
  S.mjTables[0].players = ["A","B","C"];
  S.mjTables[0].rows = [["","",""]];
  S.mjTables[0].meIdx = null;
  S.mjTables[0].fees = ["","",""];
  return S;
}
function scenarioNoTables(){
  const S = scenarioTypical();
  S.mjTables = []; S.mjSessions = []; S.sessions = [];
  return S;
}
function scenarioFuture(){
  const S = scenarioTypical();
  /* 年跨ぎ・月替わり相当: 全部を未来日に寄せる */
  S.entries = S.entries.map(e=>Object.assign({},e,{date:e.date.replace("2026-08","2026-12")}));
  return S;
}

const SCEN = { "空データ":scenarioEmpty, "通常":scenarioTypical, "境界(0除算/マイナス)":scenarioEdge,
               "卓なし":scenarioNoTables, "未来日のみ":scenarioFuture };

let pass=0, fail=0; const fails=[];
for(const [sname, mk] of Object.entries(SCEN)){
  const ctx = buildContext();
  try{ vm.runInContext(js, ctx, {filename:"index.html"}); }
  catch(e){ console.log("BOOT_FAIL("+sname+"): "+e.message); fail++; continue; }
  ctx.__S = mk();
  vm.runInContext("applyData(__S); UI.mjt = (S.mjTables||[])[0] || null;", ctx);

  for(const sc of SCREENS){
    const tabs = (sc==="main") ? TABS : ["ledger"];
    for(const tab of tabs){
      const label = sname+" / "+sc+(sc==="main"?" ["+tab+"]":"");
      try{
        vm.runInContext(`UI.screen=${JSON.stringify(sc)}; UI.tab=${JSON.stringify(tab)};
          if(UI.screen==="mjtable"||UI.screen==="mjplay"||UI.screen==="mjsheet"){ UI.mjt = (S.mjTables||[])[0] || newMjTable(); }
          if(UI.screen==="catdrill"){ UI.drillCat="消費"; UI.drillMonth=UI.month; }
          if(UI.screen==="investdetail"){ UI.invId=((S.invest||{}).holdings||[{}])[0] && ((S.invest||{}).holdings||[{}])[0].id; }
          if(UI.screen==="entry" && !UI.entryForm){ UI.editEntryId=null; UI.entryForm={date:todayStr(),type:"expense",category:"消費",amount:"",store:"",item:"",memo:""}; }
          render();`, ctx);
        const out = ctx.document.getElementById("app").innerHTML;
        if(/この画面の描画に失敗しました/.test(out)){
          const m = out.match(/word-break:break-all">([^<]*)</);
          throw new Error("描画例外: "+(m?m[1]:"?"));
        }
        pass++;
      }catch(e){ fail++; fails.push(label+"  →  "+e.message); }
    }
  }
}
console.log("=== 描画スイープ: "+pass+" 通過 / "+fail+" 失敗 ===");
fails.forEach(f=>console.log("  NG  "+f));
