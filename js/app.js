/* =========================================================
   XYZ PHARMACY — App logic (member-facing PWA)
   Uses Firebase Anonymous Auth + a "profile" doc in Firestore
   (name + phone) so we know who's who without needing SMS OTP.
   ========================================================= */

let currentUser = null;   // firebase auth user
let profile = null;       // {name, phone, uid}
let cart = JSON.parse(localStorage.getItem('xyz_cart') || '[]');
let allProducts = [];
let unsubChat = null;

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>t.classList.remove('show'), 2200);
}

function money(n){
  return 'TSh ' + Number(n||0).toLocaleString('en-US');
}

function saveCart(){
  localStorage.setItem('xyz_cart', JSON.stringify(cart));
  renderCartBadge();
}

function renderCartBadge(){
  const count = cart.reduce((s,i)=>s+i.qty,0);
  const badge = $('#cart-badge');
  if(!badge) return;
  if(count > 0){ badge.textContent = count; badge.style.display='flex'; }
  else { badge.style.display='none'; }
}

/* ---------------- AUTH / REGISTRATION ---------------- */

// Hakikisha kikao (session) kinabaki hai kwenye kifaa hiki (siyo kwa kila
// kufungua tena), hata baada ya kufunga na kufungua tena browser.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err=>console.error('persistence error', err));

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    auth.signInAnonymously().catch(err=>{
      console.error(err);
      toast('Imeshindikana kuunganisha. Angalia mtandao wako.');
    });
    return;
  }
  currentUser = user;
  const doc = await db.collection('users').doc(user.uid).get();
  if(doc.exists){
    profile = doc.data();
    boot();
  } else {
    showRegister();
  }
});

function showRegister(){
  $('#auth-screen').hidden = false;
  $('#app-screen').hidden = true;
}

$('#register-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = $('#reg-name').value.trim();
  const phone = $('#reg-phone').value.trim();
  if(!name || phone.length < 9){ toast('Jaza jina na namba sahihi ya simu'); return; }
  const btn = $('#register-form button[type=submit]');
  btn.disabled = true; btn.textContent = 'Inasajili...';
  try{
    await db.collection('users').doc(currentUser.uid).set({
      name, phone,
      role: 'member',
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    profile = { name, phone, role:'member' };
    boot();
  }catch(err){
    console.error(err);
    toast('Imeshindikana kusajili, jaribu tena');
  }finally{
    btn.disabled = false; btn.textContent = 'Sajili na Uendelee';
  }
});

/* ---------------- BOOT APP ---------------- */

function boot(){
  $('#auth-screen').hidden = true;
  $('#app-screen').hidden = false;
  $('#profile-name').textContent = profile.name;
  $('#profile-phone').textContent = profile.phone;
  renderCartBadge();
  loadPosts();
  loadProducts();
  switchTab('home');
}

/* ---------------- TAB NAVIGATION ---------------- */

$$('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=> switchTab(btn.dataset.tab));
});

function switchTab(tab){
  $$('.view').forEach(v=> v.hidden = v.id !== `view-${tab}`);
  $$('.tab').forEach(b=> b.classList.toggle('active', b.dataset.tab === tab));
  if(tab === 'cart') renderCart();
  if(tab === 'chat') openChat(); else closeChat();
}

/* ---------------- POSTS (Elimu ya Afya) ---------------- */

let allPosts = [];

function loadPosts(){
  db.collection('posts').orderBy('createdAt','desc').limit(30)
    .onSnapshot(snap=>{
      allPosts = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      const wrap = $('#posts-list');
      if(allPosts.length === 0){
        wrap.innerHTML = emptyState('📰','Bado hakuna makala', 'Admin atakapoongeza elimu ya afya, itaonekana hapa.');
        return;
      }
      wrap.innerHTML = allPosts.map(p=>{
        const date = p.createdAt ? p.createdAt.toDate().toLocaleDateString('sw-TZ',{day:'numeric',month:'short',year:'numeric'}) : '';
        const isLong = (p.body||'').length > 140;
        return `
        <article class="card post-card">
          ${p.imageUrl ? `<img class="post-img" src="${esc(p.imageUrl)}" alt="">` : ''}
          <div class="post-body">
            <span class="post-tag">${esc(p.category||'Elimu ya Afya')}</span>
            <h3 class="post-title">${esc(p.title)}</h3>
            <p class="post-excerpt">${esc((p.body||'').slice(0,140))}${isLong?'…':''}</p>
            ${isLong ? `<button class="read-more-btn" data-post="${p.id}">Soma Zaidi →</button>` : ''}
            <div class="post-date">${date}</div>
          </div>
        </article>`;
      }).join('');
      $$('.read-more-btn').forEach(btn=>{
        btn.addEventListener('click', ()=> openPost(btn.dataset.post));
      });
    }, err=>console.error(err));
}

