/* Jabner · base compartida: llave del enlace privado, Supabase, perfil y tema.
   La llave y el perfil se guardan con las claves de Recomp para no tener que
   volver a abrir el enlace en los móviles donde ya funcionaba. */
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const hoy=()=>iso(new Date());
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n};
const PERFILES={ahmed:{id:'bd37f81a-6f8d-4009-8128-0873c15067c6',n:'Ahmed'},javi:{id:'edb503a9-65ce-49f8-9fcc-26ae76e1b359',n:'Javi'}};
const guardado=(k,def,ok)=>{try{const v=localStorage.getItem(k);return v!==null&&ok(v)?v:def}catch(e){return def}};
const recordar=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
let llave=null;
try{const m=location.hash.match(/k=([A-Za-z0-9_-]{20,})/);if(m){localStorage.setItem('recomp.llave',m[1]);history.replaceState(null,'',location.pathname)}llave=localStorage.getItem('recomp.llave')}catch(e){}
const SB=supabase.createClient('https://wuilmkfwxcexsepdcpdn.supabase.co','sb_publishable_jMo4h3jLwZ1eOIpEr2S8Ng_6wscg82f',
  {auth:{persistSession:false,autoRefreshToken:false},global:{headers:{'x-recomp-key':llave||''}}});
let perfil=guardado('recomp.perfil','ahmed',v=>!!PERFILES[v]);
let uid=PERFILES[perfil].id;

const LOGO='<svg viewBox="0 0 24 24" fill="none" stroke="#c5ff5b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const SOL='M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
const LUNA='M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
const esOscuro=()=>{const t=document.documentElement.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches};
{const t=guardado('recomp.tema',null,v=>v==='dark'||v==='light'); if(t) document.documentElement.setAttribute('data-theme',t)}

/* Pinta la cabecera común y arranca. titulo: nombre del módulo (null en el inicio). */
function jabner(titulo,alCambiar){
  const h=$('cabecera');
  h.className='top';
  h.innerHTML=`<div class="marca">
      <a class="logo" href="/" aria-label="Inicio de Jabner">${LOGO}</a>
      <div class="hola">${titulo?'<a class="volver" href="/">‹ Jabner</a>':'<small>Jabner</small>'}<strong>${titulo||'Hola, '+PERFILES[perfil].n}</strong></div>
    </div>
    <div class="ctrl">
      <div class="seg" role="group" aria-label="Perfil">
        ${Object.entries(PERFILES).map(([k,p])=>`<button type="button" data-p="${k}" aria-pressed="${k===perfil}">${p.n}</button>`).join('')}
      </div>
      <button class="icon-btn" id="tema" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path id="temaIco"/></svg></button>
    </div>`;
  const pintarTema=()=>{const o=esOscuro();$('temaIco').setAttribute('d',o?SOL:LUNA);$('tema').setAttribute('aria-label',o?'Cambiar a modo claro':'Cambiar a modo oscuro')};
  pintarTema();
  $('tema').addEventListener('click',()=>{const n=esOscuro()?'light':'dark';document.documentElement.setAttribute('data-theme',n);recordar('recomp.tema',n);pintarTema()});
  h.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.p===perfil) return; perfil=b.dataset.p; uid=PERFILES[perfil].id; recordar('recomp.perfil',perfil);
    h.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.p===perfil));
    if(!titulo) h.querySelector('.hola strong').textContent='Hola, '+PERFILES[perfil].n;
    alCambiar();
  }));
  if(!llave){$('login').hidden=false;return}
  $('app').hidden=false; $('app').classList.add('fade'); alCambiar();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)alCambiar()});
}
const fallo=e=>{if(e){$('offline').hidden=false;console.error(e);return true}$('offline').hidden=true;return false};
