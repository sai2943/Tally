/* Tally service worker 1.51
   方針: ページ本体はネットワーク優先(更新が即反映)、失敗時キャッシュ(オフライン動作)。
   アイコン等の静的物はキャッシュ優先。
   1.50 からの変更(2026-11-14):
   ・サーバーがエラー(404・5xx)を返した時、その返事をキャッシュに入れない・画面を開く時はキャッシュのアプリを出す。
     (1.50 までは、エラーの画面をそのまま出し、キャッシュもエラーの画面で上書きしていた = 配っている側の障害の間、
      キャッシュがあってもアプリが開けず、その後オフラインで開いてもエラーの画面が出た)
   ・版の確認(index.html?_=…)は、つながらない時にキャッシュを返さない。
     (1.50 までは、オフラインでもキャッシュの中身を返すので、「最新です」と出ていた = 確かめられていないのに)
   ・よそのサイト(Supabase・Claude・Google・CDN)と、GET 以外の通信には手を出さない(何もせずブラウザに任せる)。
   旧キャッシュは activate で自動削除。 */
const CACHE = "tally-1.51";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                      // 書き込みには手を出さない
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // よそのサイトには手を出さない
  const isPage = req.mode === "navigate";                // 画面を開く(起動・再読み込み)
  if (isPage || url.pathname.endsWith("index.html")) {
    // ネットワーク優先 → 成功したらキャッシュ更新 → 失敗ならキャッシュ(画面を開く時だけ)
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copy));
            return res;
          }
          // リダイレクトはブラウザに追わせる(末尾の / が無い時など)。それ以外のエラーは、キャッシュに入れない
          const redirect = res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400);
          if (isPage && !redirect) return caches.match("./index.html").then((hit) => hit || res);
          return res;
        })
        .catch((err) => {
          if (isPage) return caches.match("./index.html").then((hit) => hit || Promise.reject(err));
          throw err;                                     // 版の確認は、失敗を失敗のまま返す
        })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req))
  );
});