function openPost(id){
  const p = allPosts.find(x=>x.id===id);
  if(!p) return;
  const date = p.createdAt ? p.createdAt.toDate().toLocaleDateString('sw-TZ',{day:'numeric',month:'short',year:'numeric'}) : '';
  $('#post-modal-body').innerHTML = `
    ${p.imageUrl ? `<img class="post-modal-img" src="${esc(p.imageUrl)}" alt="">` : ''}
    <div class="post-modal-content">
      <span class="post-tag">${esc(p.category||'Elimu ya Afya')}</span>
      <h2 class="post-modal-title">${esc(p.title)}</h2>
      <div class="post-date">${date}</div>
      <p class="post-modal-text">${esc(p.body||'').replace(/\n/g,'<br>')}</p>
    </div>`;
  $('#post-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePost(){
  $('#post-modal').classList.remove('open');
  document.body.style.overflow = '';
}
$('#post-modal-close')?.addEventListener('click', closePost);
$('#post-modal')?.addEventListener('click', (e)=>{ if(e.target.id === 'post-modal') closePost(); });

function emptyState(emoji, title, sub){
  return `<div class="empty-state"><div class="emoji">${emoji}</div><h3>${title}</h3><p>${sub}</p></div>`;
}

function esc(s){
  return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------------- PRODUCTS (Duka) ---------------- */

function loadProducts(){
  db.collection('products').orderBy('createdAt','desc').limit(100)
    .onSnapshot(snap=>{
      allProducts = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      renderProductFilters();
      renderProducts();
    }, err=>console.error(err));
}

function renderProductFilters(){
  const cats = ['Zote', ...new Set(allProducts.map(p=>p.category).filter(Boolean))];
  $('#product-filters').innerHTML = cats.map((c,i)=>
    `<button class="chip ${i===0?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`
  ).join('');
  $$('#product-filters .chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      $$('#product-filters .chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      renderProducts();
    });
  });
}

