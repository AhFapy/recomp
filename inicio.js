const dinero=(n,m)=>{const v=Number(n),a=Math.abs(v);if(a>=1e6)return (v/1e6).toLocaleString('es-ES',{maximumFractionDigits:1})+' M '+m;if(m==='IDR'&&a>=1e4)return (v/1e3).toLocaleString('es-ES',{maximumFractionDigits:0})+'k IDR';const ent=m==='IDR'||Number.isInteger(v);return v.toLocaleString('es-ES',{style:'currency',currency:m,minimumFractionDigits:ent?0:2,maximumFractionDigits:ent?0:2})};
async function cargar(){
  const pedido=uid, t=hoy(), mes=t.slice(0,8)+'01';
  const [d,o,h,l,mv]=await Promise.all([
    SB.from('recomp_dias').select('fecha,peso').eq('profile_id',pedido).not('peso','is',null).order('fecha',{ascending:false}).limit(1),
    SB.from('recomp_objetivos').select('peso_objetivo').eq('profile_id',pedido).maybeSingle(),
    SB.from('jabner_habitos').select('id').eq('profile_id',pedido).eq('activo',true),
    SB.from('jabner_habitos_log').select('habito_id,hecho').eq('profile_id',pedido).eq('fecha',t),
    SB.from('jabner_movimientos').select('tipo,importe,moneda').eq('profile_id',pedido).gte('fecha',mes),
  ]);
  if(pedido!==uid) return;
  if(fallo(d.error||o.error||h.error||l.error||mv.error)) return;
  const p=d.data[0]?.peso, obj=o.data?.peso_objetivo;
  $('rBig').innerHTML=p!=null?`${Number(p).toLocaleString('es-ES')}<small style="font-size:16px"> kg</small>`:'—';
  $('rChip').textContent=obj!=null?'Objetivo '+Number(obj).toLocaleString('es-ES')+' kg':'Sin objetivo';
  const ids=new Set(h.data.map(x=>x.id)), verdes=l.data.filter(x=>x.hecho&&ids.has(x.habito_id)).length;
  $('hBig').textContent=h.data.length?`${verdes}/${h.data.length}`:'—';
  $('hSub').textContent=h.data.length?'hábitos en verde hoy':'Monta tu cartulina';
  const g={}; for(const m of mv.data) if(m.tipo==='gasto') g[m.moneda]=(g[m.moneda]||0)+Number(m.importe);
  const mon=Object.keys(g).sort((a,b)=>(a==='EUR'?-1:b==='EUR'?1:0));
  $('fBig').textContent=mon.length?dinero(g[mon[0]],mon[0]):dinero(0,'EUR');
  $('fSub').textContent=mon.length>1?'gastado · también '+mon.slice(1).map(m=>dinero(g[m],m)).join(' · '):'gastado este mes';
}
jabner(null,cargar);
