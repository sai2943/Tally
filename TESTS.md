# Tally テストハーネス

ブラウザ無しで **index.html の実物のコード** を起動して検査する。
jsdom等の外部依存は無し(オフライン環境で動く)。Node だけで動作。

`harness.js` は4本すべてが読み込むので**必ず一緒に置くこと**(テストファイルだけでは動かない)。
パスはスクリプト位置基準なので、どのディレクトリから実行してもよい。

```bash
node tests/render.test.js          # 全画面 × 5データシナリオ の描画スイープ
node tests/invariants.test.js      # 精算・予算・所持金の不変量 + applyDataホワイトリスト
node tests/actions.test.js         # 死んだボタン(ハンドラの無いdata-*)の静的検出
node tests/widget-parity.test.js   # 本体 vs tally-widget.js の計算一致
```

## 仕組み
`harness.js` が DOM/localStorage/navigator 等のスタブを作り、
index.html からインラインJSを抽出して vm 上で起動する。
以後は `vm.runInContext` で実物の関数(render/applyData/mjtSettle/nowCaps…)を直接呼べる。

## 捕まえられる事故の型(過去に実際に起きたもの)
- **v3.58型**: 変数定義の削除漏れによる描画例外 → render.test
- **v3.13型**: applyData ホワイトリスト漏れで設定が毎起動消える → invariants.test §4
- **v3.63/3.65/3.95型**: UI要素だけ移設してハンドラが付いてこない死んだボタン → actions.test
- **ウィジェット乖離**: 本体の計算規則を変えたのにウィジェットが追随していない → widget-parity.test

## 注意
- `setTimeout` はスタブで発火させない(起動時のクラウド同期fetchを止めるため)
- `widget-parity.test.js` は `tally-widget.js` がリポジトリ外(Scriptable内)のため、
  ファイルが無ければスキップされる。検査するときはリポジトリ直下に現物を置いてから実行する。
- actions.test は静的解析なので誤検出が出る。値の運搬用属性(data-v/bi/sf/wn/in)と
  bindMjTableの明示スキップ配列(pname/rate/fee/rname/rd/ftotal/umaabs/pexp/framt)は正常。
