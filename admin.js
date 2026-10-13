const $ = s => document.querySelector(s);
const API_BASE = (window.APP_CONFIG?.API_BASE || '').replace(/\/$/, '');
let token = localStorage.getItem('store_token') || '';
let user = JSON.parse(localStorage.getItem('store_user') || 'null');
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(Number(n||0));
async function api(url, options={}) {
 const headers={'Content-Type':'application/json',...(options.headers||{})};
 if(token) headers.Authorization='Bearer '+token;
 const r=await fetch(API_BASE+url,{...options,headers});
 const d=await r.json().catch(()=>({}));
 if(!r.ok) throw new Error(d.error||'تعذر تنفيذ العملية');
 return d;
}
function msg(el,text,bad=false){el.textContent=text;el.className=bad?'admin-error':'admin-success';}
function showDashboard(){ $('#loginBox').classList.add('admin-hidden');$('#dashboard').classList.remove('admin-hidden');refreshAll();}
function showLogin(){ $('#dashboard').classList.add('admin-hidden');$('#loginBox').classList.remove('admin-hidden');}
$('#loginForm').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.target);
 try{
  const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({phone:f.get('phone'),password:f.get('password')})});
  token=d.token;user=d.user;localStorage.setItem('store_token',token);localStorage.setItem('store_user',JSON.stringify(user));
  if(user.role!=='admin'){token='';localStorage.removeItem('store_token');msg($('#loginMsg'),'هذا الحساب ليس لديه صلاحية صاحب المتجر.',true);return;}
  showDashboard();
 }catch(err){msg($('#loginMsg'),err.message,true);}
};
$('#logoutBtn').onclick=()=>{token='';user=null;localStorage.removeItem('store_token');localStorage.removeItem('store_user');showLogin();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
 document.querySelectorAll('.admin-section').forEach(x=>x.classList.toggle('admin-hidden',x.id!==b.dataset.tab));
});
async function refreshAll(){await Promise.allSettled([loadProducts(),loadOrders(),loadOffers(),loadMessages(),loadPayments()]);}
async function loadProducts(){
 try{const data=await api('/api/products');
 $('#statProducts').textContent=data.length;
 $('#productsTable').innerHTML='<table><thead><tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+
 data.map(p=>`<tr><td><b>${esc(p.title)}</b><br><small>${esc(p.brand)} · ${esc(p.model)}</small></td><td>${money(p.price)}</td><td>${p.quantity}</td><td>${p.condition==='new'?'جديد':'مستعمل'}</td><td><button class="small-btn" data-stock="${p.id}" data-qty="${p.quantity}">تعديل الكمية</button><button class="small-btn" data-hide="${p.id}">إخفاء</button></td></tr>`).join('')+'</tbody></table>';
 document.querySelectorAll('[data-stock]').forEach(b=>b.onclick=async()=>{const qty=prompt('أدخل الكمية الجديدة',b.dataset.qty);if(qty===null)return;try{await api('/api/admin/products/'+b.dataset.stock,{method:'PATCH',body:JSON.stringify({quantity:Number(qty)})});loadProducts();}catch(e){alert(e.message)}});
 document.querySelectorAll('[data-hide]').forEach(b=>b.onclick=async()=>{if(!confirm('إخفاء هذا المنتج من واجهة العملاء؟'))return;try{await api('/api/admin/products/'+b.dataset.hide,{method:'PATCH',body:JSON.stringify({active:false})});loadProducts();}catch(e){alert(e.message)}});
 }catch(e){$('#productsTable').textContent=e.message;}
}
$('#productForm').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.target),p=Object.fromEntries(f.entries());p.price=Number(p.price);p.quantity=Number(p.quantity||0);
 try{await api('/api/admin/products',{method:'POST',body:JSON.stringify(p)});msg($('#productMsg'),'تمت إضافة المنتج بنجاح');e.target.reset();$('#productForm [name=quantity]').value=1;loadProducts();}
 catch(err){msg($('#productMsg'),err.message,true);}
};
const statuses={pending:'بانتظار التأكيد',confirmed:'تم التأكيد',shipped:'تم الشحن',delivered:'تم التسليم',cancelled:'ملغي',awaiting_transfer:'بانتظار التحويل'};
async function loadOrders(){
 try{const data=await api('/api/admin/orders');$('#statOrders').textContent=data.length;
 $('#ordersTable').innerHTML=data.length?'<table><thead><tr><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th><th>تحديث</th></tr></thead><tbody>'+
 data.map(o=>`<tr><td>#${o.id}<br><small>${new Date(o.created_at).toLocaleString('ar')}</small></td><td>${esc(o.customer_name)}<br>${esc(o.phone)}<br><small>${esc(o.address)}</small></td><td>${money(o.total)}</td><td>${o.payment_method==='cash_on_delivery'?'عند الاستلام':'تحويل إلكتروني'}</td><td>${esc(statuses[o.status]||o.status)}</td><td><select data-order="${o.id}"><option value="">تغيير الحالة</option>${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${k===o.status?'selected':''}>${v}</option>`).join('')}</select></td></tr>`).join('')+'</tbody></table>':'لا توجد طلبات.';
 document.querySelectorAll('[data-order]').forEach(s=>s.onchange=async()=>{if(!s.value)return;try{await api('/api/admin/orders/'+s.dataset.order,{method:'PATCH',body:JSON.stringify({status:s.value})});loadOrders();}catch(e){alert(e.message)}});
 }catch(e){$('#ordersTable').textContent=e.message;}
}
async function loadOffers(){
 try{const data=await api('/api/admin/sell-offers');$('#statOffers').textContent=data.length;
 $('#offersTable').innerHTML=data.length?'<table><thead><tr><th>العميل</th><th>الجهاز</th><th>الحالة والوصف</th><th>السعر المطلوب</th><th>التواصل</th><th>مراجعة العرض</th></tr></thead><tbody>'+
 data.map(o=>`<tr><td>${esc(o.customer_name)}</td><td>${esc(o.brand)} ${esc(o.model)}</td><td>${esc(o.condition_details)}<br><span class="status">${esc(o.status)}</span></td><td>${money(o.requested_price)}</td><td>${esc(o.contact_phone)}</td><td><select data-offer="${o.id}"><option value="">اختيار</option><option value="reviewing">قيد المراجعة</option><option value="accepted">قبول</option><option value="rejected">رفض</option></select><input data-note="${o.id}" placeholder="ملاحظة للعرض"></td></tr>`).join('')+'</tbody></table>':'لا توجد عروض حالياً.';
 document.querySelectorAll('[data-offer]').forEach(s=>s.onchange=async()=>{if(!s.value)return;const note=document.querySelector(`[data-note="${s.dataset.offer}"]`).value;try{await api('/api/admin/sell-offers/'+s.dataset.offer,{method:'PATCH',body:JSON.stringify({status:s.value,admin_note:note})});loadOffers();}catch(e){alert(e.message)}});
 }catch(e){$('#offersTable').textContent=e.message;}
}
async function loadMessages(){
 try{const data=await api('/api/messages');$('#statMessages').textContent=data.length;
 $('#messagesTable').innerHTML=data.length?'<table><thead><tr><th>المرسل</th><th>الرسالة</th><th>الوقت</th></tr></thead><tbody>'+data.map(m=>`<tr><td>${esc(m.name)}<br><small>${m.sender_role==='admin'?'صاحب المتجر':'عميل'} · #${m.user_id}</small></td><td>${esc(m.body)}</td><td>${new Date(m.created_at).toLocaleString('ar')}</td></tr>`).join('')+'</tbody></table>':'لا توجد رسائل.';
 }catch(e){$('#messagesTable').textContent=e.message;}
}
async function loadPayments(){
 try{const data=await api('/api/admin/payment-settings');
 $('#paymentsList').innerHTML=data.map(p=>`<form class="admin-section pay-form" data-pay="${p.id}"><label>اسم الطريقة</label><input value="${esc(p.method_name)}" disabled><label>تعليمات التحويل / بيانات الحساب الرسمية</label><textarea name="instructions" required>${esc(p.instructions)}</textarea><label><input type="checkbox" name="active" ${p.active?'checked':''} style="width:auto"> تفعيل عرض هذه الطريقة للعملاء</label><button>حفظ الإعدادات</button><p class="pay-msg"></p></form>`).join('');
 document.querySelectorAll('.pay-form').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const fd=new FormData(f);try{await api('/api/admin/payment-settings/'+f.dataset.pay,{method:'PATCH',body:JSON.stringify({instructions:fd.get('instructions'),active:fd.get('active')==='on'})});msg(f.querySelector('.pay-msg'),'تم حفظ الإعدادات');}catch(err){msg(f.querySelector('.pay-msg'),err.message,true);}});
 }catch(e){$('#paymentsList').textContent=e.message;}
}
if(token&&user?.role==='admin')showDashboard();else showLogin();
