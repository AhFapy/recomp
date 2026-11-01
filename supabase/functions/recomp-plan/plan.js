// Convierte las hojas del plan del entrenador (una pestaña por semana) en
// { semanas: [{ hoja, bloque, semana, objetivo, dias: [{ n, nombre, dia, ejercicios: [...] }] }] }.
// rows: matriz de celdas como texto (lo mismo que un CSV de la pestaña).
const T = (c) => String(c ?? "").replace(/\s+/g, " ").trim();
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function parseSemana(hoja, rows) {
  const out = { hoja, bloque: "", semana: null, objetivo: "", notas: "", dias: [] };
  let split = [];
  for (let i = 0; i < rows.length; i++) {
    const r = Array.from({ length: Math.max(32, rows[i].length) }, (_, j) => T(rows[i][j]));
    if (r[2] === "Semana" && r[3]) out.semana = Number(r[3]) || null;
    if (r[2] === "Bloque" && r[3]) out.bloque = r[3];
    if (r.includes("OBJETIVOS DE LA SEMANA")) {
      const j = r.indexOf("OBJETIVOS DE LA SEMANA");
      out.objetivo = T(rows[i + 1]?.[j]);
    }
    const dIdx = r.map((c, j) => (DIAS.includes(c.toLowerCase()) ? j : -1)).filter((j) => j >= 0);
    if (dIdx.length === 7 && !split.length) {
      const nx = (rows[i + 1] || []).map(T);
      split = dIdx.map((j, k) => ({ dia: DIAS[k], tipo: nx[j] || "" }));
    }
  }
  const sesiones = split.filter((s) => s.tipo && !/descanso/i.test(s.tipo));
  let dia = null;
  for (const raw of rows) {
    const r = Array.from({ length: 32 }, (_, j) => T(raw[j]));
    const m = r[1].match(/^D[ií]a\s*(\d+)/i);
    if (m) {
      const n = Number(m[1]);
      const s = sesiones[n - 1];
      const propio = r[4] && !/EJERCICIOS SESI/i.test(r[4]) ? r[4] : "";
      dia = { n, nombre: s?.tipo || propio || `Día ${n}`, dia: s?.dia || null, ejercicios: [] };
      out.dias.push(dia);
      continue;
    }
    if (dia && r[4] && !r[5] && !r[3] && r[4].length > 25) { out.notas = [out.notas, r[4]].filter(Boolean).join(" "); continue; }
    if (!dia || !r[4] || !/\d/.test(r[5]) || /SERIES/i.test(r[5])) continue;
    const series = parseInt(r[5], 10) || 1;
    const reps = r[6].replace(/\s*x\s*$/i, "").trim();
    const intensidad = [r[10] + (r[11] || ""), r[12]].map((x) => x.replace(/^x\s*/i, "").replace(/\s*-\s*/g, "-").trim()).filter(Boolean).join(" · ");
    const pauta = `${series} × ${reps}${r[9] ? " · " + r[9] : ""}${intensidad ? " · " + intensidad : ""}`;
    const prev = dia.ejercicios[dia.ejercicios.length - 1];
    if (prev && prev.nombre === r[4]) {
      prev.series += series;
      prev.pautas.push(pauta);
      if (r[18] && !prev.notas.includes(r[18])) prev.notas = [prev.notas, r[18]].filter(Boolean).join(" ");
      continue;
    }
    dia.ejercicios.push({
      nombre: r[4],
      tipo: r[3],
      series,
      pautas: [pauta],
      descanso: r[14].replace(/^REST\s*/i, "").replace(/''|"/g, "″").trim(),
      notas: r[18],
      reps: /dominad|fondos|flexion/i.test(r[4]) && !/lastrad/i.test(r[4]),
    });
  }
  return out;
}

export function parsePlan(hojas) {
  return {
    semanas: hojas.filter((h) => /semana/i.test(h.nombre)).map((h) => parseSemana(h.nombre, h.rows)).filter((s) => s.dias.length),
  };
}
