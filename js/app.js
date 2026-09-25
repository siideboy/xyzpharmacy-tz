/* =========================================================
   XYZ PHARMACY — App logic (member-facing PWA)
   Passwordless identity model: the WhatsApp phone number IS the
   account (Firestore doc id = phone). Firebase Anonymous Auth
   runs silently in the background only as a security-rule gate
   ("isSignedIn()") — it is not the user's identity.
   ========================================================= */

let currentUser = null;      // firebase anonymous auth user (gate only)
let profile = null;          // {name, phone, role}
let cart = JSON.parse(localStorage.getItem('xyz_cart') || '[]');
let allProducts = [];
let allPosts = [];
let allUsers = [];
let sentRequests = [];
let receivedRequests = [];
let unsubChat = null;
let unsubPrivate = null;
let heartbeatTimer = null;
let activeFriendPhone = null;

let postsFirstLoad = true;
let productsFirstLoad = true;
let lastSeenPostsTime = Number(localStorage.getItem('xyz_last_seen_posts') || 0);
let lastSeenProductsTime = Number(localStorage.getItem('xyz_last_seen_products') || 0);

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>t.classList.remove('show'), 2200);
}
function money(n){ return 'TSh ' + Number(n||0).toLocaleString('en-US'); }
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function emptyState(emoji, title, sub){ return `<div class="empty-state"><div class="emoji">${emoji}</div><h3>${title}</h3><p>${sub}</p></div>`; }
function normalizePhone(raw){ return String(raw||'').replace(/[^\d]/g,''); }
function setBadge(sel, count){
  const el = $(sel);
  if(!el) return;
  if(count > 0){ el.textContent = count > 9 ? '9+' : count; el.style.display = 'flex'; }
  else el.style.display = 'none';
}

function saveCart(){
  localStorage.setItem('xyz_cart', JSON.stringify(cart));
  renderCartBadge();
}
function renderCartBadge(){
  const count = cart.reduce((s,i)=>s+i.qty,0);
  setBadge('#cart-badge', count);
}

/* ---------------- AUTH / LOGIN / REGISTER ---------------- */

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
  const savedPhone = localStorage.getItem('xyz_my_phone');
  const active = localStorage.getItem('xyz_active') === '1';
  if(savedPhone && active){
    // Boot immediately from the locally cached profile so a slow or
    // temporarily-blocked Firestore read NEVER bounces the person back
    // to the login screen on refresh.
    const cached = localStorage.getItem('xyz_profile');
    if(cached){
      try{ profile = JSON.parse(cached); boot(); }catch(e){ /* ignore bad cache */ }
    }
    try{
      const doc = await db.collection('users').doc(savedPhone).get();
      if(doc.exists){
        profile = doc.data();
        localStorage.setItem('xyz_profile', JSON.stringify(profile));
        boot();
        return;
      }
      if(!cached) showAuthScreen();
    }catch(err){
      console.error('profile fetch failed', err);
      if(!cached) showAuthScreen();
      // if we already booted from cache above, stay right where we are.
    }
    return;
  }
  showAuthScreen();
});

function showAuthScreen(){
  $('#auth-screen').hidden = false;
  $('#app-screen').hidden = true;
}

function setAuthTab(tab){
  $$('.auth-tab').forEach(b=>b.classList.toggle('active', b.dataset.authtab === tab));
  $('#login-phone-form').hidden = tab !== 'login';
  $('#register-form').hidden = tab !== 'register';
}
$$('.auth-tab').forEach(btn=>{
  btn.addEventListener('click', ()=> setAuthTab(btn.dataset.authtab));
});

$('#login-phone-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const phone = normalizePhone($('#login-phone').value);
  $('#login-error').textContent = '';
  if(phone.length < 9){ toast('Weka namba sahihi ya simu'); return; }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Inaingia...';
  try{
    const doc = await db.collection('users').doc(phone).get();
    if(!doc.exists){
      $('#login-error').textContent = 'Namba hii haijasajiliwa bado. Jisajili kwanza.';
      $('#reg-phone').value = $('#login-phone').value;
      setAuthTab('register');
      return;
    }
    profile = doc.data();
    localStorage.setItem('xyz_my_phone', phone);
    localStorage.setItem('xyz_active', '1');
    localStorage.setItem('xyz_profile', JSON.stringify(profile));
    boot();
  }catch(err){
    console.error(err);
    toast('Imeshindikana kuingia, jaribu tena');
  }finally{
    btn.disabled = false; btn.textContent = 'Ingia';
  }
});

