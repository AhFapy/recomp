/* Recomp · gimnasio y nutrición. Una página: Hoy, Comida, Entreno y Cómo vas.
   Reglas del semáforo, la racha y las semanas en recomp-logica.js (RL). */
const PROT_DEF=170, KCAL_DEF=2000, EXTRAS_FIJOS=['Pádel','Yoga','Running'];
const DOWC=['L','M','X','J','V','S','D'];
const fmt=(n,dec=1)=>n==null||isNaN(n)?'—':Number(n).toLocaleString('es-ES',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const ent=n=>n==null||isNaN(n)?'—':Math.round(n).toLocaleString('es-ES');
const fechaCorta=s=>parse(s).toLocaleDateString('es-ES',{day:'numeric',month:'short'}).replace('.','');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const n2=v=>v==null?null:Number(v);
const capi=s=>{const t=String(s||'').toLowerCase();return t.charAt(0).toUpperCase()+t.slice(1)};
const reducido=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const VACIO={hechos:[],comidas:[],peso:null,whoop:null,animo:null,pasos:null,sueno:null,dieta:null,nota:null,descanso:false,extras:[],entreno:null};

let state={dias:{},meds:[],obj:null};
let plan=null, verSesion=null, calMes=hoy().slice(0,7), metrica='peso', firma='', primera=true, hoyPintado=hoy();
let rest=guardado('recomp.rest','casa',v=>!!MENUS[v]||v==='mano'), recien=null;

/* ---------- utilidades de pantalla ---------- */
function aviso(txt,mal){const t=$('toast');t.textContent=txt;t.className='toast'+(mal?' mal':'');t.hidden=false;clearTimeout(aviso.t);aviso.t=setTimeout(()=>t.hidden=true,mal?4500:2600)}
// Números que cuentan: el texto final se pone ya; la animación solo si el navegador la ejecuta.
function contar(el,valor,f=ent){
  const yo=(el._anim||0)+1; el._anim=yo;          // una animación nueva corta la anterior
  el.textContent=f(valor);
  if(!primera||reducido()||valor==null||!isFinite(valor)) return;
  const t0=performance.now(), dur=650; let fr=0;
  const paso=()=>{if(el._anim!==yo) return; fr++; const k=Math.min(1,Math.max(fr/45,(performance.now()-t0)/dur)), e=1-Math.pow(1-k,3); el.textContent=f(valor*e); if(k<1&&el._anim===yo) requestAnimationFrame(paso); else el.textContent=f(valor)};
  requestAnimationFrame(paso);
}
const dia=f=>({...VACIO,...(state.dias[f]||{})});
const metaProt=()=>state.obj?.prot_obj||PROT_DEF, metaKcal=()=>state.obj?.kcal_obj||KCAL_DEF;
const totales=d=>(d?.comidas||[]).reduce((a,x)=>({k:a.k+(+x.k||0),p:a.p+(+x.p||0)}),{k:0,p:0});

/* ---------- carga ---------- */
async function cargar(cambio){
  const pedido=uid; if(!pedido) return;
  if(cambio){state={dias:{},meds:[],obj:null};plan=null;verSesion=null;primera=true;firma='';limpiarForms()}
  const desde=RL.sumar(hoy(),-420);
  const [d,m,o]=await Promise.all([
    SB.from('recomp_dias').select('fecha,hechos,comidas,peso,whoop,animo,pasos,sueno,dieta,nota,descanso,extras,entreno').eq('profile_id',pedido).gte('fecha',desde),
    SB.from('recomp_mediciones').select('id,fecha,peso,grasa_pct,musculo_kg,visceral').eq('profile_id',pedido).order('fecha'),
    SB.from('recomp_objetivos').select('fecha_inicio,peso_inicial,peso_objetivo,fecha_objetivo,prot_obj,kcal_obj,plan_semana').eq('profile_id',pedido).maybeSingle(),
  ]);
  if(pedido!==uid) return;
  if(fallo(d.error||m.error||o.error)) return;
  const nueva=JSON.stringify([d.data,m.data,o.data]);
  if(PERFILES[perfil]?.plan&&!plan) cargarPlan(pedido);
  if(nueva===firma&&!cambio){if(hoy()!==hoyPintado)render();return}
  firma=nueva;
  const dias={}; for(const r of d.data) dias[r.fecha]={...VACIO,...r,peso:n2(r.peso),whoop:n2(r.whoop),animo:n2(r.animo),pasos:n2(r.pasos),sueno:n2(r.sueno),dieta:n2(r.dieta),extras:r.extras||[],hechos:r.hechos||[],comidas:r.comidas||[]};
  state.dias=dias;
  state.meds=m.data.map(r=>({...r,peso:n2(r.peso),grasa_pct:n2(r.grasa_pct),musculo_kg:n2(r.musculo_kg),visceral:n2(r.visceral)}));
  state.obj=o.data?{...o.data,peso_inicial:n2(o.data.peso_inicial),peso_objetivo:n2(o.data.peso_objetivo)}:null;
  render(); primera=false;
}
/* Plan del entrenador: copia local para ir sin red; se refresca desde el Sheet cada vez que se abre. */
async function cargarPlan(pedido){
  const k='recomp.plan.'+pedido;
  try{const c=JSON.parse(localStorage.getItem(k)||'null'); if(c?.semanas?.length&&pedido===uid){plan=c;render()}}catch(e){}
  const {data,error}=await SB.functions.invoke('recomp-plan',{body:{perfil:pedido},headers:{'x-recomp-key':llave||''}});
  if(pedido!==uid) return;
  if(error||!data?.semanas){ if(!plan) $('planInfo').textContent='No se pudo leer el plan del entrenador.'; return }
  plan=data; recordar(k,JSON.stringify(data)); render();
}

/* ---------- guardado: al momento, en cola por día; si falla, vuelve a lo guardado ---------- */
const colas={};
const escribir=(k,fn)=>{const p=(colas[k]||Promise.resolve()).catch(()=>{}).then(fn);colas[k]=p;return p};
async function guardarDia(f,cambios){
  const antes=state.dias[f]?{...state.dias[f]}:null;
  const coloreAntes=RL.colorDia(antes), rachaAntes=RL.racha(state.dias,hoy());
  const cur={...dia(f),...cambios,fecha:f};
  state.dias[f]=cur; render();
  celebrar(f,coloreAntes,rachaAntes);
  const quien=uid;
  const fila={profile_id:quien,fecha:f,hechos:cur.hechos,comidas:cur.comidas,peso:cur.peso,whoop:cur.whoop==null?null:Math.round(cur.whoop),animo:cur.animo,
    pasos:cur.pasos==null?null:Math.round(cur.pasos),sueno:cur.sueno,dieta:cur.dieta,nota:cur.nota||null,descanso:!!cur.descanso,extras:cur.extras,entreno:cur.entreno,updated_at:new Date().toISOString()};
  const {error}=await escribir(quien+f,()=>SB.from('recomp_dias').upsert(fila));
  if(quien!==uid) return;
  if(error){ if(antes) state.dias[f]=antes; else delete state.dias[f]; render(); aviso('No se pudo guardar. Lo he dejado como estaba.',true); console.error(error) }
}
function celebrar(f,colorAntes,rachaAntes){
  if(f!==hoy()) return;
  const c=RL.colorDia(state.dias[f]); if(!c||colorAntes) return;
  const n=RL.racha(state.dias,f), meta=RL.METAS.includes(n)||(n>=400&&n%100===0);
  if(meta&&n>rachaAntes){aviso(`Racha de ${n} días. Meta cumplida.`);$('rachaN').classList.remove('meta-ok');void $('rachaN').offsetWidth;$('rachaN').classList.add('meta-ok')}
  else if(c!=='r') aviso(c==='v'?'Día completado en verde.':'Día completado.');
}

/* ---------- render ---------- */
function render(){
  if(!uid) return; hoyPintado=hoy();
  renderHoy(); renderComida(); renderEntreno(); renderCal(); renderSemanas(); renderVas();
}
const COLTXT={v:'verde',a:'amarillo',r:'rojo'};
function renderHoy(){
  const t=hoy(), d=dia(t), c=RL.colorDia(d);
  $('fechaHoy').textContent=parse(t).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  $('semDia').className='sem '+(c||'');
  if(c) $('estadoDia').innerHTML=`Día <span class="serif">${COLTXT[c]}</span>`;
  else $('estadoDia').textContent=d.pasos==null&&d.dieta==null?'Sin apuntar':d.pasos==null?'Faltan los pasos':'Falta la comida';
  const ptos=[
    ['Pasos',RL.colorPasos(d.pasos),d.pasos==null?'—':ent(d.pasos)],
    ['Sueño',RL.colorNivel(d.sueno),['—','<6 h','6-7 h','8 h+'][d.sueno||0]],
    ['Comida',RL.colorNivel(d.dieta),['—','Mal','Regular','Perfecto'][d.dieta||0]],
    ['Entreno',RL.entrenado(d)||d.descanso?'v':(t===hoy()?null:'r'),d.descanso?'Descanso':RL.entrenado(d)?'Hecho':'—'],
  ];
  $('puntos').innerHTML=ptos.map(([n,col,v])=>`<div class="punto"><span class="sem ${col||''}"></span><b>${v}</b>${n}</div>`).join('');
  const r=RL.racha(state.dias,t), mejor=Math.max(r,RL.mejorRacha(state.dias,t)), sig=RL.siguienteMeta(r), ant=RL.metaAnterior(r);
  contar($('rachaN'),r); $('rachaU').textContent=r===1?'día':'días';
  $('rachaMejor').textContent=mejor?`Mejor: ${mejor}`:'';
  $('rachaBar').style.width=(clamp((r-ant)/(sig-ant),0,1)*100)+'%';
  $('rachaTxt').textContent=r?'Racha de días amarillos o verdes':'Empieza la racha hoy';
  $('rachaMeta').textContent=`Meta: ${sig}`;
  let tira=''; for(let i=6;i>=0;i--){const f=RL.sumar(t,-i), cc=RL.colorDia(state.dias[f]);
    tira+=`<div class="${i===0?'hoy':''}"><i class="${cc||''}" title="${fechaCorta(f)}"></i>${DOWC[(parse(f).getDay()+6)%7]}</div>`}
  $('tira').innerHTML=tira;
  // ánimo, nota, pasos, sueño, whoop
  $('animo').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(d.animo===i+1)));
  if(document.activeElement!==$('nota')) $('nota').value=d.nota||'';
  const p=d.pasos, cp=RL.colorPasos(p);
  $('pasosTxt').textContent=p==null?'Sin apuntar':`${ent(p)} pasos`;
  $('pasos').querySelectorAll('button').forEach((b,i)=>{const on=p!=null&&p>=(i+1)*1000;b.className=on?'on'+(cp==='r'?' ko':cp==='a'?' mid':''):'';b.setAttribute('aria-pressed',String(p===(i+1)*1000))});
  if(document.activeElement!==$('pasosIn')) $('pasosIn').value=p!=null&&p%1000!==0||p>10000?p:'';
  $('sueno').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(d.sueno===+b.dataset.v)));
  $('dieta').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(d.dieta===+b.dataset.v)));
  if(document.activeElement!==$('whoop')) $('whoop').value=d.whoop??'';
}

