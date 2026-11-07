// Jabner · entrada de gastos e ingresos por WhatsApp.
// GHL (workflow "Customer replied" por WhatsApp) hace POST aquí con
// { "phone": "{{contact.phone}}", "message": "{{message.body}}" } y la cabecera
// x-jabner-secret (valor en recomp_config, clave wa_secreto). Solo se aceptan los teléfonos de public.jabner_telefonos.
// Devuelve { ok, respuesta } para que GHL pueda contestar por WhatsApp.
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CATS: Record<string, string[]> = {
  "súper": ["super", "súper", "mercadona", "supermercado", "compra", "carrefour", "pepito", "grocer"],
  comida: ["comida", "cena", "desayuno", "almuerzo", "restaurante", "nirvana", "open house", "butter", "cafe", "café", "brunch", "glovo", "gojek food", "grabfood", "uber eats"],
  casa: ["casa", "alquiler", "villa", "luz", "agua", "internet", "limpieza", "piso"],
  transporte: ["taxi", "uber", "grab", "gojek", "gasolina", "moto", "scooter", "parking", "tren", "bus", "metro", "coche"],
  ocio: ["ocio", "fiesta", "copas", "cine", "concierto", "beach club", "salir"],
  gimnasio: ["gym", "gimnasio", "entreno", "suplementos", "proteina", "proteína", "creatina"],
  salud: ["salud", "farmacia", "medico", "médico", "dentista", "fisio", "masaje"],
  ropa: ["ropa", "zapatillas", "camiseta", "pantalon", "pantalón"],
  suscripciones: ["suscripcion", "suscripción", "netflix", "spotify", "claude", "chatgpt", "icloud", "apple", "youtube"],
  viajes: ["vuelo", "hotel", "airbnb", "viaje", "booking", "visado"],
  trabajo: ["trabajo", "software", "herramienta", "oficina", "coworking"],
  trud: ["trud", "dividendos", "reparto"],
  ventas: ["venta", "ventas", "comision", "comisión", "cliente"],
  inversiones: ["inversion", "inversión", "cripto", "bolsa", "intereses"],
};
const INGRESO_CATS = new Set(["trud", "ventas", "inversiones", "otros"]);
const MONEDAS: [RegExp, string][] = [
  [/(€|\beur\b|\beuros?\b)/, "EUR"],
  [/(\bidr\b|\brp\b|\brupias?\b)/, "IDR"],
  [/(\$|\busd\b|\bd[oó]lar(es)?\b)/, "USD"],
  [/(\baed\b|\bdirhams?\b|\bdh\b)/, "AED"],
];

const hoyMadrid = (delta = 0) => {
  const d = new Date(Date.now() + delta * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
};
const normTel = (t: string) => "+" + String(t).replace(/[^\d]/g, "");

export function interpretar(texto: string) {
  let t = " " + texto.toLowerCase().trim() + " ";
  let tipo: "gasto" | "ingreso" = "gasto";
  if (/^\s*\+/.test(t) || /\b(ingreso|cobro|cobrado|cobre|cobré|me han pagado|me pagan)\b/.test(t)) tipo = "ingreso";
  t = t.replace(/\b(gasto|ingreso|cobro|cobrado|cobré|cobre|me han pagado|me pagan|he gastado|pagu[eé])\b/g, " ");
  let fecha = hoyMadrid();
  if (/\bayer\b/.test(t)) { fecha = hoyMadrid(-1); t = t.replace(/\bayer\b/g, " "); }
  else t = t.replace(/\bhoy\b/g, " ");

  const m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(k|mil|m)?\b/);
  if (!m) return null;
  let importe = m[1].includes(".") && /\.\d{3}/.test(m[1]) ? Number(m[1].replace(/\./g, "")) : Number(m[1].replace(",", "."));
  if (m[2] === "k" || m[2] === "mil") importe *= 1000;
  if (m[2] === "m") importe *= 1_000_000;
  if (!(importe > 0)) return null;
  t = t.replace(m[0], " ").replace(/^\s*\+/, " ");

  let moneda = "EUR";
  for (const [re, c] of MONEDAS) if (re.test(t)) { moneda = c; t = t.replace(re, " "); break; }

  let categoria = "otros";
  for (const [cat, palabras] of Object.entries(CATS)) {
    if (tipo === "ingreso" && !INGRESO_CATS.has(cat)) continue;
    if (tipo === "gasto" && (cat === "trud" || cat === "ventas" || cat === "inversiones")) continue;
    if (palabras.some((p) => t.includes(p))) { categoria = cat; break; }
  }
  const concepto = t.replace(/\b(en|de|por|para|el|la|los|las|un|una)\b/g, " ").replace(/\s+/g, " ").trim();
  return { tipo, importe: Math.round(importe * 100) / 100, moneda, categoria, concepto: concepto ? concepto.charAt(0).toUpperCase() + concepto.slice(1) : null, fecha };
}

const resp = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return resp(405, { ok: false });
  const secreto = req.headers.get("x-jabner-secret") ?? "";   // solo cabecera: en la URL acabaría en logs
  const { data: cfg } = await sb.from("recomp_config").select("valor").eq("clave", "wa_secreto").maybeSingle();
  if (!cfg?.valor || secreto !== cfg.valor) return resp(401, { ok: false });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return resp(400, { ok: false, respuesta: "Formato no válido" }); }
  const tel = normTel(String(body.phone ?? (body as any).contact?.phone ?? ""));
  const texto = String(body.message ?? (body as any).message_body ?? (body as any).body ?? "").trim();

  const { data: quien } = await sb.from("jabner_telefonos").select("profile_id").eq("telefono", tel).maybeSingle();
  // Rastro mínimo para diagnosticar sin guardar el mensaje: final del teléfono y si se ha reconocido.
  console.log(`wa tel=…${tel.slice(-4)} conocido=${!!quien} claves=${Object.keys(body).join(",")} largo=${texto.length}`);
  if (!quien) return resp(200, { ok: false, respuesta: "" }); // número desconocido: no contestar

  const x = interpretar(texto);
  if (!x) console.log("wa sin importe");
  if (!x) return resp(200, { ok: false, respuesta: "No he visto el importe. Ejemplo: 12 comida nirvana, 150k idr gym o +2000 trud." });

  const { error } = await sb.from("jabner_movimientos").insert({ profile_id: quien.profile_id, ...x, origen: "whatsapp", texto_original: texto.slice(0, 500) });
  if (error) { console.error(error); return resp(500, { ok: false, respuesta: "No se pudo guardar. Prueba otra vez." }); }

  const imp = x.importe.toLocaleString("es-ES", { style: "currency", currency: x.moneda, maximumFractionDigits: x.moneda === "IDR" ? 0 : 2 });
  return resp(200, { ok: true, respuesta: `Apuntado: ${x.tipo} de ${imp} en ${x.categoria}${x.concepto ? ` (${x.concepto})` : ""}.` });
});