$('#register-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = $('#reg-name').value.trim();
  const phone = normalizePhone($('#reg-phone').value);
  $('#register-error').textContent = '';
  if(!name || phone.length < 9){ toast('Jaza jina na namba sahihi ya simu'); return; }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Inasajili...';
  try{
    const existing = await db.collection('users').doc(phone).get();
    if(existing.exists){
      $('#register-error').textContent = 'Namba hii tayari imesajiliwa. Tumia "Ingia".';
      $('#login-phone').value = $('#reg-phone').value;
      setAuthTab('login');
      return;
    }
    await db.collection('users').doc(phone).set({
      name, phone,
      role: 'member',
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
    profile = { name, phone, role: 'member' };
    localStorage.setItem('xyz_my_phone', phone);
    localStorage.setItem('xyz_active', '1');
    localStorage.setItem('xyz_profile', JSON.stringify(profile));
    boot();
  }catch(err){
    console.error(err);
    toast('Imeshindikana kusajili, jaribu tena');
  }finally{
    btn.disabled = false; btn.textContent = 'Jisajili na Uendelee';
  }
});

$('#logout-btn')?.addEventListener('click', ()=>{
  if(heartbeatTimer) clearInterval(heartbeatTimer);
  if(unsubChat){ unsubChat(); unsubChat = null; }
  if(unsubPrivate){ unsubPrivate(); unsubPrivate = null; }
  localStorage.removeItem('xyz_my_phone');
  localStorage.removeItem('xyz_active');
  localStorage.removeItem('xyz_profile');
  profile = null;
  booted = false;
  $('#login-phone-form')?.reset();
  $('#register-form')?.reset();
  setAuthTab('login');
  $('#app-screen').hidden = true;
  $('#auth-screen').hidden = false;
  toast('Umetoka. Karibu tena!');
});

/* ---------------- BOOT APP ---------------- */

let booted = false;
function boot(){
  $('#auth-screen').hidden = true;
  $('#app-screen').hidden = false;
  $('#profile-name').textContent = profile.name;
  $('#profile-phone').textContent = profile.phone;
  if(booted) return; // already running listeners/heartbeat; just refreshed the text above
  booted = true;
  renderCartBadge();
  loadPosts();
  loadProducts();
  watchUsers();
  watchFriendRequests();
  startHeartbeat();
  switchTab('home');
}

/* ---------------- TAB NAVIGATION ---------------- */

$$('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=> switchTab(btn.dataset.tab));
});

function switchTab(tab){
  $$('.view').forEach(v=> v.hidden = v.id !== `view-${tab}`);
  $$('.tab').forEach(b=> b.classList.toggle('active', b.dataset.tab === tab));
  if(tab === 'home') markPostsSeen();
  if(tab === 'duka') markProductsSeen();
  if(tab === 'cart') renderCart();
  if(tab === 'chat'){ showChatSubView('group'); } else { closeChat(); if(unsubPrivate){ unsubPrivate(); unsubPrivate=null; } }
}

/* ---------------- NOTIFICATIONS (foreground) ---------------- */

function notifyNew(title, body){
  toast(`${title}: ${body}`);
  if('Notification' in window && Notification.permission === 'granted'){
    try{ new Notification(title, { body, icon:'./icons/icon-192.png' }); }catch(e){ console.error(e); }
  }
}

$('#notif-btn')?.addEventListener('click', ()=>{
  if(!('Notification' in window)){ toast('Kivinjari hiki hakitumii arifa'); return; }
  Notification.requestPermission().then(perm=>{
    toast(perm === 'granted' ? 'Arifa zimewashwa! 🔔' : 'Umekataa ruhusa ya arifa');
  });
});