/* ---------- comida ---------- */
function renderComida(){
  const d=dia(hoy()), tp=metaProt(), tk=metaKcal(), tot=totales(d), C=326.7;
  contar($('vP'),tot.p); contar($('vK'),tot.k);
  $('mP').textContent=`de ${tp} g`; $('mK').textContent=`de ${ent(tk)} kcal`;
  $('rP').setAttribute('stroke-dasharray',`${(clamp(tot.p/tp,0,1)*C).toFixed(1)} ${C}`);
  $('rK').setAttribute('stroke-dasharray',`${(clamp(tot.k/tk,0,1)*C).toFixed(1)} ${C}`);
  $('rK').setAttribute('stroke',tot.k>tk*1.05?'var(--bad)':'var(--lime)');
  const quedan=tk-tot.k;
  $('quedan').textContent=!d.comidas.length?'':quedan>=0?`Te quedan ${ent(quedan)} kcal`:`Te has pasado ${ent(-quedan)} kcal`;
  const box=$('comidas'); box.textContent='';
  d.comidas.forEach((x,i)=>{
    const row=document.createElement('div'); row.className='plato';
    row.innerHTML=`<div class="t"></div><button class="x" type="button" aria-label="Quitar">✕</button>`;
    row.firstChild.textContent=x.n; const sm=document.createElement('small'); sm.textContent=`${x.r==='mano'?'A mano':MENUS[x.r]?.nombre||''} · ${ent(x.p)} g proteína · ${ent(x.k)} kcal`; row.firstChild.appendChild(sm);
    row.lastChild.addEventListener('click',()=>{const l=[...d.comidas];l.splice(i,1);guardarDia(hoy(),{comidas:l})}); box.appendChild(row);
  });
  if(!$('picker').hidden) renderLista();
}
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function renderLista(){
  document.querySelectorAll('.chips[aria-label="Carta"] button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.r===rest)));
  $('pickLista').hidden=rest==='mano'; $('pickMano').hidden=rest!=='mano';
  if(rest==='mano') return;
  const q=norm($('buscar').value.trim()), box=$('lista'); box.textContent='';
  let n=0;
  for(const [grupo,items] of MENUS[rest].g){
    const vis=items.filter(it=>!q||norm(it[0]).includes(q)); if(!vis.length) continue;
    const g=document.createElement('div'); g.className='grp'; g.textContent=grupo; box.appendChild(g);
    for(const it of vis){
      n++; const b=document.createElement('button'); b.type='button'; b.className='opt'+(recien===rest+it[0]?' added':'');
      b.innerHTML=`<span class="t"></span><span class="m"><b>${it[2]} g</b> · ${it[1]} kcal</span>`; b.firstChild.textContent=it[0];
      b.addEventListener('click',()=>anadirComida({r:rest,n:it[0],k:it[1],p:it[2],c:it[3],f:it[4]})); box.appendChild(b);
    }
  }
  if(!n) box.innerHTML='<p class="tiny" style="padding:12px">Nada con ese nombre en esta carta.</p>';
  $('fuente').textContent=MENUS[rest].fuente;
}
function anadirComida(x){
  recien=x.r+x.n; setTimeout(()=>{recien=null;if(!$('picker').hidden)renderLista()},900);
  guardarDia(hoy(),{comidas:[...dia(hoy()).comidas,x]});
}

/* ---------- entreno ---------- */
function semanaPlan(){
  if(!plan?.semanas?.length) return null;
  const elegida=state.obj?.plan_semana||guardado('recomp.semana.'+uid,'',()=>true);
  return plan.semanas.find(s=>s.hoja===elegida)||plan.semanas[0];
}
const objetivoSemanal=()=>semanaPlan()?.dias.length||3;
// Último valor apuntado de un ejercicio antes de una fecha.
function historial(nombre){
  const out=[]; for(const f of Object.keys(state.dias).sort()){const v=state.dias[f].entreno?.pesos?.[nombre]; if(v!=null&&v!=='') out.push({f,v:+v})}
  return out;
}
function renderEntreno(){
  const t=hoy(), d=dia(t), sp=semanaPlan(), objetivo=objetivoSemanal(), lun=RL.lunesDe(t);
  const st=RL.semana(state.dias,lun,objetivo);
  contar($('fzN'),st.hechas); $('fzObj').textContent='/'+objetivo;
  $('fzBars').innerHTML=Array.from({length:Math.max(objetivo,st.hechas)},(_,i)=>`<i class="${i<st.hechas?'on':''}"></i>`).join('');
  $('fzTxt').textContent=st.completa?(st.hechas>objetivo?`Semana completada · ${st.hechas-objetivo} extra`:'Semana completada'):'sesiones esta semana';
  $('semChip').textContent=st.completa?'Semana completada':`Faltan ${st.faltan}`;
  $('semChip').className='chip'+(st.completa?' lime':'');
  // selector de semana del plan
  const sel=$('planSemana');
  if(sp){
    sel.hidden=false;
    const opts=plan.semanas.map(s=>`<option value="${esc(s.hoja)}">${esc(capi(s.bloque||s.hoja))} · S${s.semana??''}</option>`).join('');
    if(sel.dataset.o!==opts){sel.innerHTML=opts;sel.dataset.o=opts}
    sel.value=sp.hoja;
    $('planInfo').textContent='Plan del entrenador';
  } else { sel.hidden=true; $('planInfo').textContent=PERFILES[perfil]?.plan?'Cargando el plan…':'Sin plan del entrenador'; }
  // sesiones
  const hoySes=d.entreno?.sesion??null;
  if(verSesion==null||!sp?.dias.some(x=>x.n===verSesion)) verSesion=hoySes??(sp?.dias.find(x=>!st.sesiones.includes(x.n))?.n??sp?.dias[0]?.n??null);
  $('sesBtns').innerHTML=sp?sp.dias.map(x=>{const hecha=st.sesiones.includes(x.n)&&hoySes!==x.n;
    return `<button type="button" data-s="${x.n}" aria-pressed="${verSesion===x.n}" class="${hecha?'hecha':''}">${esc(capi(x.nombre))}<small>${hoySes===x.n?'Hoy':hecha?'Hecha':x.dia?capi(x.dia):'Día '+x.n}</small></button>`}).join(''):'';
  $('sesBtns').querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{verSesion=+b.dataset.s;renderEntreno()}));
  const box=$('sesion');
  if(d.descanso){box.innerHTML='<p class="aviso">Hoy es día de descanso. Quítalo abajo si al final entrenas.</p>'}
  else if(sp){
    const x=sp.dias.find(z=>z.n===verSesion); const esHoy=hoySes===verSesion, hecha=esHoy&&RL.entrenado(d);
    let h=`<button class="cta ${hecha?'done':''}" type="button" id="sesHecha">${hecha?'✓ Sesión hecha hoy':'Marcar sesión de hoy'}</button>`;
    if(sp.objetivo&&!x) h+=`<p class="tiny">${esc(sp.objetivo)}</p>`;
    for(const e of x?.ejercicios||[]){
      const hist=historial(e.nombre), ult=[...hist].reverse().find(z=>z.f<t), val=esHoy?d.entreno?.pesos?.[e.nombre]:'';
      h+=`<div class="ej"><button type="button" class="t" data-f="${esc(e.nombre)}"><strong>${esc(capi(e.nombre))}</strong><small>${esc(e.pautas.join(' / '))}${e.descanso?' · descanso '+esc(e.descanso):''}</small>${ult?`<small class="ult">Última: ${fmt(ult.v,ult.v%1?1:0)} ${e.reps?'reps':'kg'} · ${fechaCorta(ult.f)}</small>`:''}</button>
        <input type="number" inputmode="decimal" step="0.5" min="0" max="999" data-e="${esc(e.nombre)}" value="${val??''}" placeholder="${e.reps?'reps':'kg'}" aria-label="${esc(capi(e.nombre))} (${e.reps?'repeticiones':'kg'})"></div>`;
    }
    if(sp.notas) h+=`<p class="tiny" style="margin-top:8px">${esc(sp.notas)}</p>`;
    box.innerHTML=h;
    $('sesHecha').addEventListener('click',()=>{
      const e=d.entreno&&d.entreno.sesion===verSesion?d.entreno:{semana:sp.hoja,sesion:verSesion,nombre:x?.nombre,pesos:{}};
      guardarDia(t,{entreno:e.hecho?(Object.keys(e.pesos||{}).length?{...e,hecho:false}:null):{...e,hecho:true}});
    });
    box.querySelectorAll('[data-f]').forEach(b=>b.addEventListener('click',()=>abrirFicha(b.dataset.f)));
    box.querySelectorAll('[data-e]').forEach(inp=>inp.addEventListener('change',()=>{
      const cur=dia(t).entreno; const base=cur&&cur.sesion===verSesion?cur:{semana:sp.hoja,sesion:verSesion,nombre:x?.nombre,pesos:{}};
      const pesos={...(base.pesos||{})}; const v=num(inp.value); if(v==null) delete pesos[inp.dataset.e]; else pesos[inp.dataset.e]=v;
      guardarDia(t,{entreno:{...base,pesos,hecho:base.hecho||Object.keys(pesos).length>0}});   // apuntar un peso ya marca la sesión
    }));
  } else {
    const hecha=!!d.entreno?.hecho||d.hechos.includes('fuerza');
    box.innerHTML=`<button class="cta ${hecha?'done':''}" type="button" id="sesHecha">${hecha?'✓ He entrenado hoy':'He entrenado hoy'}</button>`;
    $('sesHecha').addEventListener('click',()=>guardarDia(t,{entreno:hecha?null:{hecho:true,sesion:null},hechos:d.hechos.filter(h=>h!=='fuerza')}));
  }
  // extras
  const lista=[...new Set([...EXTRAS_FIJOS,...d.extras.map(x=>x.t)])];
  $('extras').innerHTML=lista.map(x=>`<button type="button" data-x="${esc(x)}" aria-pressed="${d.extras.some(z=>z.t===x)}">${esc(x)}</button>`).join('');
  $('extras').querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click',()=>{
    const on=d.extras.some(z=>z.t===b.dataset.x);
    guardarDia(t,{extras:on?d.extras.filter(z=>z.t!==b.dataset.x):[...d.extras,{t:b.dataset.x}]});
  }));
  // descanso: máximo 7 menos las sesiones de la semana; bloquea la sesión ese día
  const maxDesc=7-objetivo, sesionHoy=!!(d.entreno&&(d.entreno.hecho||Object.keys(d.entreno.pesos||{}).length));
  const db=$('descansoBtn');
  db.textContent=d.descanso?'Quitar el descanso de hoy':`Hoy descanso (${Math.max(0,maxDesc-st.descansos)} de ${maxDesc} esta semana)`;
  db.classList.toggle('done',d.descanso);
  db.disabled=!d.descanso&&(st.descansos>=maxDesc||sesionHoy);
  db.title=sesionHoy?'Hoy ya has entrenado':'';
}

