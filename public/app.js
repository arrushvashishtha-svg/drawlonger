// ============ STATE ============
let currentUser = null;
let siteSettings = { theme: 'default', banner_message: '' };

const app = document.getElementById('app');
const topnav = document.getElementById('topnav');
const modalRoot = document.getElementById('modalRoot');
const bannerEl = document.getElementById('banner');

// ============ API HELPER ============
async function api(method, url, body, isForm) {
  const opts = { method, credentials: 'include' };
  if (body) {
    if (isForm) {
      opts.body = body;
    } else {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ============ TOASTS ============
function toast(msg) {
  let root = document.getElementById('toastRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toastRoot';
    document.body.appendChild(root);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : s;
  return d.innerHTML;
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function verifiedBadge(v) {
  return v ? '<span class="verified-badge">✓</span>' : '';
}

function avatarHtml(user, size) {
  if (user.avatar_url) return `<img src="${esc(user.avatar_url)}" alt="">`;
  return esc(initials(user.display_name));
}

// ============ THEME ============
const THEME_NAMES = {
  default: 'Default', halloween: 'Halloween', christmas: 'Christmas',
  newyear: 'New Year', valentines: "Valentine's", summer: 'Summer',
};
const THEME_SWATCH = {
  default: 'linear-gradient(135deg,#FAF7F0,#E8541C)',
  halloween: 'linear-gradient(135deg,#16110f,#FF7A1A)',
  christmas: 'linear-gradient(135deg,#0f1d17,#D6473C)',
  newyear: 'linear-gradient(135deg,#0d0d1a,#FFD34E)',
  valentines: 'linear-gradient(135deg,#fdf1f2,#E23B6D)',
  summer: 'linear-gradient(135deg,#fff9ec,#1AA6A0)',
};

function applyTheme(theme) {
  document.body.className = document.body.className.replace(/theme-\S+/g, '').trim();
  if (theme && theme !== 'default') document.body.classList.add('theme-' + theme);
  renderDecor(theme);
}

function renderDecor(theme) {
  let layer = document.getElementById('decorLayer');
  if (layer) layer.remove();
  const items = { halloween: ['🎃','👻','🦇','🕸️'], christmas: ['❄️','🎄','🎁','⭐'], newyear: ['✨','🎉','🎆'], valentines: ['💕','🌹','💌'], summer: ['☀️','🌊','🍉'] }[theme];
  if (!items) return;
  layer = document.createElement('div');
  layer.id = 'decorLayer';
  layer.className = 'decor-layer';
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div');
    el.className = 'decor-item';
    el.textContent = items[i % items.length];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = (16 + Math.random() * 18) + 'px';
    el.style.animationDuration = (10 + Math.random() * 14) + 's';
    el.style.animationDelay = (Math.random() * -20) + 's';
    layer.appendChild(el);
  }
  document.body.appendChild(layer);
}

async function loadSiteSettings() {
  try {
    const { settings } = await api('GET', '/api/public/settings');
    siteSettings = settings;
    applyTheme(settings.theme);
    if (settings.banner_message) {
      bannerEl.textContent = settings.banner_message;
      bannerEl.classList.remove('hidden');
    } else {
      bannerEl.classList.add('hidden');
    }
  } catch (e) {}
}

// ============ AUTH STATE ============
async function loadCurrentUser() {
  try {
    const { user } = await api('GET', '/api/auth/me');
    currentUser = user;
  } catch (e) {
    currentUser = null;
  }
  renderNav();
}

function renderNav() {
  if (currentUser) {
    topnav.innerHTML = `
      <a href="#/create" class="nav-link" data-link>Create</a>
      ${(currentUser.role === 'admin' || currentUser.role === 'owner') ? '<a href="#/admin" class="nav-link" data-link>Admin</a>' : ''}
      <a href="#/profile/${esc(currentUser.username)}" class="avatar-btn" data-link title="${esc(currentUser.display_name)}">${avatarHtml(currentUser)}</a>
      <button class="nav-link" id="logoutBtn">Log out</button>
    `;
    document.getElementById('logoutBtn').onclick = async () => {
      await api('POST', '/api/auth/logout');
      currentUser = null;
      renderNav();
      navigate('#/');
      toast('Logged out');
    };
  } else {
    topnav.innerHTML = `
      <button class="nav-link" id="loginBtn">Log in</button>
      <button class="nav-link primary" id="signupBtn">Sign up</button>
    `;
    document.getElementById('loginBtn').onclick = () => openAuthModal('login');
    document.getElementById('signupBtn').onclick = () => openAuthModal('signup');
  }
}

// ============ MODAL SYSTEM ============
function closeModal() { modalRoot.innerHTML = ''; }

function openModal(innerHtml, opts = {}) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal ${opts.wide ? 'wide' : ''}">
        <button class="modal-close" id="modalCloseBtn">✕</button>
        ${innerHtml}
      </div>
    </div>
  `;
  document.getElementById('modalCloseBtn').onclick = closeModal;
  document.getElementById('backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'backdrop') closeModal();
  });
}

// ============ AUTH MODAL ============
function openAuthModal(mode) {
  const isLogin = mode === 'login';
  openModal(`
    <h2>${isLogin ? 'Welcome back' : 'Join drawlonger'}</h2>
    <form id="authForm">
      ${!isLogin ? `
      <div class="field">
        <label>Display name</label>
        <input name="display_name" placeholder="How others see you" required>
      </div>` : ''}
      <div class="field">
        <label>Username</label>
        <input name="username" placeholder="lowercase, no spaces" required autocomplete="username">
      </div>
      <div class="field">
        <label>Password</label>
        <input name="password" type="password" placeholder="••••••••" required autocomplete="${isLogin ? 'current-password' : 'new-password'}">
      </div>
      <div class="error-text" id="authError" style="display:none;"></div>
      <button type="submit" class="btn full">${isLogin ? 'Log in' : 'Sign up'}</button>
    </form>
    <div class="auth-switch">
      ${isLogin ? "New here?" : "Already have an account?"}
      <button id="switchModeBtn">${isLogin ? 'Sign up' : 'Log in'}</button>
    </div>
  `);
  document.getElementById('switchModeBtn').onclick = () => openAuthModal(isLogin ? 'signup' : 'login');
  document.getElementById('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    const errEl = document.getElementById('authError');
    errEl.style.display = 'none';
    try {
      const { user } = await api('POST', isLogin ? '/api/auth/login' : '/api/auth/signup', payload);
      currentUser = user;
      renderNav();
      closeModal();
      toast(isLogin ? `Welcome back, ${user.display_name}` : `Welcome to drawlonger, ${user.display_name}`);
      router();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}

// ============ PIN CARD ============
function pinCardHtml(pin) {
  return `
    <div class="pin-card" data-pin-id="${pin.id}">
      <img src="${esc(pin.image_url)}" alt="${esc(pin.title)}" loading="lazy">
      <div class="pin-overlay"><div class="pin-overlay-title">${esc(pin.title)}</div></div>
      <div class="pin-meta">
        <span class="pin-meta-name">${esc(pin.author.display_name)}</span>
        ${verifiedBadge(pin.author.verified)}
      </div>
    </div>
  `;
}

function wirePinCards(container) {
  container.querySelectorAll('.pin-card').forEach(card => {
    card.addEventListener('click', () => openPinDetail(card.dataset.pinId));
  });
}

// ============ PIN DETAIL MODAL ============
async function openPinDetail(pinId) {
  openModal(`<div class="loading-state">Loading...</div>`, { wide: true });
  try {
    const { pin, comments } = await api('GET', `/api/pins/pin/${pinId}`);
    renderPinDetail(pin, comments);
  } catch (e) {
    closeModal();
    toast(e.message);
  }
}

function renderPinDetail(pin, comments) {
  const canDelete = currentUser && (currentUser.id === pin.author.id || currentUser.role === 'admin' || currentUser.role === 'owner');
  openModal(`
    <div class="pin-detail-img"><img src="${esc(pin.image_url)}" alt="${esc(pin.title)}"></div>
    <div class="pin-detail-side">
      <div class="pin-detail-actions">
        <button class="btn ${pin.liked ? '' : 'secondary'}" id="likeBtn">${pin.liked ? '♥' : '♡'} ${pin.like_count}</button>
        ${currentUser ? `<button class="btn ghost" id="saveBtn">Save to board</button>` : ''}
        ${canDelete ? `<button class="btn danger" id="deletePinBtn">Delete</button>` : ''}
      </div>
      <h2 class="pin-detail-title">${esc(pin.title)}</h2>
      ${pin.description ? `<p class="pin-detail-desc">${esc(pin.description)}</p>` : ''}
      <a href="#/profile/${esc(pin.author.username)}" data-link class="pin-author-row" style="text-decoration:none;">
        <div class="pin-author-avatar">${avatarHtml(pin.author)}</div>
        <div class="pin-author-name">${esc(pin.author.display_name)} ${verifiedBadge(pin.author.verified)}</div>
      </a>
      <div class="comments-list" id="commentsList">
        ${comments.length ? comments.map(commentHtml).join('') : '<div class="hint-text">No comments yet. Say something nice.</div>'}
      </div>
      ${currentUser ? `
      <form class="comment-form" id="commentForm">
        <input name="body" placeholder="Add a comment" required>
        <button class="btn small" type="submit">Post</button>
      </form>` : `<div class="hint-text">Log in to comment.</div>`}
    </div>
  `, { wide: true });

  document.getElementById('likeBtn').onclick = async () => {
    if (!currentUser) return openAuthModal('login');
    const r = await api('POST', `/api/pins/pin/${pin.id}/like`);
    pin.liked = r.liked; pin.like_count = r.like_count;
    renderPinDetail(pin, comments);
  };

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.onclick = () => openSaveToBoardModal(pin.id);

  const deleteBtn = document.getElementById('deletePinBtn');
  if (deleteBtn) deleteBtn.onclick = async () => {
    if (!confirm('Delete this pin permanently?')) return;
    try {
      await api('DELETE', `/api/pins/pin/${pin.id}`);
      closeModal();
      toast('Pin deleted');
      router();
    } catch (e) { toast(e.message); }
  };

  const cForm = document.getElementById('commentForm');
  if (cForm) cForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { comment } = await api('POST', `/api/pins/pin/${pin.id}/comment`, { body: fd.get('body') });
      comments.push(comment);
      pin.comment_count++;
      e.target.reset();
      renderPinDetail(pin, comments);
    } catch (err) { toast(err.message); }
  };
}

function commentHtml(c) {
  return `
    <div class="comment-row">
      <div class="comment-avatar">${avatarHtml(c.author)}</div>
      <div class="comment-body"><span class="comment-name">${esc(c.author.display_name)}${verifiedBadge(c.author.verified)}</span>${esc(c.body)}</div>
    </div>
  `;
}

async function openSaveToBoardModal(pinId) {
  const { boards } = await api('GET', '/api/pins/boards/mine');
  openModal(`
    <h2>Save to board</h2>
    <div id="boardList">
      ${boards.length ? boards.map(b => `<button class="btn secondary full" style="margin-bottom:8px;" data-board="${b.id}">${esc(b.name)}</button>`).join('') : '<div class="hint-text" style="margin-bottom:14px;">No boards yet.</div>'}
    </div>
    <form id="newBoardForm" style="margin-top:14px;">
      <div class="field"><label>New board</label><input name="name" placeholder="e.g. Character sketches" required></div>
      <button class="btn full" type="submit">Create & save</button>
    </form>
  `);
  modalRoot.querySelectorAll('[data-board]').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api('POST', `/api/pins/boards/${btn.dataset.board}/add/${pinId}`);
        toast('Saved to ' + btn.textContent);
        closeModal();
      } catch (e) { toast(e.message); }
    };
  });
  document.getElementById('newBoardForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { board } = await api('POST', '/api/pins/boards', { name: fd.get('name') });
      await api('POST', `/api/pins/boards/${board.id}/add/${pinId}`);
      toast('Saved to ' + board.name);
      closeModal();
    } catch (err) { toast(err.message); }
  };
}

// ============ PAGES ============
async function renderHome() {
  app.innerHTML = `<div class="loading-state">Loading pins...</div>`;
  try {
    const { pins } = await api('GET', '/api/pins/feed');
    if (!pins.length) {
      app.innerHTML = `<div class="empty-state"><div class="icon">✎</div>Nothing's been posted yet.<br><br>${currentUser ? '<a href="#/create" data-link class="btn">Create the first pin</a>' : '<button class="btn" onclick="openAuthModal(\'signup\')">Sign up to post</button>'}</div>`;
      wireLinks();
      return;
    }
    app.innerHTML = `<div class="masonry">${pins.map(pinCardHtml).join('')}</div>`;
    wirePinCards(app);
  } catch (e) {
    app.innerHTML = `<div class="empty-state">Couldn't load the feed. ${esc(e.message)}</div>`;
  }
}

function renderCreate() {
  if (!currentUser) { openAuthModal('login'); navigate('#/'); return; }
  app.innerHTML = `
    <div style="max-width:520px;margin:0 auto;">
      <h2 style="font-family:var(--font-display);font-size:34px;margin-bottom:20px;">Create a pin</h2>
      <form id="createForm">
        <label class="upload-drop" id="dropZone">
          <span id="dropText">Click to choose an image<div class="hint-text">JPG, PNG, GIF, or WEBP · up to 10MB</div></span>
          <input type="file" name="image" id="imageInput" accept="image/*" required>
        </label>
        <div class="field"><label>Title</label><input name="title" placeholder="Give it a name" required maxlength="120"></div>
        <div class="field"><label>Description</label><textarea name="description" placeholder="Tell people about it (optional)" maxlength="600"></textarea></div>
        <button class="btn full" type="submit" id="createSubmitBtn">Post pin</button>
      </form>
    </div>
  `;
  const dropZone = document.getElementById('dropZone');
  const imageInput = document.getElementById('imageInput');
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    dropZone.classList.add('has-image');
    dropZone.innerHTML = `<img src="${url}" alt="preview">`;
    dropZone.appendChild(imageInput);
  });

  document.getElementById('createForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('createSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Posting...';
    const fd = new FormData(e.target);
    try {
      const { pin } = await api('POST', '/api/pins/create', fd, true);
      toast('Pin posted!');
      navigate('#/');
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = 'Post pin';
    }
  };
}

