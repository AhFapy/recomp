/* Jabner · conclusiones a partir de todo lo apuntado. Reglas puras, sin red ni IA: salen siempre y al momento.
   Devuelve como mucho 5 frases, primero lo que va mal. */
(function(raiz){
const RLx=typeof RL!=='undefined'?RL:require('./recomp-logica.js');
const n0=v=>Math.round(v).toLocaleString('es-ES');
const media=a=>a.reduce((s,x)=>s+x,0)/a.length;
function conclusiones({dias,meds,obj,habitos,habLog,movs,hoyS,metaProt,metaKcal,objetivoSemanal}){
  const out=[], add=(tono,texto)=>out.push({tono,texto});
  const ult7=[]; for(let i=1;i<=7;i++) ult7.push(RLx.sumar(hoyS,-i));
  const D=ult7.map(f=>dias[f]).filter(Boolean);
  const apuntados=ult7.filter(f=>RLx.apuntado(dias[f])).length;
  if(apuntados<4) add('mal',`Solo has apuntado ${apuntados} de los últimos 7 días. Con tan poco, el resto de datos dice poco.`);
  else{const b=ult7.filter(f=>['a','v'].includes(RLx.colorDia(dias[f]))).length; add(b>=6?'ok':b>=4?'neutro':'mal',`${b} de los últimos 7 días en amarillo o verde.`)}
  const conComida=D.filter(d=>(d.comidas||[]).length);
  if(conComida.length>=2){
    const p=media(conComida.map(d=>d.comidas.reduce((s,x)=>s+(+x.p||0),0))), k=media(conComida.map(d=>d.comidas.reduce((s,x)=>s+(+x.k||0),0)));
    add(p<metaProt*.85?'mal':p>=metaProt*.95?'ok':'neutro',`Proteína media de ${n0(p)} g al día, con objetivo de ${n0(metaProt)} g.`);
    if(k>metaKcal*1.1) add('mal',`Calorías medias de ${n0(k)} kcal, por encima de las ${n0(metaKcal)} del objetivo.`);
  }
  const pasos=D.map(d=>d.pasos).filter(v=>v!=null);
  if(pasos.length>=3){const m=media(pasos); add(m<7000?'mal':m>=10000?'ok':'neutro',`Media de ${n0(m)} pasos al día.`)}
  const malSueno=D.filter(d=>d.sueno===1).length;
  if(malSueno>=2) add('mal',`${malSueno} noches de menos de 6 h en los últimos 7 días.`);
  const lunPas=RLx.sumar(RLx.lunesDe(hoyS),-7), sem=RLx.semana(dias,lunPas,objetivoSemanal);
  if(Object.keys(dias).some(f=>f>=lunPas&&f<RLx.lunesDe(hoyS))) add(sem.completa?'ok':'mal',`La semana pasada hiciste ${sem.hechas} de ${objetivoSemanal} sesiones.`);
  const cv=RLx.comoVas(meds,obj,dias,hoyS);
  if(cv){
    if(cv.viejo) add('mal',`Tu último InBody es de hace ${cv.diasInbody} días: toca otro para saber si vas en línea.`);
    else if(cv.sobra>0.5) add(cv.porPeso==='Fuera'?'mal':'neutro',`Vas ${cv.sobra.toLocaleString('es-ES',{maximumFractionDigits:1})} kg por encima de la línea hacia tu objetivo.`);
    if(cv.ritmo!=null&&Math.abs(cv.ritmo)>1) add('mal',`Para llegar a tiempo necesitas ${Math.abs(cv.ritmo).toLocaleString('es-ES',{maximumFractionDigits:2})} kg por semana. Es un ritmo alto: revisa la fecha o el objetivo.`);
  }
  const porHab={}; for(const l of habLog||[]) if(l.fecha<hoyS&&l.fecha>=RLx.sumar(hoyS,-14)){const o=porHab[l.habito_id]||={v:0,t:0};o.t++;if(l.hecho)o.v++}
  const cand=(habitos||[]).map(x=>({n:x.nombre,...(porHab[x.id]||{v:0,t:0})})).filter(x=>x.t>=5).sort((a,b)=>a.v/a.t-b.v/b.t);
  if(cand.length&&cand[0].v/cand[0].t<.5) add('mal',`Tu hábito más flojo: ${cand[0].n}, ${Math.round(cand[0].v/cand[0].t*100)} % en verde en 14 días.`);
  const eur=(movs||[]).filter(m=>m.moneda==='EUR'&&m.fecha>=RLx.sumar(hoyS,-30));
  const g=eur.filter(m=>m.tipo==='gasto'), ing=eur.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+Number(m.importe),0), tg=g.reduce((s,m)=>s+Number(m.importe),0);
  if(g.length>=3){const cats={}; for(const m of g) cats[m.categoria]=(cats[m.categoria]||0)+Number(m.importe);
    const [c,v]=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
    add(ing&&tg>ing?'mal':'neutro',`${n0(tg)} € gastados en 30 días${ing?` frente a ${n0(ing)} € de ingresos`:''}. Lo que más pesa: ${c}, ${n0(v)} €.`)}
  const orden={mal:0,neutro:1,ok:2};
  return out.map((x,i)=>({...x,i})).sort((a,b)=>orden[a.tono]-orden[b.tono]||a.i-b.i).slice(0,5).map(({tono,texto})=>({tono,texto}));
}
if(typeof module!=='undefined'&&module.exports) module.exports=conclusiones; else raiz.conclusiones=conclusiones;
})(this);
