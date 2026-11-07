/* Finanzas · gastos e ingresos. Un ingreso guarda lo que queda (importe = beneficio) y, si fue distinto, lo facturado. */
const Finanzas=(()=>{
const CATS={gasto:['comida','súper','casa','transporte','ocio','gimnasio','salud','ropa','suscripciones','viajes','trabajo','otros'],ingreso:['trud','ventas','inversiones','otros']};
let mes=hoy().slice(0,7), tipo='gasto', todos=[];
const dinero=(n,m='EUR')=>{const v=Number(n),a=Math.abs(v);if(a>=1e6)return (v/1e6).toLocaleString('es-ES',{maximumFractionDigits:1})+' M '+m;if(m==='IDR'&&a>=1e4)return (v/1e3).toLocaleString('es-ES',{maximumFractionDigits:0})+'k IDR';const ent=m==='IDR'||Number.isInteger(v);return v.toLocaleString('de-DE',{style:'currency',currency:m,minimumFractionDigits:ent?0:2,maximumFractionDigits:ent?0:2})};
const eur=v=>Math.round(v).toLocaleString('de-DE')+' €';   // de-DE agrupa también los miles de 4 cifras (2.500)
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const mesTxt=(m,f)=>{const [y,mm]=m.split('-').map(Number);return new Date(y,mm-1,1).toLocaleDateString('es-ES',f)};
const fac=m=>m.facturado!=null?m.facturado:m.importe;

function pintarCats(){$('aCat').innerHTML=CATS[tipo].map(c=>`<option value="${c}">${cap(c)}</option>`).join('');$('aFac').hidden=tipo!=='ingreso'}
async function cargar(){
  const pedido=uid; const d=new Date(); d.setMonth(d.getMonth()-11); d.setDate(1);
  const desde=iso(d)<mes+'-01'?iso(d):mes+'-01';
  const {data,error}=await SB.from('jabner_movimientos').select('id,fecha,tipo,importe,facturado,moneda,categoria,concepto,origen')
    .eq('profile_id',pedido).gte('fecha',desde).order('fecha',{ascending:false}).order('created_at',{ascending:false});
  if(pedido!==uid||fallo(error)) return;
  todos=data.map(m=>({...m,importe:Number(m.importe),facturado:m.facturado==null?null:Number(m.facturado)})); render();
}
function porMes(){
  const r={};
  for(const m of todos){ if(m.moneda!=='EUR') continue; const k=m.fecha.slice(0,7), o=r[k]||={f:0,i:0,g:0};
    if(m.tipo==='ingreso'){o.i+=m.importe;o.f+=fac(m)} else o.g+=m.importe }
  return r;
}
function render(){
  if(typeof cargarResumen==='function') cargarResumen();
  $('fLabel').textContent=mesTxt(mes,{month:'long',year:'numeric'}).replace(' de ',' ').replace(/^./,c=>c.toUpperCase());
  $('fNext').disabled=mes>=hoy().slice(0,7);
  const movs=todos.filter(m=>m.fecha.startsWith(mes)), e=movs.filter(m=>m.moneda==='EUR');
  const ing=e.filter(m=>m.tipo==='ingreso'), gas=e.filter(m=>m.tipo==='gasto');
  const tI=ing.reduce((s,m)=>s+m.importe,0), tF=ing.reduce((s,m)=>s+fac(m),0), tG=gas.reduce((s,m)=>s+m.importe,0), bal=tI-tG;
  $('fTotales').innerHTML=[['Facturado',dinero(tF),''],['Ingresos',dinero(tI),'ing'],['Gastos',dinero(tG),'gas'],['Balance',dinero(bal),bal<0?'neg':'pos']]
    .map(([n,v,c])=>`<div class="fk ${c}"><small>${n}</small><strong>${v}</strong></div>`).join('');
  const otras={}; for(const m of movs) if(m.moneda!=='EUR'){const o=otras[m.moneda]||={i:0,g:0}; o[m.tipo==='ingreso'?'i':'g']+=m.importe}
  const ot=Object.entries(otras); $('fOtras').hidden=!ot.length;
  $('fOtras').textContent=ot.map(([k,o])=>`${k}: ${o.i?'+'+dinero(o.i,k)+' ':''}${o.g?'−'+dinero(o.g,k):''}`).join(' · ');
  // hoja del mes
  $('nMov').textContent=movs.length;
  const fila=m=>{const wa=m.origen==='whatsapp'?'<span class="wa">WA</span>':'', mon=m.moneda!=='EUR';
    return m.tipo==='ingreso'
      ? `<tr><td class="c">${esc(m.concepto||'Ingreso')}${wa}</td><td class="n muted">${m.facturado!=null?dinero(m.facturado,m.moneda):''}</td><td class="n ing">${dinero(m.importe,m.moneda)}</td><td><button type="button" data-del="${m.id}" aria-label="Borrar">×</button></td></tr>`
      : `<tr><td class="c">${esc(m.concepto||cap(m.categoria))}${wa}</td><td class="cat-c muted">${cap(esc(m.categoria))}</td><td class="n">${dinero(m.importe,m.moneda)}</td><td><button type="button" data-del="${m.id}" aria-label="Borrar">×</button></td></tr>`};
  const vacio=t=>`<tr><td colspan="4" class="muted vacio">${t}</td></tr>`;
  $('hIng').innerHTML=movs.filter(m=>m.tipo==='ingreso').map(fila).join('')||vacio('Sin ingresos este mes.');
  $('hGas').innerHTML=movs.filter(m=>m.tipo==='gasto').map(fila).join('')||vacio('Sin gastos este mes.');
  $('hIngTot').textContent=dinero(tI); $('hGasTot').textContent=dinero(tG);
  document.querySelectorAll('#hIng [data-del],#hGas [data-del]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('¿Borrar este movimiento?')) return;
    const {error}=await SB.from('jabner_movimientos').delete().eq('id',b.dataset.del);
    if(!fallo(error)) cargar();
  }));
  // en qué se va
  const cats={}; for(const m of gas) cats[m.categoria]=(cats[m.categoria]||0)+m.importe;
  const c=Object.entries(cats).sort((a,b)=>b[1]-a[1]), max=c[0]?.[1]||1;
  $('fCats').innerHTML=c.map(([k,v])=>`<div class="cat"><span>${cap(esc(k))}</span><div class="bar"><i style="width:${Math.max(3,v/max*100)}%"></i></div><b>${dinero(v)}</b></div>`).join('')||'<p class="muted" style="margin:0">Sin gastos este mes.</p>';
  meses();
}
function meses(){
  const r=porMes(), hoyM=hoy().slice(0,7);
  const ks=[]; {const d=new Date(); d.setDate(1); for(let i=11;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);ks.push(`${x.getFullYear()}-${pad(x.getMonth()+1)}`)}}
  const ini=ks.findIndex(k=>r[k]); const lista=ini<0?[hoyM]:ks.slice(ini);
  // gráfica de columnas
  const W=Math.max(300,Math.round($('fGraf').clientWidth||760)),H=W<600?190:240,P={l:40,r:4,t:12,b:26}, n=lista.length, gw=(W-P.l-P.r)/n, bw=Math.min(18,gw/4);
  const top=Math.max(1,...lista.map(k=>Math.max(r[k]?.f||0,r[k]?.g||0)));
  const paso=Math.pow(10,Math.floor(Math.log10(top))), m2=Math.ceil(top/paso)*paso;
  const Y=v=>P.t+(H-P.t-P.b)*(1-v/m2);
  let s=`<svg class="fgraf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Facturado, ingresos y gastos por mes">`;
  for(let i=0;i<=4;i++){const v=m2*i/4;s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${v>=1000?(v/1000).toLocaleString('es-ES',{maximumFractionDigits:1})+'k':v}</text>`}
  lista.forEach((k,i)=>{const o=r[k]||{f:0,i:0,g:0}, x=P.l+gw*i+gw/2, sel=k===mes;
    if(sel) s+=`<rect x="${P.l+gw*i+2}" y="${P.t}" width="${gw-4}" height="${H-P.t-P.b}" rx="8" fill="var(--brand-soft)"/>`;
    const bar=(v,dx,col,n2)=>`<rect x="${x+dx-bw/2}" y="${Y(v)}" width="${bw}" height="${Math.max(0,Y(0)-Y(v))}" rx="3" fill="${col}"><title>${mesTxt(k,{month:'long'})} · ${n2}: ${eur(v)}</title></rect>`;
    s+=bar(o.f,-bw*1.1,'var(--line2)','Facturado')+bar(o.i,0,'var(--brand)','Ingresos')+bar(o.g,bw*1.1,'var(--bad)','Gastos');
    s+=`<text x="${x}" y="${H-8}" text-anchor="middle" font-size="11" fill="${sel?'var(--ink)':'var(--muted)'}" font-weight="${sel?600:400}">${mesTxt(k,{month:'short'}).replace('.','')}</text>`;
    s+=`<rect x="${P.l+gw*i}" y="0" width="${gw}" height="${H}" fill="transparent" data-m="${k}" style="cursor:pointer"/>`;
  });
  $('fGraf').innerHTML=s+'</svg>';
  if(!meses.oyendo){meses.oyendo=true;let t;addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(()=>{if(todos.length)meses()},200)})}
  // tabla
  const T={f:0,i:0,g:0};
  $('fMeses').innerHTML=[...lista].reverse().map(k=>{const o=r[k]||{f:0,i:0,g:0},b=o.i-o.g; T.f+=o.f;T.i+=o.i;T.g+=o.g;
    return `<tr data-m="${k}" class="${k===mes?'sel':''}"><td>${cap(mesTxt(k,{month:'short',year:'2-digit'}).replace('.',''))}</td><td class="n">${eur(o.f)}</td><td class="n ing">${eur(o.i)}</td><td class="n">${eur(o.g)}</td><td class="n ${b<0?'neg':''}">${eur(b)}</td></tr>`}).join('');
  $('fTotal').innerHTML=`<tr><td>Total</td><td class="n">${eur(T.f)}</td><td class="n ing">${eur(T.i)}</td><td class="n">${eur(T.g)}</td><td class="n ${T.i-T.g<0?'neg':''}">${eur(T.i-T.g)}</td></tr>`;
  document.querySelectorAll('#fGraf [data-m],#fMeses [data-m]').forEach(el=>el.addEventListener('click',()=>{mes=el.dataset.m;render();$('finanzas').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}));
}
document.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>{tipo=b.dataset.t;document.querySelectorAll('[data-t]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.t===tipo));pintarCats()}));
$('alta').addEventListener('submit',async e=>{
  e.preventDefault(); const importe=num($('aImp').value); if(!importe||importe<=0) return;
  const f=tipo==='ingreso'?num($('aFac').value):null;
  const {error}=await SB.from('jabner_movimientos').insert({profile_id:uid,tipo,importe,facturado:f&&f!==importe?f:null,moneda:$('aMon').value,categoria:$('aCat').value,concepto:$('aCon').value.trim()||null,fecha:$('aFecha').value});
  if(fallo(error)){$('aMsg').textContent='No se pudo guardar.';return}
  $('aImp').value='';$('aCon').value='';$('aFac').value='';$('aMsg').textContent='Guardado.';setTimeout(()=>$('aMsg').textContent='',2000);
  mes=$('aFecha').value.slice(0,7); cargar();
});
const mover=n=>{const [y,m]=mes.split('-').map(Number);const d=new Date(y,m-1+n,1);mes=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;cargar()};
$('fPrev').addEventListener('click',()=>mover(-1));
$('fNext').addEventListener('click',()=>mover(1));
$('aFecha').value=hoy(); pintarCats();
return {cargar,dinero};
})();