/* ---------- calendario ---------- */
function renderCal(){
  const [y,m]=calMes.split('-').map(Number), t=hoy();
  $('calMes').textContent=new Date(y,m-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(' de ',' ').replace(/^./,c=>c.toUpperCase());
  $('calNext').disabled=calMes>=t.slice(0,7);
  const off=(new Date(y,m-1,1).getDay()+6)%7, N=new Date(y,m,0).getDate();
  let h=DOWC.map(x=>`<span class="dow">${x}</span>`).join('')+'<span></span>'.repeat(off);
  for(let i=1;i<=N;i++){
    const f=`${calMes}-${pad(i)}`, d=state.dias[f], c=RL.colorDia(d), fut=f>t;
    const cls=['d',fut?'fut':'',f===t?'hoy':'',RL.entrenado(d)?'fz':d?.descanso?'des':(c||'')].join(' ');
    h+=`<button type="button" class="${cls}" data-d="${f}" ${fut?'disabled':''} aria-label="${fechaCorta(f)}">${i}${c&&(RL.entrenado(d)||d?.descanso)?`<span class="m ${c}"></span>`:''}</button>`;
  }
  $('cal').innerHTML=h;
  $('cal').querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>abrirHoja(b.dataset.d)));
}
function abrirHoja(f){
  const d=dia(f), sp=semanaPlan();
  const tres=(k,labels)=>`<div class="tres" data-k="${k}">${labels.map((l,i)=>`<button type="button" class="${'rav'[i]}" data-v="${i+1}" aria-pressed="${d[k]===i+1}">${l}</button>`).join('')}</div>`;
  $('hojaIn').innerHTML=`<header><div><span class="label">Corregir día</span><h2>${capi(parse(f).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}))}</h2></div><button class="x" type="button" data-cerrar aria-label="Cerrar">✕</button></header>
    <label class="field">Pasos<input id="hPasos" type="number" inputmode="numeric" min="0" max="100000" value="${d.pasos??''}"></label>
    <div class="field">Sueño${tres('sueno',['<6 h','6-7 h','8 h+'])}</div>
    <div class="field">Comida${tres('dieta',['Mal','Más o menos','Perfecto'])}</div>
    <label class="field">Entreno<select id="hEnt"><option value="">No entrené</option>${sp?sp.dias.map(x=>`<option value="${x.n}">${esc(capi(x.nombre))}</option>`).join(''):''}<option value="libre">Entrené (sin sesión del plan)</option></select></label>
    <label class="field" style="flex-direction:row;align-items:center;gap:10px"><input id="hDesc" type="checkbox" ${d.descanso?'checked':''} style="width:22px;height:22px"> Día de descanso</label>
    <button class="cta" type="button" id="hGuardar">Guardar</button>`;
  const e=d.entreno; $('hEnt').value=e&&(e.hecho||Object.keys(e.pesos||{}).length)?(e.sesion!=null?String(e.sesion):'libre'):(d.hechos.includes('fuerza')?'libre':'');
  const val={sueno:d.sueno,dieta:d.dieta};
  $('hojaIn').querySelectorAll('.tres').forEach(g=>g.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    const k=g.dataset.k, v=+b.dataset.v; val[k]=val[k]===v?null:v; g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(val[k]===+x.dataset.v)));
  })));
  $('hojaIn').querySelector('[data-cerrar]').addEventListener('click',()=>$('hoja').close());
  $('hGuardar').addEventListener('click',()=>{
    const s=$('hEnt').value, desc=$('hDesc').checked;
    let entreno=d.entreno;
    if(desc||!s) entreno=e&&Object.keys(e.pesos||{}).length&&!desc?{...e,hecho:false}:null;
    else if(s==='libre') entreno={...(e||{}),hecho:true,sesion:null};
    else {const x=sp.dias.find(z=>z.n===+s); entreno=e&&e.sesion===+s?{...e,hecho:true}:{semana:sp.hoja,sesion:+s,nombre:x?.nombre,pesos:{},hecho:true}}
    guardarDia(f,{pasos:num($('hPasos').value),sueno:val.sueno,dieta:val.dieta,descanso:desc,entreno,hechos:d.hechos.filter(h=>h!=='fuerza')});
    $('hoja').close();
  });
  $('hoja').showModal();
}

