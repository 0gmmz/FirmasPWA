/* Firma de resguardos — service worker
   - Cache-first del "app shell" + librerías (uso sin conexión).
   - Recibe PDFs compartidos desde otra app (Web Share Target) y los guarda
     directo en IndexedDB, sin servidor. Sube CACHE al cambiar index.html. */
const CACHE = "resguardos-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

/* ---------- IndexedDB (mismo esquema que la app) ---------- */
function swOpenDB(){
  return new Promise((res, rej)=>{
    const req = indexedDB.open("resguardos-db", 2);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath:"id" });
      if (!db.objectStoreNames.contains("meta"))  db.createObjectStore("meta",  { keyPath:"key" });
    };
    req.onsuccess = ()=> res(req.result);
    req.onerror = ()=> rej(req.error);
  });
}
async function swAddResguardo(fileName, buf){
  const db = await swOpenDB();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const item = {
    id, name: (fileName||"compartido").replace(/\.pdf$/i,""), fileName: fileName||"compartido.pdf",
    status:"pendiente", size: buf.byteLength, pages:null, pdf: buf, signatures:{},
    createdAt: Date.now(), signedAt:null, exportedAt:null
  };
  await new Promise((res, rej)=>{
    const tx = db.transaction("items","readwrite");
    tx.objectStore("items").put(item);
    tx.oncomplete = ()=>res(); tx.onerror = ()=>rej(tx.error);
  });
}

/* ---------- Recibir "Compartir → Resguardos" ---------- */
async function handleShare(request){
  let added = 0;
  try{
    const form = await request.formData();
    const files = form.getAll("pdfs");
    for (const f of files){
      if (!f || typeof f.arrayBuffer !== "function") continue;
      const isPdf = /pdf/i.test(f.type||"") || /\.pdf$/i.test(f.name||"");
      if (!isPdf) continue;
      const buf = await f.arrayBuffer();
      await swAddResguardo(f.name, buf);
      added++;
    }
  }catch(e){ /* sigue al redirect */ }
  return Response.redirect("./?imported=" + added, 303);
}

/* ---------- Fetch ---------- */
self.addEventListener("fetch", (e)=>{
  const req = e.request;
  const url = new URL(req.url);

  // destino de Compartir (POST)
  if (req.method === "POST" && url.pathname.endsWith("/share-target")){
    e.respondWith(handleShare(req));
    return;
  }
  if (req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok && (url.origin === location.origin || url.host.includes("cdnjs.cloudflare.com"))){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(()=> caches.match("./index.html"));
    })
  );
});
