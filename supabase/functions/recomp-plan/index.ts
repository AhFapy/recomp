// Recomp · plan de entreno leído del Google Sheet del entrenador.
// El navegador llama con { perfil } (sin llave desde el 1 nov 2026). La URL del Sheet
// vive en recomp_config (plan_sheet:<perfil>), nunca en el código de la web.
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { strFromU8, strToU8, unzipSync, zipSync } from "npm:fflate@0.8.2";
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
  // Si la copia es más vieja, se devuelve igualmente al momento y se refresca en segundo plano:
  // si la lectura del Sheet falla (memoria, CPU, red), la app sigue teniendo plan.
  const ck = "plan_cache:" + perfil;
  const { data: cache } = await sb.from("recomp_config").select("valor").eq("clave", ck).maybeSingle();
  let copia: { leido?: string } | null = null;
  try { copia = cache?.valor ? JSON.parse(cache.valor) : null; } catch { /* copia rota */ }
  if (copia) {
    if (Date.now() - Date.parse(copia.leido ?? "") < 10 * 60 * 1000) return resp(200, copia);
    // @ts-ignore EdgeRuntime existe en Supabase
    EdgeRuntime.waitUntil(leerSheet(hoja.valor).then((out) => guardar(ck, out)).catch((e) => console.log("plan refresco", String(e))));
    return resp(200, copia);
  }
  try {
    const out = await leerSheet(hoja.valor);
    await guardar(ck, out);
    return resp(200, out);
  } catch (e) {
    return resp(502, { error: String((e as Error)?.message ?? e) });
  }
});

async function guardar(ck: string, out: unknown) {
  await sb.from("recomp_config").upsert({ clave: ck, valor: JSON.stringify(out) });
}

async function leerSheet(id: string) {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
  if (!r.ok) throw new Error("No se pudo leer el Sheet (" + r.status + "). ¿Sigue compartido con enlace?");
  const libro = soloSemanas(new Uint8Array(await r.arrayBuffer()));
  const wb = XLSX.read(libro, { type: "array", cellFormula: false, cellHTML: false, cellStyles: false, cellDates: false, sheetStubs: false });
  const nombres = wb.SheetNames.filter((n: string) => /semana/i.test(n));
  // Las columnas del parser cuentan desde A1: si la hoja empieza más abajo o más a la derecha, se rellena.
  const hojas = nombres.filter((n: string) => wb.Sheets[n]).map((nombre: string) => {
    const ws = wb.Sheets[nombre];
    if (ws["!ref"]) { const r = XLSX.utils.decode_range(ws["!ref"]); r.s.c = 0; r.s.r = 0; r.e.c = Math.min(r.e.c, 31); ws["!ref"] = XLSX.utils.encode_range(r); }
    return { nombre, rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: true }) as string[][] };
  });
  return { ...parsePlan(hojas), leido: new Date().toISOString() };
}

// El libro entero (imágenes, dibujos, pestañas que no son semanas) se pasa de memoria en la
// edge function. Se rehace el .xlsx solo con lo necesario: sin imágenes ni dibujos y con las
// pestañas que no son semanas vacías. Mismo resultado al leerlo, una fracción del tamaño.
function soloSemanas(buf: Uint8Array): Uint8Array {
  const meta = unzipSync(buf, { filter: (f) => f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" });
  const wbx = strFromU8(meta["xl/workbook.xml"]), rels = strFromU8(meta["xl/_rels/workbook.xml.rels"]);
  const tgt: Record<string, string> = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1], t = m[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && t) tgt[id] = t.startsWith("/") ? t.slice(1) : "xl/" + t;
  }
  const dec = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const semanas = new Set<string>();
  for (const m of wbx.matchAll(/<sheet\b[^>]*>/g)) {
    const n = dec(m[0].match(/\bname="([^"]*)"/)?.[1] ?? ""), id = m[0].match(/\br:id="([^"]+)"/)?.[1];
    if (id && tgt[id] && /semana/i.test(n)) semanas.add(tgt[id]);
  }
  const esHoja = (n: string) => /^xl\/worksheets\/[^/]+\.xml$/.test(n);
  const f = unzipSync(buf, { filter: (x) =>
    !/^xl\/(media|drawings|embeddings|printerSettings|charts)\//.test(x.name) &&
    !/^xl\/worksheets\/_rels\//.test(x.name) && !(esHoja(x.name) && !semanas.has(x.name)) });
  const vacia = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>');
  for (const r of Object.values(tgt)) if (esHoja(r) && !semanas.has(r)) f[r] = vacia;
  return zipSync(f, { level: 0 });
}
