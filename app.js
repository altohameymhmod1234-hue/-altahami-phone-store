const $ = s => document.querySelector(s);\nconst API_BASE = (window.APP_CONFIG?.API_BASE || '').replace(/\\/$/, '');
let token = localStorage.getItem('store_token') || '';
let user = JSON.parse(localStorage.getItem('store_user') || 'null');
let cartProduct = null, authMode = 'login';
const money = n => new Intl.NumberFormat('ar', {maximumFractionDigits:2}).format(Number(n)) ;
async function api(url, options={}) {
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + url, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}
function toast(el, msg, bad=false){ el.textContent=msg; el.style.color=bad?'#b42318':'#14734b'; }
function view(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!==name));
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='home') loadProducts();
  if(name==='chat') loadMessages();
}
document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
async function loadProducts(){
  const box=$('#products'); box.innerHTML='<p>جاري تحميل المنتجات...</p>';
  try{
    const q=encodeURIComponent($('#search').value||'');
    const list=await api('/api/products?q='+q);
    box.innerHTML=list.length?'':'<p>لا توجد منتجات حالياً. أضف منتجات من خلال API الإدارة.</p>';
    list.forEach(p=>{
      const card=document.createElement('article'); card.className='product';
      const img=document.createElement('img'); img.src=p.image_url||'https://placehold.co/480x320?text=Phone'; img.alt=p.title;
      const h=document.createElement('h3'); h.textContent=p.title;
      const desc=document.createElement('div'); desc.className='muted'; desc.textContent=`${p.brand} · ${p.model} · ${p.condition==='new'?'جديد':'مستعمل'} · ${p.storage||'—'}`;
      const price=document.createElement('div'); price.className='price'; price.textContent=money(p.price);
      const qty=document.createElement('div'); qty.className='muted'; qty.textContent=`المتوفر: ${p.quantity}`;
      const row=document.createElement('div'); row.className='row';
      const buy=document.createElement('button'); buy.textContent='اطلب الآن'; buy.onclick=()=>{cartProduct=p; if(!token) return openAuth(); $('#checkoutDialog').showModal();};
      const ask=document.createElement('button'); ask.className='outline'; ask.textContent='استفسار'; ask.onclick=()=>{view('chat');$('#messages').dataset.product=p.title;};
      row.append(buy,ask); card.append(img,h,desc,price,qty,row); box.append(card);
    });
  }catch(e){box.innerHTML='<p>تعذر تحميل المنتجات. تأكد من تشغيل الخادم وقاعدة البيانات.</p>';}
}
$('#searchBtn').onclick=loadProducts; $('#search').addEventListener('keydown',e=>{if(e.key==='Enter')loadProducts()});
function openAuth(){ $('#authError').textContent=''; $('#authDialog').showModal(); }
$('#accountBtn').onclick=()=>user? (token='',user=null,localStorage.removeItem('store_token'),localStorage.removeItem('store_user'),$('#accountBtn').textContent='دخول / حساب جديد'):openAuth();
$('#closeAuth').onclick=()=>$('#authDialog').close();
$('#toggleAuth').onclick=()=>{authMode=authMode==='login'?'register':'login';$('#authTitle').textContent=authMode==='login'?'تسجيل الدخول':'إنشاء حساب جديد';$('#authName').classList.toggle('hidden',authMode==='login');$('#toggleAuth').textContent=authMode==='login'?'إنشاء حساب جديد':'لدي حساب بالفعل';};
$('#authName').classList.add('hidden');
$('#authForm').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.target),body={phone:f.get('phone'),password:f.get('password')};
 if(authMode==='register')body.name=f.get('name');
 try{const data=await api('/api/auth/'+authMode,{method:'POST',body:JSON.stringify(body)});token=data.token;user=data.user;localStorage.setItem('store_token',token);localStorage.setItem('store_user',JSON.stringify(user));$('#accountBtn').textContent='تسجيل الخروج';$('#authDialog').close();if(cartProduct)$('#checkoutDialog').showModal();else loadMessages();}
 catch(err){toast($('#authError'),err.message,true);}
};
$('#sellForm').onsubmit=async e=>{
 e.preventDefault();if(!token)return openAuth();
 const f=new FormData(e.target),body=Object.fromEntries(f.entries());body.requested_price=Number(body.requested_price);
 try{const d=await api('/api/sell-offers',{method:'POST',body:JSON.stringify(body)});toast($('#sellResult'),d.message);e.target.reset();}
 catch(err){toast($('#sellResult'),err.message,true);}
};
$('#checkoutForm').onsubmit=async e=>{
 e.preventDefault();if(!token)return openAuth();if(!cartProduct)return;
 const f=new FormData(e.target),body=Object.fromEntries(f.entries());body.items=[{product_id:cartProduct.id,quantity:1}];
 try{const d=await api('/api/orders',{method:'POST',body:JSON.stringify(body)});toast($('#checkoutResult'),`تم إنشاء الطلب رقم ${d.order.id}. الحالة: ${d.order.status}`);cartProduct=null;e.target.reset();setTimeout(()=>$('#checkoutDialog').close(),2200);}
 catch(err){toast($('#checkoutResult'),err.message,true);}
};
$('#closeCheckout').onclick=()=>$('#checkoutDialog').close();
$('#loadOrders').onclick=async()=>{if(!token)return openAuth();try{const list=await api('/api/orders/mine');$('#ordersResult').innerHTML=list.length?list.map(o=>`<div class="message"><b>طلب #${o.id}</b> — ${money(o.total)}<br><small>الحالة: ${o.status} · ${new Date(o.created_at).toLocaleString('ar')}</small></div>`).join(''):'لا توجد طلبات حتى الآن';}catch(e){$('#ordersResult').textContent=e.message;}};
async function loadMessages(){if(!token){$('#messages').innerHTML='<p>سجّل الدخول لإرسال رسالة لصاحب المتجر.</p>';return;}try{const list=await api('/api/messages');$('#messages').innerHTML=list.map(m=>`<div class="message"><b>${m.sender_role==='admin'?'صاحب المتجر':(m.name||'أنت')}</b><p></p><small>${new Date(m.created_at).toLocaleString('ar')}</small></div>`).join('');[...$('#messages').children].forEach((el,i)=>el.querySelector('p').textContent=list[i].body);}catch(e){$('#messages').textContent=e.message;}}
$('#chatForm').onsubmit=async e=>{e.preventDefault();if(!token)return openAuth();const f=new FormData(e.target);try{await api('/api/messages',{method:'POST',body:JSON.stringify({body:f.get('body')})});e.target.reset();loadMessages();}catch(err){$('#messages').textContent=err.message;}};
const wa=(window.STORE_WHATSAPP||'249000000000').replace(/\D/g,'');$('#whatsapp').href='https://wa.me/'+wa;$('#call').href='tel:'+(window.STORE_PHONE||'+249000000000');
if(user)$('#accountBtn').textContent='تسجيل الخروج';
loadProducts();
