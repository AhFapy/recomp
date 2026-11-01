/* Jabner · base compartida: llave del enlace privado, Supabase, perfil y tema.
   Nada personal aquí: los perfiles llegan de recomp_ajustes(), detrás de la llave.
   La llave y el perfil usan las claves de Recomp para no tener que volver a abrir el enlace. */
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

const LOGO='<svg viewBox="0 0 24 24" fill="none" stroke="#c5ff5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const SOL='M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
const LUNA='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
const esOscuro=()=>{const t=document.documentElement.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches};
{const t=guardado('recomp.tema',null,v=>v==='dark'||v==='light'); if(t) document.documentElement.setAttribute('data-theme',t)}

/* Pinta la cabecera común y arranca. titulo: nombre del módulo (null en el inicio). */
async function jabner(titulo,alCambiar){
  if(!llave){$('login').hidden=false;return}
  if(!(await cargarPerfiles())){$('login').hidden=false;$('login').querySelector('p').textContent='El enlace guardado no vale. Ábrela de nuevo desde el enlace privado.';return}
  const h=$('cabecera');
  h.className='top';
  h.innerHTML=`<div class="marca">
      <a class="logo" href="/" aria-label="Inicio de Jabner">${LOGO}</a>
      <div class="hola">${titulo?'<a class="volver" href="/">‹ Jabner</a>':'<small>Jabner</small>'}<strong>${titulo||'Hola, '+esc(PERFILES[perfil].n)}</strong></div>
    </div>
    <div class="ctrl">
      <div class="seg" role="group" aria-label="Perfil">
        ${Object.entries(PERFILES).map(([k,p])=>`<button type="button" data-p="${k}" aria-pressed="${k===perfil}">${esc(p.n)}</button>`).join('')}
      </div>
      <button class="icon-btn" id="tema" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path id="temaIco"/></svg></button>
    </div>`;
  const pintarTema=()=>{const o=esOscuro();$('temaIco').setAttribute('d',o?SOL:LUNA);$('tema').setAttribute('aria-label',o?'Cambiar a modo claro':'Cambiar a modo oscuro');document.querySelector('meta[name="theme-color"]')?.setAttribute('content',o?'#0c1f15':'#f5f4ef')};
  pintarTema();
  $('tema').addEventListener('click',()=>{const n=esOscuro()?'light':'dark';document.documentElement.setAttribute('data-theme',n);recordar('recomp.tema',n);pintarTema()});
  h.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.p===perfil) return; perfil=b.dataset.p; uid=PERFILES[perfil].id; recordar('recomp.perfil',perfil);
    h.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.p===perfil));
    if(!titulo) h.querySelector('.hola strong').textContent='Hola, '+PERFILES[perfil].n;
    alCambiar(true);
  }));
  $('app').hidden=false; $('app').classList.add('fade'); alCambiar(true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)alCambiar(false)});
}
const fallo=e=>{if(e){$('offline').hidden=false;console.error(e);return true}$('offline').hidden=true;return false};
if('serviceWorker' in navigator) addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
