/* ============================================================
   supabase-sync.js — conecta la PWA de resguardos con Supabase
   ------------------------------------------------------------
   Cómo usar:
   1) En index.html, ANTES de este archivo, agrega el cliente:
        <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        <script src="supabase-sync.js"></script>
   2) Rellena SUPABASE_URL y SUPABASE_ANON_KEY (Project Settings → API).
      La llave "anon" es PÚBLICA y segura junto con RLS. La "service_role"
      jamás se pone aquí.
   3) Llama a las funciones desde tu app (ver "PUNTOS DE INTEGRACIÓN" abajo).
============================================================ */
(function(){
"use strict";

if (!window.supabase || !window.supabase.createClient){
  // La librería de Supabase no cargó (p. ej. sin conexión en el primer arranque).
  // La app sigue funcionando en local; la nube se activará cuando cargue.
  window.Cloud = null;
  return;
}

const SUPABASE_URL      = "https://moiartcxprcogqcavbik.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vaWFydGN4cHJjb2dxY2F2YmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MzUwNTcsImV4cCI6MjA5ODAxMTA1N30.FOPsta7-yZRLr3QQ0k8arzshagj-7H3zZLpt0dR-X2U";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

/* ---------- Autenticación (los 3 usuarios de IT) ---------- */
async function cloudSignIn(email, password){
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
async function cloudSignOut(){ await sb.auth.signOut(); }
async function cloudUser(){ const { data } = await sb.auth.getUser(); return data.user; }
function onAuthChange(cb){ sb.auth.onAuthStateChange((_e, session)=> cb(session ? session.user : null)); }

/* ---------- PDF en Storage ---------- */
async function uploadOriginal(item){
  if (!item.pdf) return item.original_path || null;
  const path = item.id + ".pdf";
  const { error } = await sb.storage.from("originales")
    .upload(path, new Blob([item.pdf], { type:"application/pdf" }), { upsert:true });
  if (error) throw error;
  return path;
}
async function uploadFirmado(item, bytes){
  const path = item.id + "-Firmados.pdf";
  const { error } = await sb.storage.from("firmados")
    .upload(path, new Blob([bytes], { type:"application/pdf" }), { upsert:true });
  if (error) throw error;
  return path;
}
async function downloadPdf(bucket, path){
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error) throw error;
  return await data.arrayBuffer();
}

/* ---------- Empujar / jalar metadatos ---------- */
function itemToRow(item){
  return {
    id: item.id, nombre: item.name, archivo: item.fileName,
    estatus: item.status, firmas_req: item.firmasReq || 3,
    firmas: item.signatures || {}, size: item.size || null, pages: item.pages || null,
    original_path: item.original_path || null, firmado_path: item.firmado_path || null,
    creado: item.createdAt ? new Date(item.createdAt).toISOString() : null,
    firmado_en: item.signedAt ? new Date(item.signedAt).toISOString() : null,
    exportado_en: item.exportedAt ? new Date(item.exportedAt).toISOString() : null,
  };
}
function rowToItem(row){
  // PDF se baja aparte y bajo demanda (downloadPdf) para no gastar datos
  return {
    id: row.id, name: row.nombre, fileName: row.archivo, status: row.estatus,
    firmasReq: row.firmas_req, signatures: row.firmas || {}, size: row.size, pages: row.pages,
    original_path: row.original_path, firmado_path: row.firmado_path,
    createdAt: row.creado ? Date.parse(row.creado) : Date.now(),
    signedAt: row.firmado_en ? Date.parse(row.firmado_en) : null,
    exportedAt: row.exportado_en ? Date.parse(row.exportado_en) : null,
    actualizado: row.actualizado,
    pdf: null,           // se rellena con cloudGetPdf(item) al abrir el resguardo
  };
}

// Sube un resguardo (y su PDF original si aún no está en la nube)
async function pushResguardo(item){
  const row = itemToRow(item);
  if (!row.original_path && item.pdf){
    row.original_path = await uploadOriginal(item);
  }
  const { error } = await sb.from("resguardos").upsert(row);
  if (error) throw error;
  return row.original_path;
}

// Trae cambios desde la última sincronización (o todos si since = null)
async function pullResguardos(since){
  let q = sb.from("resguardos").select("*").order("actualizado", { ascending:true });
  if (since) q = q.gt("actualizado", since);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(rowToItem);
}

// Baja el PDF original de un resguardo (cuando se va a abrir/firmar)
async function cloudGetPdf(item){
  if (!item.original_path) return null;
  return await downloadPdf("originales", item.original_path);
}

// Borra un resguardo de la nube (fila + PDFs en Storage)
async function removeResguardo(item){
  try{
    if (item.original_path) await sb.storage.from("originales").remove([item.original_path]);
    if (item.firmado_path)  await sb.storage.from("firmados").remove([item.firmado_path]);
  }catch(e){ /* ignora si no existen */ }
  const { error } = await sb.from("resguardos").delete().eq("id", item.id);
  if (error) throw error;
}

/* ---------- Realtime: cambios de otros dispositivos ---------- */
function subscribeResguardos(onChange){
  return sb.channel("rt-resguardos")
    .on("postgres_changes", { event:"*", schema:"public", table:"resguardos" },
        payload => onChange(payload.eventType, payload.new || payload.old))
    .subscribe();
}

// Expuesto para la app
window.Cloud = {
  signIn: cloudSignIn, signOut: cloudSignOut, user: cloudUser, onAuthChange,
  push: pushResguardo, pull: pullResguardos, getPdf: cloudGetPdf, remove: removeResguardo,
  uploadFirmado, subscribe: subscribeResguardos, rowToItem,
};
})();

/* ============================================================
   PUNTOS DE INTEGRACIÓN en tu index.html (resumen)
   ------------------------------------------------------------
   - Al iniciar: pide login (Cloud.signIn) y luego:
        const remoto = await Cloud.pull(localStorage.getItem('lastSync'));
        // compara 'actualizado' contra tu copia local y guarda el más
        // reciente en IndexedDB (Store.put). Refresca la lista.
        localStorage.setItem('lastSync', new Date().toISOString());
        Cloud.subscribe(async (tipo, row) => { ...baja ese row y actualiza local... });

   - Al CARGAR un PDF (addPdfFile) o al GUARDAR/EXPORTAR (Store.put):
        try { await Cloud.push(item); } catch(e) { ...sin red: queda pendiente... }

   - Al ABRIR un resguardo cuyo item.pdf esté vacío (vino de otro equipo):
        item.pdf = await Cloud.getPdf(item);   // baja el original bajo demanda

   - Cola offline: marca item.dirty=true cuando falle el push; al volver la red
     (evento 'online') recorre los dirty y reintenta Cloud.push.
============================================================ */
