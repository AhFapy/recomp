// Recomp · plan de entreno leído del Google Sheet del entrenador.
// El navegador llama con { perfil } (sin llave desde el 1 nov 2026). La URL del Sheet
// vive en recomp_config (plan_sheet:<perfil>), nunca en el código de la web.
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { parsePlan } from "./plan.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Solo la web de Jabner (jabner.vercel.app y previews de Vercel del proyecto).
const ORIGEN = /^https:\/\/jabner\.vercel\.app$|^https:\/\/recomp(-[a-z0-9-]+)?-trud-sales\.vercel\.app$/;
const CORS_BASE: Record<string, string> = {
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-recomp-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  const origen = req.headers.get("origin") ?? "";
  const CORS = { ...CORS_BASE, "Access-Control-Allow-Origin": ORIGEN.test(origen) ? origen : "https://jabner.vercel.app" };
  const resp = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return resp(405, { error: "método" });

  let perfil = "";
  try { perfil = String((await req.json()).perfil ?? ""); } catch { /* sin cuerpo */ }
  if (!/^[0-9a-f-]{36}$/.test(perfil)) return resp(400, { error: "perfil" });

  const { data: hoja } = await sb.from("recomp_config").select("valor").eq("clave", "plan_sheet:" + perfil).maybeSingle();
  if (!hoja?.valor) return resp(200, { semanas: [] });
  if (!/^[A-Za-z0-9_-]{20,}$/.test(hoja.valor)) return resp(500, { error: "sheet" });

  // Copia de 10 minutos: abrir la app muchas veces no descarga el Sheet cada vez.
  const ck = "plan_cache:" + perfil;
  const { data: cache } = await sb.from("recomp_config").select("valor").eq("clave", ck).maybeSingle();
  if (cache?.valor) {
    try { const c = JSON.parse(cache.valor); if (Date.now() - Date.parse(c.leido) < 10 * 60 * 1000) return resp(200, c); } catch { /* copia rota */ }
  }

  const r = await fetch(`https://docs.google.com/spreadsheets/d/${hoja.valor}/export?format=xlsx`);
  if (!r.ok) return resp(502, { error: "No se pudo leer el Sheet (" + r.status + "). ¿Sigue compartido con enlace?" });
  // Lectura ligera: primero solo los nombres, luego solo las pestañas de semanas y sin estilos ni fórmulas
  // (leer el libro entero se pasa de memoria en la edge function).
  const buf = new Uint8Array(await r.arrayBuffer());
  const nombres = XLSX.read(buf, { type: "array", bookSheets: true }).SheetNames.filter((n: string) => /semana/i.test(n));
  const wb = XLSX.read(buf, { type: "array", sheets: nombres, cellFormula: false, cellHTML: false, cellStyles: false, cellDates: false, sheetStubs: false });
  // Las columnas del parser cuentan desde A1: si la hoja empieza más abajo o más a la derecha, se rellena.
  const hojas = nombres.filter((n: string) => wb.Sheets[n]).map((nombre: string) => {
    const ws = wb.Sheets[nombre];
    if (ws["!ref"]) { const r = XLSX.utils.decode_range(ws["!ref"]); r.s.c = 0; r.s.r = 0; r.e.c = Math.min(r.e.c, 31); ws["!ref"] = XLSX.utils.encode_range(r); }
    return { nombre, rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: true }) as string[][] };
  });
  const out = { ...parsePlan(hojas), leido: new Date().toISOString() };
  await sb.from("recomp_config").upsert({ clave: ck, valor: JSON.stringify(out) });
  return resp(200, out);
});
