import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const content = document.querySelector('#content');
const nav = document.querySelector('#nav');
const buttons = [...nav.querySelectorAll('button')];
let client, session, shifts = [], tab = 'calendar', busy = false;
const fmtDate = d => new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
const fmtTime = s => s ? new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(s)) : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const errText = e => esc(e?.message || String(e));
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

function notice(message, type='') { const el=document.createElement('p'); el.className=`notice ${type}`; el.textContent=message; content.prepend(el); }
function showLogin() {
  nav.hidden=true;
  content.innerHTML=`<section class="card"><h1>Вхід для працівника</h1><p class="muted">Увійдіть, щоб побачити свої зміни.</p><form id="login"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="btn-primary" type="submit">Увійти</button></form></section>`;
  content.querySelector('#login').addEventListener('submit', async e=>{
    e.preventDefault(); const btn=e.target.querySelector('button'); btn.disabled=true;
    try { const f=new FormData(e.target); const {error}=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')}); if(error) throw error; }
    catch(error){notice(`Помилка входу: ${error.message}`,'error');}
    finally{btn.disabled=false;}
  });
}
async function refreshShifts(){
  const {data,error}=await client.rpc('my_shifts');
  if(error) throw error;
  shifts=Array.isArray(data)?data:[];
}
function dateOfShift(s){return String(s.shift_date||'').slice(0,10);}
function status(s){return s.actual_end?'completed':s.actual_start?'active':'scheduled';}
function shiftRows(items){return items.map(s=>`<div class="shift-info"><div><strong>${esc(dateOfShift(s))}</strong><div class="muted">${s.actual_start ? `Початок ${fmtTime(s.actual_start)}` : 'Ще не розпочата'} · ${s.actual_end ? `Кінець ${fmtTime(s.actual_end)}` : 'Не завершена'}</div></div><span class="badge ${status(s)}">${({completed:'Завершена',active:'Триває',scheduled:'Запланована'})[status(s)]}</span></div>`).join('');}
function calendar(){
  const now=new Date(), year=now.getFullYear(), month=now.getMonth(), first=new Date(year,month,1), days=new Date(year,month+1,0).getDate();
  const offset=(first.getDay()+6)%7;
  const byDay=new Map(); for(const s of shifts){const key=dateOfShift(s); const a=byDay.get(key)||[]; a.push(s); byDay.set(key,a);}
  let grid='<div class="calendar">'+['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d=>`<span class="weekday">${d}</span>`).join('');
  grid+='<span></span>'.repeat(offset);
  for(let d=1;d<=days;d++) {const key=dayKey(new Date(year,month,d)), arr=byDay.get(key)||[]; const cls=arr.some(s=>status(s)==='active')?'active':arr.length&&arr.every(s=>status(s)==='completed')?'completed':arr.length?'scheduled':''; grid+=`<div class="calendar-day ${cls} ${key===dayKey(now)?'today':''}" title="${arr.length} змін">${d}${arr.length?'<span class="dot">●</span>':''}</div>`;}
  grid+='</div>';
  content.innerHTML=`<h1>Мій календар</h1><section class="card"><h2>${new Intl.DateTimeFormat('uk-UA',{month:'long',year:'numeric'}).format(now)}</h2>${grid}<p class="muted legend">🟡 Запланована · 🟢 Завершена · ◉ Сьогодні</p></section><section class="card"><h2>Мої зміни</h2>${shifts.length?shiftRows([...shifts].sort((a,b)=>dateOfShift(a).localeCompare(dateOfShift(b)))):'<p class="muted">Змін поки немає. Якщо очікуєте зміну, зверніться до адміністратора.</p>'}</section>`;
}
async function changeShift(s, action){
  if(busy)return; busy=true; content.querySelectorAll('button[data-action]').forEach(b=>b.disabled=true);
  try {const {error}=await client.rpc(action==='start'?'start_my_shift':'end_my_shift',{p_shift_id:s.id});if(error)throw error;await refreshShifts();render();notice(action==='start'?'Зміну відкрито':'Зміну завершено','success');}
  catch(error){render();notice(`Не вдалося змінити статус: ${error.message}`,'error');}
  finally{busy=false;}
}
function shiftPage(){
  const active=shifts.find(s=>status(s)==='active');
  const today=dayKey(new Date()); const planned=shifts.find(s=>dateOfShift(s)===today&&status(s)==='scheduled');
  const current=active||planned;
  content.innerHTML=`<h1>Моя зміна</h1><section class="card">${current?`<h2>${active?'Зміна триває':'Запланована зміна'}</h2><p>${esc(dateOfShift(current))}</p><p class="muted">Фактичний початок: ${fmtTime(current.actual_start)}</p><button class="${active?'btn-end':'btn-start'}" data-action="${active?'end':'start'}">${active?'Завершити зміну':'Розпочати зміну'}</button>`:'<h2>Немає активної зміни</h2><p class="muted">На сьогодні немає незавершеної або запланованої зміни.</p>'}</section><section class="card"><h2>Історія</h2>${shiftRows(shifts.filter(s=>s.actual_start||s.actual_end).slice(-10).reverse())||'<p class="muted">Поки немає відпрацьованих змін.</p>'}</section>`;
  const btn=content.querySelector('[data-action]');if(btn)btn.addEventListener('click',()=>changeShift(current,btn.dataset.action));
}
function salary(){
  // Не виводимо вигадану зарплату: для цього потрібен захищений RPC.
  content.innerHTML=`<h1>Моя зарплата</h1><section class="card"><h2>Нарахування</h2><p class="muted">Персональні нарахування ще не підключені. Для цього потрібна окрема захищена функція Supabase, яка повертає лише дані поточного працівника.</p></section><section class="card"><h2>Завершені зміни</h2>${shiftRows(shifts.filter(s=>s.actual_end))||'<p class="muted">Завершених змін поки немає.</p>'}</section>`;
}
function profile(){
  content.innerHTML=`<h1>Профіль</h1><section class="card"><h2>Обліковий запис</h2><p><strong>Email:</strong> ${esc(session?.user?.email||'—')}</p><p class="muted">Графік доступний лише після входу.</p><button id="logout" class="btn-secondary">Вийти</button></section>`;
  content.querySelector('#logout').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)notice(error.message,'error');});
}
function render(){
  if(!session){showLogin();return;}
  nav.hidden=false;buttons.forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  ({calendar,shift:shiftPage,salary,profile})[tab]();
}
async function onSession(next){
  session=next; if(!session){shifts=[];render();return;}
  content.innerHTML='<p class="muted">Завантажуємо ваші зміни…</p>';
  try{await refreshShifts();render();}catch(error){shifts=[];render();notice(`Помилка завантаження змін: ${error.message}`,'error');}
}
async function init(){
  buttons.forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render();}));
  if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){content.innerHTML='<section class="card"><h2>Потрібне налаштування</h2><p>Заповніть <code>staff/config.js</code> адресою Supabase та publishable key.</p></section>';return;}
  try{
    client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
    const {data,error}=await client.auth.getSession();if(error)throw error;
    await onSession(data.session);
    client.auth.onAuthStateChange((event,newSession)=>{if(event==='SIGNED_IN'&&session?.access_token===newSession?.access_token)return;setTimeout(()=>onSession(newSession),0);});
  }catch(error){content.innerHTML=`<section class="card"><h2>Помилка підключення</h2><p>${errText(error)}</p></section>`;}
}
init();
