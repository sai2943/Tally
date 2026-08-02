/* 死んだボタンの検出
   HTMLに出力される data-XX="値" のうち、対応するハンドラ分岐が存在しないものを洗う。
   v3.63(wfapply)・v3.65(gcap)・v3.95(subback)と同型の事故を機械で捕まえる。 */
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
const src = fs.readFileSync(path.join(ROOT,"index.html"),"utf8");

/* JSブロックだけを対象にする(HTML地の文の静的属性は除外) */
const js = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");

/* 1) 出力される data-XX="リテラル" を収集(値に '+ が入る動的生成は除外) */
const emitted = {};
for(const m of js.matchAll(/data-([a-z]+)=\\?"([^"'+\\]+)\\?"/g)){
  const attr=m[1], val=m[2].trim();
  if(!val || /[<>{}]/.test(val)) continue;
  (emitted[attr] = emitted[attr] || new Set()).add(val);
}

/* 2) dataset.XX を受ける変数名を収集 */
const varsFor = {};
for(const m of js.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*el\.dataset\.([a-z]+)/g)){
  (varsFor[m[2]] = varsFor[m[2]] || new Set()).add(m[1]);
}
/* el.dataset.XX を直接比較している形も拾う */
for(const m of js.matchAll(/el\.dataset\.([a-z]+)\s*===?\s*"([^"]+)"/g)){
  (varsFor[m[1]] = varsFor[m[1]] || new Set()).add("__direct__");
}

/* 3) 各変数について VAR==="lit" / case "lit" を収集 */
function handledFor(attr){
  const out = new Set();
  const vars = varsFor[attr] || new Set();
  for(const v of vars){
    if(v==="__direct__"){
      for(const m of js.matchAll(new RegExp('el\\.dataset\\.'+attr+'\\s*===?\\s*"([^"]+)"','g'))) out.add(m[1]);
      continue;
    }
    const re = new RegExp('\\b'+v.replace(/\$/g,'\\$')+'\\s*===?\\s*"([^"]+)"','g');
    for(const m of js.matchAll(re)) out.add(m[1]);
    const re2 = new RegExp('"([^"]+)"\\s*===?\\s*'+v.replace(/\$/g,'\\$')+'\\b','g');
    for(const m of js.matchAll(re2)) out.add(m[1]);
    const re3 = new RegExp('\\['+'?["\']([^"\']+)["\']\\]?\\.indexOf\\('+v,'g');
    for(const m of js.matchAll(re3)) out.add(m[1]);
  }
  return out;
}

let dead=0, checked=0;
const attrs = Object.keys(emitted).sort();
console.log("=== data属性ごとの出力値 vs ハンドラ分岐 ===");
for(const attr of attrs){
  const em = [...emitted[attr]].sort();
  const hd = handledFor(attr);
  const missing = em.filter(v=>!hd.has(v));
  checked += em.length;
  const varList = [...(varsFor[attr]||[])].join(",") || "(受け手なし)";
  if(!varsFor[attr]){
    console.log("  ?   data-"+attr+"  出力"+em.length+"件だが dataset."+attr+" を読む箇所が無い → "+em.join(" "));
    continue;
  }
  if(missing.length){
    dead += missing.length;
    console.log("  NG  data-"+attr+" ["+varList+"] 未処理: "+missing.join(" "));
  } else {
    console.log("  ok  data-"+attr+" ["+varList+"] "+em.length+"件すべて分岐あり");
  }
}
console.log("\n出力アクション "+checked+" 件中 未処理 "+dead+" 件");