function renderProducts(){
  const activeCat = $('#product-filters .chip.active')?.dataset.cat || 'Zote';
  const q = ($('#product-search').value || '').toLowerCase().trim();
  let list = allProducts.filter(p=>{
    const matchCat = activeCat === 'Zote' || p.category === activeCat;
    const matchQ = !q || (p.name||'').toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  const grid = $('#product-grid');
  if(list.length === 0){
    grid.innerHTML = '';
    $('#product-empty').hidden = false;
    return;
  }
  $('#product-empty').hidden = true;
  grid.innerHTML = list.map(p=>{
    const outOfStock = (p.stock ?? 1) <= 0;
    return `
    <div class="product-card">
      <img class="product-img" src="${esc(p.imageUrl || '')}" alt="${esc(p.name)}" onerror="this.style.opacity=0">
      <div class="product-info">
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-price">${money(p.price)}</div>
        <div class="product-stock">${outOfStock ? 'Haipo stock' : 'Ipo stock'}</div>
        <button class="add-btn" data-id="${p.id}" ${outOfStock?'disabled':''}>${outOfStock?'Haipo':'+ Ongeza Kikapuni'}</button>
      </div>
    </div>`;
  }).join('');
  $$('.add-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> addToCart(btn.dataset.id));
  });
}

$('#product-search').addEventListener('input', renderProducts);

function addToCart(productId){
  const p = allProducts.find(x=>x.id===productId);
  if(!p) return;
  const existing = cart.find(i=>i.id===productId);
  if(existing) existing.qty += 1;
  else cart.push({ id:p.id, name:p.name, price:p.price, imageUrl:p.imageUrl||'', qty:1 });
  saveCart();
  toast(`${p.name} imeongezwa kikapuni`);
}

/* ---------------- CART & WHATSAPP CHECKOUT ---------------- */

function renderCart(){
  const wrap = $('#cart-list');
  const summary = $('#cart-summary');
  if(cart.length === 0){
    wrap.innerHTML = emptyState('🛒','Kikapu chako kipo tupu','Nenda "Duka" uongeze bidhaa unazohitaji.');
    summary.hidden = true;
    return;
  }
  summary.hidden = false;
  wrap.innerHTML = cart.map(item=>`
    <div class="cart-row" data-id="${item.id}">
      <img src="${esc(item.imageUrl)}" alt="" onerror="this.style.opacity=0">
      <div class="info">
        <div class="product-name">${esc(item.name)}</div>
        <div class="product-price">${money(item.price)}</div>
        <div class="qty-ctrl">
          <button class="qty-minus">–</button>
          <span>${item.qty}</span>
          <button class="qty-plus">+</button>
          <button class="btn-danger" style="margin-left:auto">Ondoa</button>
        </div>
      </div>
    </div>`).join('');

  $$('.cart-row').forEach(row=>{
    const id = row.dataset.id;
    row.querySelector('.qty-plus').addEventListener('click', ()=> changeQty(id, 1));
    row.querySelector('.qty-minus').addEventListener('click', ()=> changeQty(id, -1));
    row.querySelector('.btn-danger').addEventListener('click', ()=> removeFromCart(id));
  });

  const total = cart.reduce((s,i)=> s + i.price*i.qty, 0);
  $('#cart-total').textContent = money(total);
}

function changeQty(id, delta){
  const item = cart.find(i=>i.id===id);
  if(!item) return;
  item.qty += delta;
  if(item.qty <= 0) cart = cart.filter(i=>i.id!==id);
  saveCart();
  renderCart();
}
function removeFromCart(id){
  cart = cart.filter(i=>i.id!==id);
  saveCart();
  renderCart();
}

$('#checkout-btn').addEventListener('click', async ()=>{
  if(cart.length === 0) return;
  const total = cart.reduce((s,i)=> s + i.price*i.qty, 0);
  const lines = cart.map(i=> `• ${i.name} x${i.qty} — ${money(i.price*i.qty)}`).join('\n');
  const message =
`Habari XYZ Pharmacy, naomba kuweka oda ifuatayo:

${lines}

*Jumla: ${money(total)}*

Jina: ${profile.name}
Namba: ${profile.phone}`;

  try{
    await db.collection('orders').add({
      items: cart,
      total,
      customerName: profile.name,
      customerPhone: profile.phone,
      uid: currentUser.uid,
      status: 'mpya',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(err){ console.error('order log failed', err); }

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  cart = [];
  saveCart();
  renderCart();
});

/* ---------------- FAMILY CHAT ---------------- */

function openChat(){
  const log = $('#chat-log');
  log.innerHTML = '';
  unsubChat = db.collection('familyChat').orderBy('createdAt','asc').limitToLast(200)
    .onSnapshot(snap=>{
      log.innerHTML = snap.docs.map(d=>{
        const m = d.data();
        const mine = m.uid === currentUser.uid;
        return `<div class="msg ${mine?'mine':'theirs'}">
          <div class="sender">${esc(m.senderName)}</div>
          ${esc(m.text)}
        </div>`;
      }).join('');
      log.scrollTop = log.scrollHeight;
    }, err=>console.error(err));
}
function closeChat(){
  if(unsubChat){ unsubChat(); unsubChat = null; }
}

$('#chat-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  try{
    await db.collection('familyChat').add({
      text, senderName: profile.name, uid: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(err){ console.error(err); toast('Ujumbe haukutumwa'); }
});

/* ---------------- PWA install prompt ---------------- */

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstall = e;
  $('#install-btn').hidden = false;
});
$('#install-btn')?.addEventListener('click', async ()=>{
  if(!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $('#install-btn').hidden = true;
});

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
}
