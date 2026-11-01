/* Recomp · reglas puras (sin DOM): semáforo del día, racha, semanas y "cómo vas".
   Se cargan en la web y también en node para las pruebas. */
(function(raiz){
const pad2=n=>String(n).padStart(2,'0');
const isoD=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseD=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const sumar=(s,n)=>{const d=parseD(s);d.setDate(d.getDate()+n);return isoD(d)};
const lunesDe=s=>sumar(s,-((parseD(s).getDay()+6)%7));
const diasEntre=(a,b)=>Math.round((parseD(b)-parseD(a))/864e5);

/* ---------- semáforo ---------- */
const colorPasos=p=>p==null?null:p<5000?'r':p<10000?'a':'v';
const colorNivel=n=>n==null?null:['r','a','v'][n-1]||null;
// Entreno del día: sesión del plan (con peso apuntado o marcada), entreno suelto o extra.
const entrenado=d=>!!d&&(!!(d.entreno&&(d.entreno.hecho||Object.keys(d.entreno.pesos||{}).length))||(d.hechos||[]).includes('fuerza')||(d.extras||[]).length>0);
const sesionDe=d=>d&&d.entreno&&d.entreno.sesion!=null&&(d.entreno.hecho||Object.keys(d.entreno.pesos||{}).length)?d.entreno.sesion:null;
const colorEntreno=d=>entrenado(d)||d?.descanso?'v':'r';
const apuntado=d=>!!d&&d.pasos!=null&&d.dieta!=null;

/* El día es rojo solo si falla todo a la vez (pocos pasos + comida mal + sin entreno ni descanso),
   verde con los 4 en verde y si no amarillo. Sin pasos o sin comida: sin apuntar (null). */
function colorDia(d){
  if(!apuntado(d)) return null;
  const p=colorPasos(d.pasos), s=colorNivel(d.sueno), c=colorNivel(d.dieta), e=colorEntreno(d);
  if(p==='r'&&c==='r'&&e==='r') return 'r';
  if(p==='v'&&s==='v'&&c==='v'&&e==='v') return 'v';
  return 'a';
}

/* ---------- racha ---------- */
const METAS=[7,14,21,30,45,60,90,120,180,270,365];
function siguienteMeta(n){for(const m of METAS) if(m>n) return m; return (Math.floor(n/100)+1)*100}
function metaAnterior(n){let a=0;for(const m of METAS) if(m<=n) a=m; if(n>=365) a=Math.max(365,Math.floor(n/100)*100); return a}
// Días amarillos o verdes seguidos. La corta un día rojo o un día pasado sin apuntar. Hoy sin apuntar no corta.
function racha(dias,hoyS){
  let n=0, f=hoyS;
  if(!colorDia(dias[f])) f=sumar(f,-1);
  for(let i=0;i<3000;i++){const c=colorDia(dias[f]); if(c==='a'||c==='v'){n++;f=sumar(f,-1)}else break}
  return n;
}
function mejorRacha(dias,hoyS){
  const fs=Object.keys(dias).filter(f=>f<=hoyS).sort(); if(!fs.length) return 0;
  let best=0, cur=0, prev=null;
  for(let f=fs[0];f<=hoyS;f=sumar(f,1)){
    const c=colorDia(dias[f]);
    if(c==='a'||c==='v'){cur=(prev===sumar(f,-1)?cur:0)+1;prev=f;best=Math.max(best,cur)}
    else if(f!==hoyS){cur=0;prev=null}
  }
  return best;
}

/* ---------- semanas ---------- */
// Sesiones distintas hechas en la semana (lunes a domingo). Cada semana cuenta sola.
function semana(dias,lunes,objetivo){
  const ses=new Set(); let sueltos=0, descansos=0, entrenos=0;
  for(let i=0;i<7;i++){const d=dias[sumar(lunes,i)]; if(!d) continue;
    if(d.descanso) descansos++;
    // Los extras (pádel, yoga…) cuentan para el color del día, no para las sesiones de la semana.
    const s=sesionDe(d); if(s!=null) ses.add(s); else if(d.entreno?.hecho||(d.hechos||[]).includes('fuerza')) sueltos++;
    if(entrenado(d)) entrenos++;
  }
  const hechas=ses.size+sueltos;
  return {hechas,sesiones:[...ses],descansos,entrenos,objetivo,completa:hechas>=objetivo,faltan:Math.max(0,objetivo-hechas)};
}

/* ---------- cómo vas ---------- */
// Línea recta desde (inicio, peso inicial) hasta (fecha objetivo, peso objetivo).
function lineaPlan(obj,f){
  if(!obj) return null; const tot=diasEntre(obj.fecha_inicio,obj.fecha_objetivo); if(tot<=0) return null;
  const t=Math.max(0,Math.min(1,diasEntre(obj.fecha_inicio,f)/tot));
  return obj.peso_inicial+(obj.peso_objetivo-obj.peso_inicial)*t;
}
const PEOR={'En línea':0,'Casi':1,'Fuera':2};
function comoVas(meds,obj,dias,hoyS){
  const ult=meds.length?meds[meds.length-1]:null;
  if(!ult||!obj) return null;
  const linea=lineaPlan(obj,ult.fecha);
  const baja=obj.peso_objetivo<=obj.peso_inicial;
  const sobra=baja?ult.peso-linea:linea-ult.peso;             // kg por encima de la línea (o por debajo si sube)
  const porPeso=sobra<=0.5?'En línea':sobra<=1.5?'Casi':'Fuera';
  let buenos=0; for(let i=1;i<=7;i++){const c=colorDia(dias[sumar(hoyS,-i)]); if(c==='a'||c==='v') buenos++}
  const pct=buenos/7;
  const porDias=pct<0.6?'Fuera':pct<0.8?'Casi':'En línea';
  const estado=PEOR[porPeso]>=PEOR[porDias]?porPeso:porDias;
  const faltanDias=Math.max(0,diasEntre(hoyS,obj.fecha_objetivo));
  const faltanKg=ult.peso-obj.peso_objetivo;
  const ritmo=faltanDias>0?faltanKg/(faltanDias/7):null;   // kg por semana que hay que bajar (positivo = bajar)
  return {estado,porPeso,porDias,sobra,linea,pctDias:pct,ult,faltanDias,faltanKg,ritmo,viejo:diasEntre(ult.fecha,hoyS)>42,diasInbody:diasEntre(ult.fecha,hoyS)};
}

const R={isoD,parseD,sumar,lunesDe,diasEntre,colorPasos,colorNivel,colorEntreno,entrenado,sesionDe,apuntado,colorDia,METAS,siguienteMeta,metaAnterior,racha,mejorRacha,semana,lineaPlan,comoVas};
if(typeof module!=='undefined'&&module.exports) module.exports=R; else raiz.RL=R;
})(this);