/* ---------- semanas ---------- */
function renderSemanas(){
  const t=hoy(), lun=RL.lunesDe(t), objetivo=objetivoSemanal();
  const primeraF=Object.keys(state.dias).sort()[0]||t;
  let h='', cumplidas=0, pasadas=0;
  for(let i=0;i<8;i++){
    const l=RL.sumar(lun,-7*i); if(i>0&&RL.sumar(l,6)<primeraF) break;
    const st=RL.semana(state.dias,l,objetivo), actual=i===0;
    if(!actual){pasadas++; if(st.completa) cumplidas++}
    h+=`<div class="s"><span>${actual?'Esta semana':'Semana del '+fechaCorta(l)}</span><span><b>${st.hechas}/${objetivo}</b> · ${actual?(st.completa?'<span class="ok">Cumplida</span>':'En curso'):st.completa?'<span class="ok">Cumplida</span>':`<span class="ko">Faltó ${st.faltan}</span>`}</span></div>`;
  }
  $('semanas').innerHTML=h;
  $('cumplidas').textContent=pasadas?`${cumplidas} de ${pasadas} cumplidas`:'Primera semana';
}
function resumenSemana(){
  const t=hoy(), lun=RL.lunesDe(t), sp=semanaPlan(), objetivo=objetivoSemanal(), st=RL.semana(state.dias,lun,objetivo);
  const L=[`Semana del ${fechaCorta(lun)} al ${fechaCorta(RL.sumar(lun,6))}${sp?` · ${capi(sp.bloque)} S${sp.semana}`:''}`,`Sesiones: ${st.hechas}/${objetivo}${st.completa?' (completada)':''}`,''];
  let pasos=[], sue=[0,0,0], com=[0,0,0];
  for(let i=0;i<7;i++){
    const f=RL.sumar(lun,i); if(f>t) break; const d=state.dias[f]; if(!d) continue;
    if(d.pasos!=null) pasos.push(d.pasos); if(d.sueno) sue[d.sueno-1]++; if(d.dieta) com[d.dieta-1]++;
    const dn=capi(parse(f).toLocaleDateString('es-ES',{weekday:'short',day:'numeric'}));
    if(d.descanso){L.push(`${dn}: descanso`);continue}
    const e=d.entreno, partes=[];
    if(e&&(e.hecho||Object.keys(e.pesos||{}).length)){
      const ses=sp?.dias.find(x=>x.n===e.sesion);
      const pesos=Object.entries(e.pesos||{}).map(([k,v])=>{const ej=ses?.ejercicios.find(z=>z.nombre===k);return `${capi(k)} ${fmt(v,v%1?1:0)}${ej?.reps?' reps':' kg'}`});
      partes.push(`${capi(e.nombre||'Entreno')}${pesos.length?': '+pesos.join(', '):''}`);
    } else if(d.hechos.includes('fuerza')) partes.push('Entreno');
    if(d.extras.length) partes.push('Extra: '+d.extras.map(x=>x.t).join(', '));
    if(partes.length) L.push(`${dn}: ${partes.join(' · ')}`);
  }
  L.push('');
  if(pasos.length) L.push(`Pasos de media: ${ent(pasos.reduce((a,b)=>a+b,0)/pasos.length)}`);
  L.push(`Sueño: ${sue[2]} días 8 h+, ${sue[1]} de 6-7 h, ${sue[0]} de menos de 6 h`);
  L.push(`Comida: ${com[2]} perfecto, ${com[1]} más o menos, ${com[0]} mal`);
  return L.join('\n');
}