async function renderProfile(username) {
  app.innerHTML = `<div class="loading-state">Loading profile...</div>`;
  try {
    const { user, pins } = await api('GET', `/api/pins/user/${username}`);
    app.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${avatarHtml(user)}</div>
        <h1 class="profile-name">${esc(user.display_name)} ${verifiedBadge(user.verified)}</h1>
        <div class="profile-username">@${esc(user.username)}</div>
        ${user.bio ? `<p class="profile-bio">${esc(user.bio)}</p>` : ''}
        ${user.role !== 'user' ? `<div class="role-pill">${user.role}</div>` : ''}
      </div>
      ${pins.length ? `<div class="masonry">${pins.map(pinCardHtml).join('')}</div>` : `<div class="empty-state"><div class="icon">✎</div>No pins yet.</div>`}
    `;
    wirePinCards(app);
  } catch (e) {
    app.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

// ============ ADMIN PANEL ============
let adminTab = 'users';

async function renderAdmin() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'owner')) {
    app.innerHTML = `<div class="empty-state">Admins only.</div>`;
    return;
  }
  app.innerHTML = `
    <div class="admin-wrap">
      <h1 style="font-family:var(--font-display);font-size:38px;margin-bottom:6px;">Admin panel</h1>
      <p class="hint-text" style="margin-bottom:20px;">Signed in as ${esc(currentUser.display_name)} · ${currentUser.role}</p>
      <div class="admin-tabs">
        <div class="admin-tab" data-tab="users">Users</div>
        <div class="admin-tab" data-tab="theme">Site theme</div>
        <div class="admin-tab" data-tab="log">Activity log</div>
      </div>
      <div id="adminContent"></div>
    </div>
  `;
  app.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === adminTab);
    t.onclick = () => { adminTab = t.dataset.tab; renderAdmin(); };
  });
  const content = document.getElementById('adminContent');
  if (adminTab === 'users') await renderAdminUsers(content);
  else if (adminTab === 'theme') await renderAdminTheme(content);
  else await renderAdminLog(content);
}

async function renderAdminUsers(content) {
  content.innerHTML = `<div class="loading-state">Loading users...</div>`;
  const { users } = await api('GET', '/api/admin/users');
  const isOwner = currentUser.role === 'owner';
  content.innerHTML = users.map(u => `
    <div class="admin-card">
      <div class="admin-user-info">
        <div class="pin-author-avatar">${initials(u.display_name)}</div>
        <div>
          <div style="font-weight:700;">${esc(u.display_name)} ${u.verified ? verifiedBadge(true) : ''} ${u.banned ? '<span class="role-pill banned-pill">banned</span>' : ''} ${u.role !== 'user' ? `<span class="role-pill">${u.role}</span>` : ''}</div>
          <div class="admin-user-meta">@${esc(u.username)}${u.banned && u.ban_reason ? ' · ' + esc(u.ban_reason) : ''}</div>
        </div>
      </div>
      <div class="admin-actions">
        ${u.role === 'owner' ? '' : `
          ${u.banned
            ? `<button class="btn small secondary" data-act="unban" data-id="${u.id}">Unban</button>`
            : `<button class="btn small danger" data-act="ban" data-id="${u.id}">Ban</button>`}
          ${u.verified
            ? `<button class="btn small secondary" data-act="unverify" data-id="${u.id}">Unverify</button>`
            : `<button class="btn small secondary" data-act="verify" data-id="${u.id}">Verify</button>`}
          ${isOwner ? (u.role === 'admin'
            ? `<button class="btn small secondary" data-act="remove-admin" data-id="${u.id}">Remove admin</button>`
            : `<button class="btn small secondary" data-act="make-admin" data-id="${u.id}">Make admin</button>`) : ''}
        `}
      </div>
    </div>
  `).join('');

  content.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = async () => {
      const act = btn.dataset.act, id = btn.dataset.id;
      try {
        if (act === 'ban') {
          const reason = prompt('Reason for ban (optional):') || '';
          await api('POST', `/api/admin/users/${id}/ban`, { reason });
        } else {
          await api('POST', `/api/admin/users/${id}/${act}`);
        }
        toast('Done');
        renderAdminUsers(content);
      } catch (e) { toast(e.message); }
    };
  });
}

async function renderAdminTheme(content) {
  content.innerHTML = `<div class="loading-state">Loading settings...</div>`;
  const { settings } = await api('GET', '/api/admin/settings');
  content.innerHTML = `
    <h3 style="margin-bottom:14px;">Front page theme</h3>
    <div class="theme-grid">
      ${Object.keys(THEME_NAMES).map(t => `
        <div class="theme-option ${settings.theme === t ? 'active' : ''}" data-theme="${t}">
          <div class="theme-swatch" style="background:${THEME_SWATCH[t]}"></div>
          ${THEME_NAMES[t]}
        </div>
      `).join('')}
    </div>
    <h3 style="margin:26px 0 10px;">Site banner</h3>
    <form id="bannerForm">
      <div class="field"><input name="message" placeholder="e.g. Happy Halloween! 🎃 New spooky theme is live" value="${esc(settings.banner_message || '')}"></div>
      <button class="btn" type="submit">Update banner</button>
    </form>
  `;
  content.querySelectorAll('[data-theme]').forEach(el => {
    el.onclick = async () => {
      try {
        await api('POST', '/api/admin/settings/theme', { theme: el.dataset.theme });
        toast('Theme updated to ' + THEME_NAMES[el.dataset.theme]);
        loadSiteSettings();
        renderAdminTheme(content);
      } catch (e) { toast(e.message); }
    };
  });
  document.getElementById('bannerForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('POST', '/api/admin/settings/banner', { message: fd.get('message') });
      toast('Banner updated');
      loadSiteSettings();
    } catch (err) { toast(err.message); }
  };
}

async function renderAdminLog(content) {
  content.innerHTML = `<div class="loading-state">Loading log...</div>`;
  const { log } = await api('GET', '/api/admin/log');
  content.innerHTML = log.length ? log.map(l => `
    <div class="admin-card">
      <div><strong>@${esc(l.actor_username)}</strong> ${esc(l.action.replace(/_/g,' '))} ${l.target ? '· ' + esc(l.target) : ''}</div>
      <div class="admin-user-meta">${esc(l.created_at)}</div>
    </div>
  `).join('') : `<div class="hint-text">No admin actions yet.</div>`;
}

// ============ ROUTER ============
function wireLinks() {
  document.querySelectorAll('[data-link]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.getAttribute('href'));
    });
  });
}

function navigate(hash) {
  window.location.hash = hash;
}

function router() {
  const hash = window.location.hash || '#/';
  closeModal();
  if (hash === '#/' || hash === '') renderHome();
  else if (hash === '#/create') renderCreate();
  else if (hash === '#/admin') renderAdmin();
  else if (hash.startsWith('#/profile/')) renderProfile(decodeURIComponent(hash.split('/')[2]));
  else renderHome();
  wireLinks();
}

window.addEventListener('hashchange', router);
document.body.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (link) { e.preventDefault(); navigate(link.getAttribute('href')); }
});

document.getElementById('searchInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const q = e.target.value.trim().toLowerCase();
  if (!q) return;
  navigate('#/profile/' + encodeURIComponent(q.replace(/^@/, '')));
});

// ============ INIT ============
(async function init() {
  await loadSiteSettings();
  await loadCurrentUser();
  router();
})();
