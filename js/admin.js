/* =========================================================
   XYZ PHARMACY — Admin dashboard logic
   ========================================================= */

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

/* ---------------- LOGIN ---------------- */

auth.onAuthStateChanged(user=>{
  if(user && !user.isAnonymous){
    $('#admin-login').hidden = true;
    $('#admin-dash').hidden = false;
    initDashboard();
  } else {
    $('#admin-login').hidden = false;
    $('#admin-dash').hidden = true;
  }
});

$('#login-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const pass = $('#login-pass').value;
  $('#login-error').textContent = '';
  try{
    await auth.signInWithEmailAndPassword(email, pass);
  }catch(err){
    $('#login-error').textContent = 'Email au password si sahihi.';
  }
});

$('#logout-btn').addEventListener('click', ()=> auth.signOut());

let dashInitialized = false;
function initDashboard(){
  if(dashInitialized) return;
  dashInitialized = true;
  bindTabs();
  watchPosts();
  watchProducts();
  watchOrders();
  watchUsers();
}

function bindTabs(){
  $$('.admin-tabs button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.admin-tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $$('.admin-panel').forEach(p=> p.hidden = p.id !== `panel-${btn.dataset.panel}`);
    });
  });
}

function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------------- CLOUDINARY UPLOAD ---------------- */

async function uploadImage(file){
  if(!file) return '';
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method:'POST', body: form
  });
  if(!res.ok) throw new Error('Upload imeshindikana');
  const data = await res.json();
  return data.secure_url;
}

/* ---------------- POSTS ---------------- */