/* ---------- cómo vas ---------- */
const METRICAS={peso:['Peso','peso','kg',1],grasa:['Grasa','grasa_pct','%',1],musculo:['Músculo','musculo_kg','kg',1],visceral:['Visceral','visceral','',1]};
function renderVas(){
  const t=hoy(), o=state.obj, meds=state.meds, cv=RL.comoVas(meds,o,state.dias,t), ult=meds[meds.length-1];
  if(o) $('objResumen').textContent=`${fmt(o.peso_inicial)} → ${fmt(o.peso_objetivo)} kg para el ${fechaCorta(o.fecha_objetivo)}`;
  if(!cv){
    $('vasEstado').textContent='Sin datos'; $('vasChip').textContent='—';
    $('vasWhy').textContent=!ult?'Añade tu primer InBody abajo.':'Pon tu objetivo abajo para ver si vas en línea.';
    for(const id of ['sUlt','sFaltan','sRitmo']) $(id).textContent=id==='sUlt'&&ult?fmt(ult.peso)+' kg':'—';
  } else {
    const [a,b]=cv.estado==='En línea'?['En','línea']:[cv.estado,''];
    $('vasEstado').innerHTML=b?`${a} <span class="serif">${b}</span>`:`<span class="serif">${a}</span>`;
    $('vasChip').textContent=`${Math.round(cv.pctDias*100)} % días buenos`;
    $('vasWhy').innerHTML=`Último InBody: <b>${fmt(cv.ult.peso)} kg</b> el ${fechaCorta(cv.ult.fecha)}, ${cv.sobra>0?`<b>${fmt(cv.sobra)} kg</b> por encima`:`<b>${fmt(-cv.sobra)} kg</b> por delante`} de la línea. Días buenos la última semana: <b>${Math.round(cv.pctDias*100)} %</b>.`;
    $('sUlt').innerHTML=`${fmt(cv.ult.peso)}<span>kg</span>`;
    $('sFaltan').innerHTML=`${ent(cv.faltanDias)}<span>días</span>`;
    $('sRitmo').innerHTML=cv.ritmo==null?'—':`${fmt(Math.abs(cv.ritmo),2)}<span>kg/sem</span>`;
  }
  $('vasAviso').hidden=!(cv?.viejo||(ult&&RL.diasEntre(ult.fecha,t)>42));
  if(ult) $('vasAviso').textContent=`Tu último InBody es de hace ${RL.diasEntre(ult.fecha,t)} días. Hazte uno nuevo para que esto sea fiable.`;
  $('kpis4').innerHTML=Object.entries(METRICAS).map(([k,[n,c,u]])=>`<button type="button" data-m="${k}" aria-pressed="${metrica===k}"><small>${n}</small><b>${ult?.[c]!=null?fmt(ult[c])+(u?' '+u:''):'—'}</b></button>`).join('');
  $('kpis4').querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{metrica=b.dataset.m;renderVas()}));
  $('gCuerpo').innerHTML=grafCuerpo();
  $('meds').innerHTML=meds.length?`<table><thead><tr><th>Fecha</th><th>Peso</th><th>Grasa</th><th>Músculo</th><th>Visceral</th></tr></thead><tbody>${[...meds].reverse().map(x=>`<tr><td>${fechaCorta(x.fecha)}</td><td>${fmt(x.peso)}</td><td>${fmt(x.grasa_pct)}</td><td>${fmt(x.musculo_kg)}</td><td>${fmt(x.visceral)}</td></tr>`).join('')}</tbody></table>`:'';
}
function grafCuerpo(){
  const [nom,col,u]=METRICAS[metrica], o=state.obj, t=hoy();
  const pts=state.meds.filter(x=>x[col]!=null).map(x=>({f:x.fecha,v:x[col]}));
  if(!pts.length) return '<p class="tiny">Sin InBody todavía.</p>';
  const W=560,H=220,P={l:36,r:14,t:14,b:26};
  const meta=metrica==='peso'&&o?{f:o.fecha_objetivo,v:o.peso_objetivo}:null;
  const f0=pts[0].f, f1=meta&&meta.f>t?meta.f:(pts[pts.length-1].f>t?pts[pts.length-1].f:t);
  const vs=pts.map(p=>p.v).concat(meta?[meta.v]:[]); let lo=Math.min(...vs), hi=Math.max(...vs); const pad=Math.max(0.5,(hi-lo)*0.15); lo-=pad; hi+=pad;
  const tot=Math.max(1,RL.diasEntre(f0,f1));
  const X=f=>P.l+(W-P.l-P.r)*RL.diasEntre(f0,f)/tot, Y=v=>P.t+(H-P.t-P.b)*(1-(v-lo)/(hi-lo));
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${nom} en los InBody">`;
  for(let i=0;i<=3;i++){const v=lo+(hi-lo)*i/3;s+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v,metrica==='peso'?0:1)}</text>`}
  if(meta){const ul=pts[pts.length-1]; s+=`<line x1="${X(ul.f)}" y1="${Y(ul.v)}" x2="${X(meta.f)}" y2="${Y(meta.v)}" stroke="var(--brand)" stroke-width="2" stroke-dasharray="5 6" opacity=".8"/><circle cx="${X(meta.f)}" cy="${Y(meta.v)}" r="5" fill="none" stroke="var(--brand)" stroke-width="2"/><text x="${X(meta.f)-8}" y="${Y(meta.v)-10}" text-anchor="end" font-size="11" fill="var(--brand)">Meta ${fmt(meta.v)} kg</text>`}
  const d=pts.map((p,i)=>`${i?'L':'M'}${X(p.f).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
  s+=`<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" class="trazo"/>`;
  for(const p of pts) s+=`<circle cx="${X(p.f)}" cy="${Y(p.v)}" r="4.5" fill="var(--card)" stroke="var(--ink)" stroke-width="2"><title>${fechaCorta(p.f)}: ${fmt(p.v)} ${u}</title></circle>`;
  s+=`<text x="${P.l}" y="${H-6}" font-size="11" fill="var(--muted)">${fechaCorta(f0)}</text><text x="${W-P.r}" y="${H-6}" text-anchor="end" font-size="11" fill="var(--muted)">${fechaCorta(f1)}</text></svg>`;
  return s;
}

