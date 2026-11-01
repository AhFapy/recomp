// Recomp · "cuéntame qué has comido": Claude estima platos y macros y saca una conclusión del día.
// Entrada: { texto, objetivo: {prot, kcal}, llevas: {prot, kcal} }. Salida: { platos: [{n,k,p,c,f}], dieta: 1-3, conclusion }.
// La web es pública: tope de llamadas por día y de longitud del texto para no pagar abusos.
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MAX_DIA = 80;
const ORIGEN = /^https:\/\/jabner\.vercel\.app$|^https:\/\/recomp(-[a-z0-9-]+)?-trud-sales\.vercel\.app$/;

const TOOL = {
  name: "apuntar_comida",
  description: "Apunta lo que ha comido la persona, con macros estimadas por plato, y una conclusión breve.",
  input_schema: {
    type: "object",
    properties: {
      platos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "string", description: "Nombre corto del plato con la cantidad estimada, en español" },
            k: { type: "number", description: "kcal" }, p: { type: "number", description: "proteína en g" },
            c: { type: "number", description: "carbohidratos en g" }, f: { type: "number", description: "grasa en g" },
          },
          required: ["n", "k", "p", "c", "f"],
        },
      },
      dieta: { type: "integer", enum: [1, 2, 3], description: "Cómo va el día de comida contando lo que ya llevaba: 1 mal, 2 más o menos, 3 perfecto, para recomposición corporal (perder grasa manteniendo músculo)" },
      conclusion: { type: "string", description: "Una o dos frases directas en español: cómo va el día y qué le conviene en la próxima comida (sobre todo proteína y calorías que le quedan)." },
    },
    required: ["platos", "dieta", "conclusion"],
  },
};

Deno.serve(async (req) => {
  const origen = req.headers.get("origin") ?? "";
  const CORS = {
    "Vary": "Origin",
    "Access-Control-Allow-Origin": ORIGEN.test(origen) ? origen : "https://jabner.vercel.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-recomp-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const resp = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return resp(405, { error: "método" });
  if (!KEY) return resp(503, { error: "Falta la clave de Claude en Supabase (ANTHROPIC_API_KEY)." });

  let b: any = {};
  try { b = await req.json(); } catch { return resp(400, { error: "Formato no válido" }); }
  const texto = String(b.texto ?? "").trim().slice(0, 600);
  if (texto.length < 3) return resp(400, { error: "Cuéntame qué has comido." });
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);

  // Tope diario de llamadas (la web no tiene llave).
  const hoy = new Date().toISOString().slice(0, 10), ck = "comida_ia:" + hoy;
  const { data: cnt } = await sb.from("recomp_config").select("valor").eq("clave", ck).maybeSingle();
  const usados = Number(cnt?.valor ?? 0);
  if (usados >= MAX_DIA) return resp(429, { error: "Por hoy ya se ha usado mucho. Apúntalo de la carta o a mano." });
  await sb.from("recomp_config").upsert({ clave: ck, valor: String(usados + 1) });

  const contexto = `Objetivo diario: ${n(b.objetivo?.prot, 170)} g de proteína y ${n(b.objetivo?.kcal, 2000)} kcal. ` +
    `Hoy ya llevaba apuntado: ${n(b.llevas?.prot, 0)} g de proteína y ${n(b.llevas?.kcal, 0)} kcal.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 800,
      system: "Eres el nutricionista de una app de recomposición corporal. La persona te cuenta en lenguaje natural lo que ha comido (a veces en casa de sus padres en España, a veces en restaurantes de Bali). " +
        "Divide lo que cuenta en platos, estima cantidades razonables de ración normal si no las dice y calcula macros realistas, sin redondear a la baja. " +
        "Si dice algo que no es comida, devuelve platos vacíos y explícalo en la conclusión. Contesta siempre llamando a la herramienta.",
      tools: [TOOL],
      tool_choice: { type: "tool", name: "apuntar_comida" },
      messages: [{ role: "user", content: `${contexto}\n\nLo que he comido ahora:\n${texto}` }],
    }),
  });
  if (!r.ok) { console.error(r.status, await r.text()); return resp(502, { error: "Claude no ha contestado. Prueba en un momento." }); }
  const out = await r.json();
  const uso = out.content?.find((x: any) => x.type === "tool_use")?.input;
  if (!uso) return resp(502, { error: "No he podido interpretarlo." });
  const platos = (Array.isArray(uso.platos) ? uso.platos : []).slice(0, 12).map((x: any) => ({
    n: String(x.n ?? "Comida").slice(0, 80), k: n(x.k, 0), p: n(x.p, 0), c: n(x.c, 0), f: n(x.f, 0),
  }));
  return resp(200, { platos, dieta: [1, 2, 3].includes(uso.dieta) ? uso.dieta : null, conclusion: String(uso.conclusion ?? "").slice(0, 400) });
});