function markPostsSeen(){
  const now = Date.now();
  lastSeenPostsTime = now;
  localStorage.setItem('xyz_last_seen_posts', String(now));
  updatePostsBadge();
}
function markProductsSeen(){
  const now = Date.now();
  lastSeenProductsTime = now;
  localStorage.setItem('xyz_last_seen_products', String(now));
  updateProductsBadge();
}
function updatePostsBadge(){
  const unseen = allPosts.filter(p=> p.createdAt && p.createdAt.toMillis() > lastSeenPostsTime).length;
  setBadge('#posts-badge', unseen);
}
function updateProductsBadge(){
  const unseen = allProducts.filter(p=> p.createdAt && p.createdAt.toMillis() > lastSeenProductsTime).length;
  setBadge('#products-badge', unseen);
}

/* ---------------- POSTS (Elimu ya Afya) ---------------- */

function loadPosts(){
  db.collection('posts').orderBy('createdAt','desc').limit(30)
    .onSnapshot(snap=>{
      allPosts = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      const wrap = $('#posts-list');
      if(allPosts.length === 0){
        wrap.innerHTML = emptyState('📰','Bado hakuna makala', 'Admin atakapoongeza elimu ya afya, itaonekana hapa.');
      } else {
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
        $$('.read-more-btn').forEach(btn=> btn.addEventListener('click', ()=> openPost(btn.dataset.post)));
      }
      if(!postsFirstLoad){
        const newest = allPosts[0];
        if(newest && newest.createdAt && newest.createdAt.toMillis() > lastSeenPostsTime){
          notifyNew('Makala Mpya ya Afya', newest.title);
        }
      }
      postsFirstLoad = false;
      updatePostsBadge();
    }, err=>console.error(err));
}

function openPost(id){
  const p = allPosts.find(x=>x.id===id);
  if(!p) return;
  const date = p.createdAt ? p.createdAt.toDate().toLocaleDateString('sw-TZ',{day:'numeric',month:'short',year:'numeric'}) : '';
  const others = allPosts.filter(x=>x.id!==id).slice(0,8);
  const relatedHtml = others.length ? `
    <div class="related-posts">
      <h4 class="related-title">Makala Nyingine</h4>
      <div class="related-scroll">
        ${others.map(o=>`
          <button type="button" class="related-card" data-post="${o.id}">
            ${o.imageUrl ? `<img src="${esc(o.imageUrl)}" alt="">` : '<div class="related-noimg">📰</div>'}
            <div class="related-card-title">${esc(o.title)}</div>
          </button>`).join('')}
      </div>
    </div>` : '';
  $('#post-modal-body').innerHTML = `
    ${p.imageUrl ? `<img class="post-modal-img" src="${esc(p.imageUrl)}" alt="">` : ''}
    <div class="post-modal-content">
      <span class="post-tag">${esc(p.category||'Elimu ya Afya')}</span>
      <h2 class="post-modal-title">${esc(p.title)}</h2>
      <div class="post-date">${date}</div>
      <p class="post-modal-text">${esc(p.body||'').replace(/\n/g,'<br>')}</p>
      ${relatedHtml}
    </div>`;
  $('#post-modal').classList.add('open');
  $('.post-modal-sheet').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  $$('.related-card').forEach(btn=> btn.addEventListener('click', ()=> openPost(btn.dataset.post)));
}
function closePost(){
  $('#post-modal').classList.remove('open');
  document.body.style.overflow = '';
}
$('#post-modal-close')?.addEventListener('click', closePost);
$('#post-modal')?.addEventListener('click', (e)=>{ if(e.target.id === 'post-modal') closePost(); });

/* ---------------- PRODUCTS (Duka) ---------------- */