/* ---------- ficha de ejercicio ---------- */
function abrirFicha(nombre){
  const sp=semanaPlan(); let e=null; for(const x of sp?.dias||[]) e=e||x.ejercicios.find(z=>z.nombre===nombre);
  const hist=historial(nombre), u=e?.reps?'reps':'kg';
  const rec=hist.length?Math.max(...hist.map(h=>h.v)):null, prog=hist.length>1?hist[hist.length-1].v-hist[0].v:null;
  let graf='';
  if(hist.length>1){const W=480,H=120,lo=Math.min(...hist.map(h=>h.v)),hi=Math.max(...hist.map(h=>h.v)),r=Math.max(1,hi-lo);
    const pts=hist.map((h,i)=>`${(14+(W-28)*i/(hist.length-1)).toFixed(1)},${(10+(H-20)*(1-(h.v-lo)/r)).toFixed(1)}`).join(' ');
    graf=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progreso"><polyline points="${pts}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round"/></svg>`}
  $('fichaIn').innerHTML=`<header><div><span class="label">Ejercicio</span><h2>${esc(capi(nombre))}</h2></div><button class="x" type="button" data-cerrar aria-label="Cerrar">✕</button></header>
    ${e?`<p style="margin:0"><b>Pauta:</b> ${esc(e.pautas.join(' / '))}${e.descanso?' · descanso '+esc(e.descanso):''}</p>`:''}
    ${e?.notas?`<p class="aviso" style="margin:0">${esc(e.notas)}</p>`:''}
    <div class="stats"><div><small>Récord</small><strong>${rec==null?'—':fmt(rec,rec%1?1:0)+`<span>${u}</span>`}</strong></div><div><small>Progreso</small><strong>${prog==null?'—':(prog>=0?'+':'−')+fmt(Math.abs(prog),prog%1?1:0)+`<span>${u}</span>`}</strong></div><div><small>Sesiones</small><strong>${hist.length}</strong></div></div>
    ${graf}
    <div class="hist">${[...hist].reverse().map(h=>`<div><span>${fechaCorta(h.f)}</span><b>${fmt(h.v,h.v%1?1:0)} ${u}</b></div>`).join('')||'<p class="tiny">Aún no has apuntado este ejercicio.</p>'}</div>`;
  $('fichaIn').querySelector('[data-cerrar]').addEventListener('click',()=>$('ficha').close());
  $('ficha').showModal();
}

/* ---------- eventos ---------- */
const CARA=['M8 16.6q4-3.2 8 0','M8.5 16q3.5-1.6 7 0','M8.5 15.3h7','M8.5 14.4q3.5 2.2 7 0','M8 13.8q4 4.4 8 0'];
const ANIMOS=['Fatal','Mal','Normal','Bien','Genial'];
$('animo').innerHTML=ANIMOS.map((n,i)=>`<button type="button" data-a="${i+1}" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/><path d="${CARA[i]}"/></svg>${n}</button>`).join('');
$('animo').querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{const v=+b.dataset.a;guardarDia(hoy(),{animo:dia(hoy()).animo===v?null:v})}));
$('pasos').innerHTML=Array.from({length:10},(_,i)=>`<button type="button" data-p="${(i+1)*1000}" aria-label="${(i+1)*1000} pasos"></button>`).join('');
$('pasos').querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{const v=+b.dataset.p;guardarDia(hoy(),{pasos:dia(hoy()).pasos===v?null:v})}));
for(const k of ['sueno','dieta']) $(k).querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const v=+b.dataset.v;guardarDia(hoy(),{[k]:dia(hoy())[k]===v?null:v})}));
const deb={};
function alEscribir(id,fn){$(id).addEventListener('input',()=>{clearTimeout(deb[id]);deb[id]=setTimeout(fn,700)});$(id).addEventListener('change',()=>{clearTimeout(deb[id]);fn()})}
alEscribir('nota',()=>{const v=$('nota').value.trim()||null;if(v!==dia(hoy()).nota)guardarDia(hoy(),{nota:v})});
alEscribir('pasosIn',()=>{const v=$('pasosIn').value.trim();const n=v===''?null:Math.round(num(v));if(v!==''&&(n==null||n<0||n>100000))return;if(n!==dia(hoy()).pasos)guardarDia(hoy(),{pasos:n})});
alEscribir('whoop',()=>{const v=$('whoop').value.trim();const n=v===''?null:num(v);if(n!=null&&(n<0||n>100))return;if(n!==dia(hoy()).whoop)guardarDia(hoy(),{whoop:n})});
$('addBtn').addEventListener('click',()=>{
  const abrir=$('picker').hidden; $('picker').hidden=!abrir;
  $('addBtn').setAttribute('aria-expanded',String(abrir)); $('addBtn').innerHTML=abrir?'Cerrar':'<span aria-hidden="true">+</span> Añadir plato';
  if(abrir) renderLista();
});
document.querySelectorAll('.chips[aria-label="Carta"] button').forEach(b=>b.addEventListener('click',()=>{rest=b.dataset.r;recordar('recomp.rest',rest);$('buscar').value='';renderLista()}));
$('buscar').addEventListener('input',renderLista);
$('pickMano').addEventListener('submit',e=>{
  e.preventDefault();
  anadirComida({r:'mano',n:$('mNom').value.trim().slice(0,80)||'Comida',k:num($('mKc').value)||0,p:num($('mPr').value)||0,c:0,f:0});
  for(const id of ['mNom','mKc','mPr']) $(id).value='';
});
$('extraForm').addEventListener('submit',e=>{e.preventDefault();const v=$('extraIn').value.trim().slice(0,40);if(!v)return;const d=dia(hoy());if(!d.extras.some(x=>x.t===v))guardarDia(hoy(),{extras:[...d.extras,{t:v}]});$('extraIn').value=''});
$('descansoBtn').addEventListener('click',()=>{const d=dia(hoy());guardarDia(hoy(),{descanso:!d.descanso,entreno:d.descanso?d.entreno:(RL.entrenado(d)?d.entreno:null)})});
$('planSemana').addEventListener('change',async()=>{
  const v=$('planSemana').value; recordar('recomp.semana.'+uid,v); verSesion=null;
  if(state.obj){const antes=state.obj.plan_semana; state.obj.plan_semana=v; render();
    const {error}=await SB.from('recomp_objetivos').update({plan_semana:v}).eq('profile_id',uid);
    if(error){state.obj.plan_semana=antes;render();aviso('No se pudo guardar la semana del plan.',true)}}
  else render();
});
$('resumenBtn').addEventListener('click',async()=>{
  const txt=resumenSemana();
  try{await navigator.clipboard.writeText(txt);aviso('Resumen copiado. Pégalo en WhatsApp.')}
  catch(e){$('hojaIn').innerHTML=`<header><h2>Resumen de la semana</h2><button class="x" type="button" data-cerrar aria-label="Cerrar">✕</button></header><textarea class="nota" rows="12" readonly>${esc(txt)}</textarea>`;
    $('hojaIn').querySelector('[data-cerrar]').addEventListener('click',()=>$('hoja').close());$('hoja').showModal();$('hojaIn').querySelector('textarea').select()}
});
$('calPrev').addEventListener('click',()=>{const [y,m]=calMes.split('-').map(Number);const d=new Date(y,m-2,1);calMes=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;renderCal()});
$('calNext').addEventListener('click',()=>{const [y,m]=calMes.split('-').map(Number);const d=new Date(y,m,1);calMes=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;renderCal()});
$('objForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const o={peso_inicial:num($('o-pi').value),fecha_inicio:$('o-fi').value,peso_objetivo:num($('o-po').value),fecha_objetivo:$('o-fo').value,prot_obj:num($('o-pr').value),kcal_obj:num($('o-kc').value)};
  if(o.fecha_objetivo<=o.fecha_inicio){$('o-msg').textContent='La fecha objetivo tiene que ser posterior al inicio.';return}
  const antes=state.obj; state.obj={...(antes||{}),...o}; render();
  const {error}=await escribir('obj'+uid,()=>SB.from('recomp_objetivos').upsert({profile_id:uid,...o,updated_at:new Date().toISOString()}));
  if(error){state.obj=antes;render()}
  $('o-msg').textContent=error?'No se pudo guardar: revisa los números.':'Guardado';
});
$('medForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const x={profile_id:uid,fecha:$('m-fecha').value,peso:num($('m-peso').value),grasa_pct:num($('m-gpct').value),musculo_kg:num($('m-mus').value),visceral:num($('m-vis').value)};
  const {error}=await SB.from('recomp_mediciones').insert(x);
  if(error){$('m-msg').textContent='No se pudo guardar: revisa los números.';return}
  $('m-msg').textContent='InBody añadido'; for(const id of ['m-peso','m-gpct','m-mus','m-vis'])$(id).value='';
  cargar(false);
});
function limpiarForms(){
  for(const id of ['o-msg','m-msg']) $(id).textContent='';
  for(const id of ['o-pi','o-fi','o-po','o-fo','o-pr','o-kc','m-peso','m-gpct','m-mus','m-vis']) $(id).value='';
}
// El formulario del objetivo se rellena con lo guardado al abrirlo.
document.querySelector('details.card').addEventListener('toggle',ev=>{const o=state.obj;if(!ev.target.open||!o)return;
  $('o-pi').value=o.peso_inicial??'';$('o-fi').value=o.fecha_inicio||'';$('o-po').value=o.peso_objetivo??'';$('o-fo').value=o.fecha_objetivo||'';$('o-pr').value=o.prot_obj??'';$('o-kc').value=o.kcal_obj??''});
$('m-fecha').value=hoy();

/* ---------- refresco: cada 60 s si está a la vista y no estás escribiendo; "hoy" cambia solo a medianoche ---------- */
setInterval(()=>{
  if(!uid||document.hidden) return;
  const a=document.activeElement, escribiendo=a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if(hoy()!==hoyPintado&&!escribiendo){calMes=hoy().slice(0,7);verSesion=null;render()}
  if(!escribiendo&&!$('hoja').open&&!$('ficha').open) cargar(false);
},60000);

jabner('Recomp',c=>cargar(c));
