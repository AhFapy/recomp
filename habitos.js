const AREAS=[['mente','Mente'],['cuerpo','Cuerpo'],['alma','Alma'],['objetivos','Objetivos']];
let mes=hoy().slice(0,7), habitos=[], log={};  // log[habito|fecha]=true/false
const k=(h,f)=>h+'|'+f;
const diasMes=m=>{const [y,mm]=m.split('-').map(Number);return new Date(y,mm,0).getDate()};

async function cargar(){
  const pedido=uid, desde=mes+'-01', hasta=mes+'-'+pad(diasMes(mes));
  const t=hoy(), ini=t<desde?t:desde, fin=t>hasta?t:hasta;
  const [h,l]=await Promise.all([
    SB.from('jabner_habitos').select('id,area,nombre,orden').eq('profile_id',pedido).eq('activo',true).order('orden').order('created_at'),
    SB.from('jabner_habitos_log').select('habito_id,fecha,hecho').eq('profile_id',pedido).gte('fecha',ini).lte('fecha',fin),
  ]);
  if(pedido!==uid||fallo(h.error||l.error)) return;
  habitos=h.data; log={}; for(const r of l.data) log[k(r.habito_id,r.fecha)]=r.hecho;
  render();
}
async function marcar(id,f,val){
  const prev=log[k(id,f)];
  if(val==null) delete log[k(id,f)]; else log[k(id,f)]=val;
  render();
  const q=val==null
    ? SB.from('jabner_habitos_log').delete().eq('habito_id',id).eq('fecha',f)
    : SB.from('jabner_habitos_log').upsert({habito_id:id,profile_id:uid,fecha:f,hecho:val});
  const {error}=await q;
  if(fallo(error)){ if(prev==null) delete log[k(id,f)]; else log[k(id,f)]=prev; render(); }
}
function render(){
  const t=hoy();
  // Hoy
  let html='', verdes=0;
  for(const [a,n] of AREAS){
    const hs=habitos.filter(h=>h.area===a); if(!hs.length) continue;
    html+=`<div class="hoy-area"><span class="label">${n}</span>`;
    for(const h of hs){
      const v=log[k(h.id,t)]; if(v===true) verdes++;
      html+=`<div class="hrow"><span>${esc(h.nombre)}</span><div class="vr">
        <button type="button" class="v" data-h="${h.id}" data-val="1" aria-pressed="${v===true}" aria-label="Hecho">✓</button>
        <button type="button" class="r" data-h="${h.id}" data-val="0" aria-pressed="${v===false}" aria-label="No hecho">✕</button></div></div>`;
    }
    html+='</div>';
  }
  $('hoy').innerHTML=html||'<p class="muted" style="margin:0">Aún no tienes hábitos. Añádelos abajo en "Editar hábitos".</p>';
  $('score').textContent=habitos.length?`${verdes}/${habitos.length}`:'—';
  $('hoy').querySelectorAll('[data-h]').forEach(b=>b.addEventListener('click',()=>{
    const want=b.dataset.val==='1', cur=log[k(b.dataset.h,t)];
    marcar(b.dataset.h,t,cur===want?null:want);
  }));
  // Cartulina
  const [y,mm]=mes.split('-').map(Number), N=diasMes(mes);
  $('mLabel').textContent=new Date(y,mm-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(' de ',' ').replace(/^./,c=>c.toUpperCase());
  $('mNext').disabled=mes>=t.slice(0,7);
  let c='<table><thead><tr><th></th>';
  for(let d=1;d<=N;d++){const f=`${mes}-${pad(d)}`;c+=`<th class="${f===t?'hoy':''}">${d}</th>`}
  c+='<th>%</th></tr></thead><tbody>';
  for(const [a,n] of AREAS){
    const hs=habitos.filter(h=>h.area===a); if(!hs.length) continue;
    c+=`<tr class="area"><td colspan="${N+2}">${n}</td></tr>`;
    for(const h of hs){
      c+=`<tr><td class="n" title="${esc(h.nombre)}">${esc(h.nombre)}</td>`;
      let si=0,tot=0;
      for(let d=1;d<=N;d++){
        const f=`${mes}-${pad(d)}`, v=log[k(h.id,f)];
        if(f<=t){tot++; if(v===true) si++;}
        c+=`<td><button type="button" data-c="${h.id}" data-f="${f}" class="${v===true?'v':v===false?'r':''}${f>t?' fut':''}" ${f>t?'disabled':''} aria-label="${esc(h.nombre)} ${d}"></button></td>`;
      }
      c+=`<td class="pct">${tot?Math.round(si/tot*100):0}</td></tr>`;
    }
  }
  c+='</tbody></table>';
  $('cart').innerHTML=habitos.length?c:'';
  $('cart').querySelectorAll('[data-c]').forEach(b=>b.addEventListener('click',()=>{
    const cur=log[k(b.dataset.c,b.dataset.f)];
    marcar(b.dataset.c,b.dataset.f,cur===undefined?true:cur===true?false:null);
  }));
  // Lista editable
  $('lista').innerHTML=AREAS.map(([a,n])=>{
    const hs=habitos.filter(h=>h.area===a);
    return `<div class="hoy-area" style="padding-bottom:8px"><span class="label">${n}</span>${hs.map(h=>`<div class="edit"><span>${esc(h.nombre)}</span><button type="button" data-del="${h.id}">Quitar</button></div>`).join('')||'<span class="tiny">—</span>'}</div>`;
  }).join('');
  $('lista').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
    const {error}=await SB.from('jabner_habitos').update({activo:false}).eq('id',b.dataset.del);
    if(!fallo(error)) cargar();
  }));
}
$('nueva').addEventListener('submit',async e=>{
  e.preventDefault(); const nombre=$('nNom').value.trim(); if(!nombre) return;
  const area=$('nArea').value, orden=habitos.filter(h=>h.area===area).length+1;
  const {error}=await SB.from('jabner_habitos').insert({profile_id:uid,area,nombre,orden});
  if(!fallo(error)){$('nNom').value='';cargar()}
});
const mover=n=>{const [y,m]=mes.split('-').map(Number);const d=new Date(y,m-1+n,1);mes=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;cargar()};
$('mPrev').addEventListener('click',()=>mover(-1));
$('mNext').addEventListener('click',()=>mover(1));
jabner('Hábitos',cargar);
setTimeout(()=>{const c=$('cart');const th=c.querySelector('th.hoy');if(th)c.scrollLeft=th.offsetLeft-c.clientWidth/2},800);