function loadProducts(){
  db.collection('products').orderBy('createdAt','desc').limit(100)
    .onSnapshot(snap=>{
      allProducts = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      renderProductFilters();
      renderProducts();
      if(!productsFirstLoad){
        const newest = allProducts[0];
        if(newest && newest.createdAt && newest.createdAt.toMillis() > lastSeenProductsTime){
          notifyNew('Bidhaa Mpya Dukani', newest.name);
        }
      }
      productsFirstLoad = false;
      updateProductsBadge();
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
  $$('.add-btn').forEach(btn=> btn.addEventListener('click', ()=> addToCart(btn.dataset.id)));
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

/* ---------------- PRESENCE (online/offline heartbeat) ---------------- */

function startHeartbeat(){
  updateHeartbeat();
  heartbeatTimer = setInterval(updateHeartbeat, 25000);
}
function updateHeartbeat(){
  if(!profile) return;
  db.collection('users').doc(profile.phone).update({
    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(()=>{});
}
function isOnline(user){
  return !!(user.lastSeen && (Date.now() - user.lastSeen.toMillis()) < 60000);
}

/* ---------------- FAMILY CHAT (group) ---------------- */

function openChat(){
  const log = $('#chat-log');
  log.innerHTML = '';
  if(unsubChat) unsubChat();
  unsubChat = db.collection('familyChat').orderBy('createdAt','asc').limitToLast(200)
    .onSnapshot(snap=>{
      log.innerHTML = snap.docs.map(d=>{
        const m = d.data();
        const mine = m.senderPhone === profile.phone;
        return `<div class="msg ${mine?'mine':'theirs'}">
          ${mine ? '' : `<div class="sender">${esc(m.senderName)}</div>`}
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
      text, senderName: profile.name, senderPhone: profile.phone,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(err){ console.error(err); toast('Ujumbe haukutumwa'); }
});

/* ---------------- CHAT SUB-VIEWS (Kikundi / Watu / Private) ---------------- */

$$('.seg-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> showChatSubView(btn.dataset.chatview));
});

function showChatSubView(view){
  $$('.seg-btn').forEach(b=> b.classList.toggle('active', b.dataset.chatview === view || (view==='private' && b.dataset.chatview==='people')));
  $('#chat-group-view').hidden = view !== 'group';
  $('#chat-people-view').hidden = view !== 'people';
  $('#chat-private-view').hidden = view !== 'private';
  if(view === 'group') openChat(); else closeChat();
  if(view !== 'private' && unsubPrivate){ unsubPrivate(); unsubPrivate = null; }
}

/* ---------------- PEOPLE / PRESENCE DIRECTORY ---------------- */

function watchUsers(){
  db.collection('users').onSnapshot(snap=>{
    allUsers = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderPeopleList();
  }, err=>console.error(err));
}

function watchFriendRequests(){
  db.collection('friendRequests').where('fromPhone','==', profile.phone).onSnapshot(snap=>{
    sentRequests = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderPeopleList();
  }, err=>console.error(err));
  db.collection('friendRequests').where('toPhone','==', profile.phone).onSnapshot(snap=>{
    receivedRequests = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderPeopleList();
    updatePeopleBadge();
  }, err=>console.error(err));
}

function updatePeopleBadge(){
  const count = receivedRequests.filter(r=>r.status==='pending').length;
  setBadge('#people-badge', count);
  setBadge('#chat-badge', count);
}

function getRelationship(otherPhone){
  const sent = sentRequests.find(r=>r.toPhone===otherPhone);
  const received = receivedRequests.find(r=>r.fromPhone===otherPhone);
  if((sent && sent.status==='accepted') || (received && received.status==='accepted')) return 'friends';
  if(sent && sent.status==='pending') return 'sent';
  if(received && received.status==='pending') return 'received';
  return 'none';
}

function renderPeopleList(){
  if(!profile) return;
  const list = $('#people-list');
  const others = allUsers.filter(u=>u.phone !== profile.phone);
  if(others.length === 0){
    list.innerHTML = emptyState('👥','Bado hakuna wanachama wengine','Watakapojisajili, wataonekana hapa.');
    return;
  }
  list.innerHTML = others.map(u=>{
    const online = isOnline(u);
    const rel = getRelationship(u.phone);
    let action = '';
    if(rel === 'friends') action = `<button class="btn-secondary chat-friend-btn" data-phone="${esc(u.phone)}">Chat</button>`;
    else if(rel === 'sent') action = `<span class="pill-status new">Ombi Limetumwa</span>`;
    else if(rel === 'received') action = `<button class="add-btn accept-btn" data-phone="${esc(u.phone)}" style="width:auto; padding:8px 14px">Kubali</button>`;
    else action = `<button class="btn-secondary friend-request-btn" data-phone="${esc(u.phone)}">+ Ombi</button>`;
    return `<div class="person-row">
      <div class="person-avatar">${esc((u.name||'?').charAt(0).toUpperCase())}<span class="dot ${online?'online':'offline'}"></span></div>
      <div class="person-info">
        <div class="person-name">${esc(u.name)}</div>
        <div class="person-status">${online?'🟢 Yupo Online':'⚪ Hayupo Online'}</div>
      </div>
      ${action}
    </div>`;
  }).join('');

  $$('.friend-request-btn').forEach(b=> b.addEventListener('click', ()=> sendFriendRequest(b.dataset.phone)));
  $$('.accept-btn').forEach(b=> b.addEventListener('click', ()=> acceptFriendRequest(b.dataset.phone)));
  $$('.chat-friend-btn').forEach(b=> b.addEventListener('click', ()=> openPrivateChat(b.dataset.phone)));
}

async function sendFriendRequest(toPhone){
  const target = allUsers.find(u=>u.phone===toPhone);
  try{
    await db.collection('friendRequests').add({
      fromPhone: profile.phone, fromName: profile.name,
      toPhone, toName: target ? target.name : '',
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Ombi la urafiki limetumwa');
  }catch(err){ console.error(err); toast('Imeshindwa kutuma ombi'); }
}

async function acceptFriendRequest(fromPhone){
  const req = receivedRequests.find(r=>r.fromPhone===fromPhone && r.status==='pending');
  if(!req) return;
  try{
    await db.collection('friendRequests').doc(req.id).update({ status:'accepted' });
    toast('Sasa ni marafiki — unaweza kuchat naye');
  }catch(err){ console.error(err); toast('Imeshindwa kukubali ombi'); }
}

/* ---------------- PRIVATE CHAT (1-to-1) ---------------- */

function privateChatId(a, b){ return [a,b].sort().join('__'); }

function openPrivateChat(friendPhone){
  activeFriendPhone = friendPhone;
  const friend = allUsers.find(u=>u.phone===friendPhone);
  $('#private-chat-name').textContent = friend ? friend.name : friendPhone;
  $('#private-chat-status').textContent = friend && isOnline(friend) ? '🟢 Yupo Online' : '⚪ Hayupo Online';
  showChatSubView('private');

  const chatId = privateChatId(profile.phone, friendPhone);
  const log = $('#private-chat-log');
  log.innerHTML = '';
  if(unsubPrivate) unsubPrivate();
  unsubPrivate = db.collection('privateChats').doc(chatId).collection('messages')
    .orderBy('createdAt','asc').limitToLast(200)
    .onSnapshot(snap=>{
      log.innerHTML = snap.docs.map(d=>{
        const m = d.data();
        const mine = m.senderPhone === profile.phone;
        return `<div class="msg ${mine?'mine':'theirs'}">
          ${mine ? '' : `<div class="sender">${esc(m.senderName)}</div>`}
          ${esc(m.text)}
        </div>`;
      }).join('');
      log.scrollTop = log.scrollHeight;
    }, err=>console.error(err));
}

$('#private-back-btn')?.addEventListener('click', ()=>{
  if(unsubPrivate){ unsubPrivate(); unsubPrivate = null; }
  activeFriendPhone = null;
  showChatSubView('people');
});

$('#private-chat-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const input = $('#private-chat-input');
  const text = input.value.trim();
  if(!text || !activeFriendPhone) return;
  input.value = '';
  const chatId = privateChatId(profile.phone, activeFriendPhone);
  try{
    await db.collection('privateChats').doc(chatId).collection('messages').add({
      text, senderPhone: profile.phone, senderName: profile.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('privateChats').doc(chatId).set({
      participants: [profile.phone, activeFriendPhone]
    }, { merge:true });
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