$('#post-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Inachapisha...';
  try{
    const file = $('#post-image').files[0];
    const imageUrl = file ? await uploadImage(file) : '';
    await db.collection('posts').add({
      title: $('#post-title').value.trim(),
      category: $('#post-category').value.trim() || 'Elimu ya Afya',
      body: $('#post-body').value.trim(),
      imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    e.target.reset();
  }catch(err){
    alert('Imeshindikana: ' + err.message);
  }finally{
    btn.disabled = false; btn.textContent = 'Chapisha Makala';
  }
});

function watchPosts(){
  db.collection('posts').orderBy('createdAt','desc').onSnapshot(snap=>{
    $('#posts-table-body').innerHTML = snap.docs.map(d=>{
      const p = d.data();
      const date = p.createdAt ? p.createdAt.toDate().toLocaleDateString('sw-TZ') : '-';
      return `<tr>
        <td>${p.imageUrl ? `<img class="thumb-sm" src="${esc(p.imageUrl)}">` : ''}</td>
        <td>${esc(p.title)}</td>
        <td>${esc(p.category)}</td>
        <td>${date}</td>
        <td><button class="btn-danger" data-del="${d.id}">Futa</button></td>
      </tr>`;
    }).join('');
    $$('#posts-table-body [data-del]').forEach(b=>{
      b.addEventListener('click', ()=>{
        if(confirm('Una uhakika unataka kufuta makala hii?')) db.collection('posts').doc(b.dataset.del).delete();
      });
    });
  });
}

/* ---------------- PRODUCTS ---------------- */

$('#product-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Inaongeza...';
  try{
    const file = $('#prod-image').files[0];
    const imageUrl = file ? await uploadImage(file) : '';
    await db.collection('products').add({
      name: $('#prod-name').value.trim(),
      price: Number($('#prod-price').value) || 0,
      category: $('#prod-category').value.trim() || 'Jumla',
      stock: Number($('#prod-stock').value) || 0,
      imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    e.target.reset();
  }catch(err){
    alert('Imeshindikana: ' + err.message);
  }finally{
    btn.disabled = false; btn.textContent = 'Ongeza Bidhaa';
  }
});

function watchProducts(){
  db.collection('products').orderBy('createdAt','desc').onSnapshot(snap=>{
    $('#products-table-body').innerHTML = snap.docs.map(d=>{
      const p = d.data();
      return `<tr>
        <td>${p.imageUrl ? `<img class="thumb-sm" src="${esc(p.imageUrl)}">` : ''}</td>
        <td>${esc(p.name)}</td>
        <td>TSh ${Number(p.price||0).toLocaleString()}</td>
        <td>${p.stock ?? 0}</td>
        <td><button class="btn-danger" data-del="${d.id}">Futa</button></td>
      </tr>`;
    }).join('');
    $$('#products-table-body [data-del]').forEach(b=>{
      b.addEventListener('click', ()=>{
        if(confirm('Una uhakika unataka kufuta bidhaa hii?')) db.collection('products').doc(b.dataset.del).delete();
      });
    });
  });
}

/* ---------------- BULK PRODUCT UPLOAD (Excel) ---------------- */

$('#excel-upload').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const status = $('#excel-status');
  status.textContent = 'Inasoma faili...';
  try{
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    if(rows.length === 0){ status.textContent = 'Faili halina data.'; return; }

    status.textContent = `Inapakia bidhaa ${rows.length}...`;
    const batch = db.batch();
    rows.forEach(row=>{
      const ref = db.collection('products').doc();
      batch.set(ref, {
        name: String(row.name || row.Name || '').trim(),
        price: Number(row.price || row.Price || 0),
        category: String(row.category || row.Category || 'Jumla').trim(),
        stock: Number(row.stock || row.Stock || 0),
        imageUrl: String(row.imageUrl || row.ImageUrl || row.image || '').trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    status.textContent = `✅ Bidhaa ${rows.length} zimepakiwa kikamilifu.`;
  }catch(err){
    console.error(err);
    status.textContent = '❌ Imeshindikana kusoma faili. Hakikisha ni .xlsx/.csv sahihi.';
  }finally{
    e.target.value = '';
  }
});

/* ---------------- ORDERS ---------------- */

function watchOrders(){
  db.collection('orders').orderBy('createdAt','desc').limit(200).onSnapshot(snap=>{
    $('#orders-table-body').innerHTML = snap.docs.map(d=>{
      const o = d.data();
      const date = o.createdAt ? o.createdAt.toDate().toLocaleString('sw-TZ') : '-';
      const itemsText = (o.items||[]).map(i=>`${i.name} x${i.qty}`).join(', ');
      const status = o.status || 'mpya';
      return `<tr>
        <td>${esc(o.customerName)}</td>
        <td>${esc(o.customerPhone)}</td>
        <td>${esc(itemsText)}</td>
        <td>TSh ${Number(o.total||0).toLocaleString()}</td>
        <td>
          <select data-order="${d.id}" class="status-select">
            <option value="mpya" ${status==='mpya'?'selected':''}>Mpya</option>
            <option value="imekamilika" ${status==='imekamilika'?'selected':''}>Imekamilika</option>
          </select>
        </td>
        <td>${date}</td>
      </tr>`;
    }).join('');
    $$('.status-select').forEach(sel=>{
      sel.addEventListener('change', ()=>{
        db.collection('orders').doc(sel.dataset.order).update({ status: sel.value });
      });
    });
  });
}

/* ---------------- USERS ---------------- */

let allUsers = [];
function watchUsers(){
  db.collection('users').orderBy('joinedAt','desc').onSnapshot(snap=>{
    allUsers = snap.docs.map(d=>d.data());
    $('#users-count').textContent = allUsers.length;
    $('#users-table-body').innerHTML = allUsers.map(u=>{
      const date = u.joinedAt ? u.joinedAt.toDate().toLocaleDateString('sw-TZ') : '-';
      return `<tr><td>${esc(u.name)}</td><td>${esc(u.phone)}</td><td>${date}</td></tr>`;
    }).join('');
  });
}

$('#export-users-btn').addEventListener('click', ()=>{
  const rows = allUsers.map(u=>({
    Jina: u.name,
    Namba: u.phone,
    'Tarehe ya Kujisajili': u.joinedAt ? u.joinedAt.toDate().toLocaleDateString('sw-TZ') : ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Wateja');
  XLSX.writeFile(wb, `xyz-pharmacy-wateja-${new Date().toISOString().slice(0,10)}.xlsx`);
});
