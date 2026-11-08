/* Jabner · arranque de la pantalla única y cifras de arriba. */
let movs90=[], habLog30=[];
async function cargarResumen(){
  const pedido=uid; if(!pedido) return;
  const [m,l]=await Promise.all([
    SB.from('jabner_movimientos').select('fecha,tipo,importe,moneda,categoria').eq('profile_id',pedido).gte('fecha',addDays(hoy(),-45)),
    SB.from('jabner_habitos_log').select('habito_id,fecha,hecho').eq('profile_id',pedido).gte('fecha',addDays(hoy(),-30)),
  ]);
  if(pedido!==uid||fallo(m.error||l.error)) return;
  movs90=m.data; habLog30=l.data; pintarResumen();
}
function pintarResumen(){
  if(!uid) return;
  const t=hoy(), d=dia(t), r=RL.racha(state.dias,t), tot=totales(d), hb=Habitos.resumen();
  $('eyebrow').textContent=parse(t).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  $('kRacha').innerHTML=`${r}<small>${r===1?'día':'días'}</small>`;
  $('kRachaP').textContent=`Meta: ${RL.siguienteMeta(r)}`;
  $('kProt').innerHTML=`${ent(tot.p)}<small>g</small>`;
  $('kProtP').textContent=`de ${ent(metaProt())} g · ${ent(tot.k)} kcal`;
  $('kHab').textContent=hb.total?`${hb.verdes}/${hb.total}`:'—';
  $('kHabP').textContent=hb.total?'en verde':'Sin hábitos';
  const mes=t.slice(0,7), g={};
  for(const m of movs90) if(m.tipo==='gasto'&&m.fecha.startsWith(mes)) g[m.moneda]=(g[m.moneda]||0)+Number(m.importe);
  const mon=Object.keys(g).sort((a,b)=>a==='EUR'?-1:b==='EUR'?1:0);
  $('kGasto').textContent=Finanzas.dinero(mon.length?g[mon[0]]:0,mon[0]||'EUR');
  $('kGastoP').textContent=mon.length>1?'y '+mon.slice(1).map(x=>Finanzas.dinero(g[x],x)).join(' · '):'Por WhatsApp o a mano';
  const cs=conclusiones({dias:state.dias,meds:state.meds,obj:state.obj,habitos:hb.lista,habLog:habLog30,movs:movs90,hoyS:t,metaProt:metaProt(),metaKcal:metaKcal(),objetivoSemanal:objetivoSemanal()});
  $('conclus').innerHTML=cs.map(c=>`<li><i class="${c.tono}"></i><span>${esc(c.texto)}</span></li>`).join('')||'<li><span class="muted">Apunta unos días y aquí saldrá cómo vas.</span></li>';
}
jabner(async c=>{await Promise.all([cargar(c),Habitos.cargar(),Finanzas.cargar(),cargarResumen()]);pintarResumen()});
/* Lo que entra por WhatsApp aparece solo: cada 20 s con la pestaña a la vista, y al volver a la ventana. */
const refrescarFin=()=>{if(!uid||document.hidden)return;const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;Finanzas.cargar()};
setInterval(refrescarFin,60000);   // respaldo: lo normal es el tiempo real
addEventListener('focus',refrescarFin);
