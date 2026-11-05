/* Finanzas · gastos e ingresos. */
const Finanzas=(()=>{
const CATS={gasto:['comida','súper','casa','transporte','ocio','gimnasio','salud','ropa','suscripciones','viajes','trabajo','otros'],ingreso:['trud','ventas','inversiones','otros']};
let mes=hoy().slice(0,7), tipo='gasto', movs=[];
const dinero=(n,m)=>{const v=Number(n),a=Math.abs(v);if(a>=1e6)return (v/1e6).toLocaleString('es-ES',{maximumFractionDigits:1})+' M '+m;if(m==='IDR'&&a>=1e4)return (v/1e3).toLocaleString('es-ES',{maximumFractionDigits:0})+'k IDR';const ent=m==='IDR'||Number.isInteger(v);return v.toLocaleString('es-ES',{style:'currency',currency:m,minimumFractionDigits:ent?0:2,maximumFractionDigits:ent?0:2})};
const diasMes=m=>{const [y,mm]=m.split('-').map(Number);return new Date(y,mm,0).getDate()};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

function pintarCats(){$('aCat').innerHTML=CATS[tipo].map(c=>`<option value="${c}">${cap(c)}</option>`).join('')}
async function cargar(){
  const pedido=uid;
  const {data,error}=await SB.from('jabner_movimientos').select('id,fecha,tipo,importe,moneda,categoria,concepto,origen')
    .eq('profile_id',pedido).gte('fecha',mes+'-01').lte('fecha',mes+'-'+pad(diasMes(mes))).order('fecha',{ascending:false}).order('created_at',{ascending:false});
  if(pedido!==uid||fallo(error)) return;
  movs=data.map(m=>({...m,importe:Number(m.importe)})); render();
}
function render(){
  if(typeof cargarResumen==='function') cargarResumen();
  const [y,mm]=mes.split('-').map(Number);
  $('fLabel').textContent=new Date(y,mm-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(' de ',' ').replace(/^./,c=>c.toUpperCase());
  $('fNext').disabled=mes>=hoy().slice(0,7);
  const porMon={};
  for(const m of movs){const o=porMon[m.moneda]||={g:0,i:0,cats:{}}; if(m.tipo==='gasto'){o.g+=m.importe;o.cats[m.categoria]=(o.cats[m.categoria]||0)+m.importe}else o.i+=m.importe}
  const mons=Object.keys(porMon).sort((a,b)=>a==='EUR'?-1:b==='EUR'?1:a.localeCompare(b));
  if(!mons.length) mons.push('EUR'), porMon.EUR={g:0,i:0,cats:{}};
  $('fTotales').innerHTML=mons.map(m=>{const o=porMon[m];return `<div class="mon">${mons.length>1?`<span class="label">${m}</span>`:''}
    <div class="tot"><div><small>Ingresos</small><strong>${dinero(o.i,m)}</strong></div><div><small>Gastos</small><strong>${dinero(o.g,m)}</strong></div><div><small>Balance</small><strong style="color:${o.i-o.g<0?'var(--bad)':'var(--brand)'}">${dinero(o.i-o.g,m)}</strong></div></div></div>`}).join('');
  $('fCats').innerHTML=mons.map(m=>{
    const c=Object.entries(porMon[m].cats).sort((a,b)=>b[1]-a[1]); if(!c.length) return '';
    const max=c[0][1];
    return (mons.length>1?`<span class="label">${m}</span>`:'')+c.map(([k,v])=>`<div class="cat"><span>${cap(esc(k))}</span><div class="bar"><i style="width:${Math.max(3,v/max*100)}%"></i></div><b>${dinero(v,m)}</b></div>`).join('');
  }).join('')||'<p class="muted" style="margin:0">Sin gastos este mes.</p>';
  $('nMov').textContent=movs.length;
  $('movs').innerHTML=movs.map(m=>`<div class="mov"><div class="t"><strong>${esc(m.concepto||cap(m.categoria))}${m.origen==='whatsapp'?'<span class="wa">WhatsApp</span>':''}</strong>
    <small>${parse(m.fecha).toLocaleDateString('es-ES',{day:'numeric',month:'short'})} · ${cap(esc(m.categoria))}</small></div>
    <span class="i ${m.tipo==='ingreso'?'ing':''}">${m.tipo==='ingreso'?'+':'−'}${dinero(m.importe,m.moneda)}</span>
    <button type="button" data-del="${m.id}" aria-label="Borrar">×</button></div>`).join('')||'<p class="muted" style="margin:0">Nada apuntado este mes.</p>';
  $('movs').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('¿Borrar este movimiento?')) return;
    const {error}=await SB.from('jabner_movimientos').delete().eq('id',b.dataset.del);
    if(!fallo(error)) cargar();
  }));
}
document.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>{tipo=b.dataset.t;document.querySelectorAll('[data-t]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.t===tipo));pintarCats()}));
$('alta').addEventListener('submit',async e=>{
  e.preventDefault(); const importe=num($('aImp').value); if(!importe||importe<=0) return;
  const {error}=await SB.from('jabner_movimientos').insert({profile_id:uid,tipo,importe,moneda:$('aMon').value,categoria:$('aCat').value,concepto:$('aCon').value.trim()||null,fecha:$('aFecha').value});
  if(fallo(error)){$('aMsg').textContent='No se pudo guardar.';return}
  $('aImp').value='';$('aCon').value='';$('aMsg').textContent='Guardado.';setTimeout(()=>$('aMsg').textContent='',2000);
  mes=$('aFecha').value.slice(0,7); cargar();
});
const mover=n=>{const [y,m]=mes.split('-').map(Number);const d=new Date(y,m-1+n,1);mes=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;cargar()};
$('fPrev').addEventListener('click',()=>mover(-1));
$('fNext').addEventListener('click',()=>mover(1));
$('aFecha').value=hoy(); pintarCats();
return {cargar,dinero};
})();
