/* Jabner · base compartida: Supabase, perfil y tema. Sin llave: la web abre directamente.
   Los perfiles llegan de recomp_ajustes(). */
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const hoy=()=>iso(new Date());
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n};
const guardado=(k,def,ok)=>{try{const v=localStorage.getItem(k);return v!==null&&ok(v)?v:def}catch(e){return def}};
const recordar=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const SUPABASE_URL='https://wuilmkfwxcexsepdcpdn.supabase.co';
let llave=null;
try{const m=location.hash.match(/k=([A-Za-z0-9_-]{20,})/);if(m){localStorage.setItem('recomp.llave',m[1]);history.replaceState(null,'',location.pathname)}llave=localStorage.getItem('recomp.llave')}catch(e){}
const SB=supabase.createClient(SUPABASE_URL,'sb_publishable_jMo4h3jLwZ1eOIpEr2S8Ng_6wscg82f',
  {auth:{persistSession:false,autoRefreshToken:false},global:{headers:{'x-recomp-key':llave||''}}});
let PERFILES={};               // {ahmed:{id,n,plan}, javi:{...}}
let perfil=guardado('recomp.perfil','ahmed',v=>/^[a-z]{2,20}$/.test(v));
let uid=null;

/* Perfiles: de la base (con copia local para arrancar sin red). */
async function cargarPerfiles(){
  const usar=lista=>{PERFILES={};for(const p of lista||[])PERFILES[p.clave]={id:p.id,n:p.nombre,plan:!!p.plan};
    if(!PERFILES[perfil])perfil=Object.keys(PERFILES)[0]; uid=PERFILES[perfil]?.id||null};
  try{usar(JSON.parse(localStorage.getItem('jabner.perfiles')||'[]'))}catch(e){}
  const {data,error}=await SB.rpc('recomp_ajustes');
  if(!error&&Array.isArray(data)){usar(data);recordar('jabner.perfiles',JSON.stringify(data));return true}
  return !!uid;
}

const SOL='M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
const LUNA='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
const esOscuro=()=>{const t=document.documentElement.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches};
{const t=guardado('recomp.tema',null,v=>v==='dark'||v==='light'); if(t) document.documentElement.setAttribute('data-theme',t)}

/* Pinta el selector de perfil y el tema, marca la sección visible y arranca. */
async function jabner(alCambiar){
  $('login').hidden=false;
  if(!(await cargarPerfiles())){$('login').querySelector('p').textContent='No se pudo conectar con la base de datos. Revisa la conexión y recarga.';return}
  $('login').hidden=true;
  const h=$('cabecera');
  const nombre=()=>{$('saludoN').textContent=PERFILES[perfil].n+'.';$('quienN').textContent=PERFILES[perfil].n};
  h.innerHTML=`<div class="seg" role="group" aria-label="Perfil">
      ${Object.entries(PERFILES).map(([k,p])=>`<button type="button" data-p="${k}" aria-pressed="${k===perfil}">${esc(p.n)}</button>`).join('')}
    </div>
    <button class="icon-btn" id="tema" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path id="temaIco"/></svg></button>`;
  const pintarTema=()=>{const o=esOscuro();$('temaIco').setAttribute('d',o?SOL:LUNA);$('tema').setAttribute('aria-label',o?'Cambiar a modo claro':'Cambiar a modo oscuro');document.querySelector('meta[name="theme-color"]')?.setAttribute('content',o?'#0c1f15':'#f5f4ef')};
  pintarTema(); nombre();
  $('tema').addEventListener('click',()=>{const n=esOscuro()?'light':'dark';document.documentElement.setAttribute('data-theme',n);recordar('recomp.tema',n);pintarTema()});
  h.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.p===perfil) return; perfil=b.dataset.p; uid=PERFILES[perfil].id; recordar('recomp.perfil',perfil);
    h.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.p===perfil));
    nombre(); alCambiar(true);
  }));
  $('app').hidden=false; alCambiar(true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)alCambiar(false)});
  // La sección que ocupa la zona alta de la pantalla queda marcada en la navegación.
  const marcar=id=>document.querySelectorAll('[data-sec]').forEach(a=>{if(a.dataset.sec===id)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')});
  marcar('hoy');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)marcar(e.target.id)}),{rootMargin:'-20% 0px -75% 0px'});
    document.querySelectorAll('.seccion').forEach(s=>io.observe(s));
  }
}
const fallo=e=>{if(e){$('offline').hidden=false;console.error(e);return true}$('offline').hidden=true;return false};
/* Versión nueva publicada: el service worker se actualiza al volver a la pestaña y la página se recarga sola una vez. */
if('serviceWorker' in navigator){
  addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').then(r=>{document.addEventListener('visibilitychange',()=>{if(!document.hidden)r.update().catch(()=>{})});setInterval(()=>r.update().catch(()=>{}),30*60*1000)}).catch(()=>{}));
  let recargada=false, habia=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(habia&&!recargada){recargada=true;location.reload()}});
}
