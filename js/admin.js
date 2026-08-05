/* ============================================================
   2vStudio — admin.js
   Hidden admin dashboard. Guarded by AdminSession (storage.js).
   All CRUD operates on Supabase via EditorsAPI / PortfolioAPI.

   Admin manages crews (editors) including their member login
   account (username + password) so they can sign in at
   member-login.html and manage their own profile/portfolio.
   Portfolio tab here is view + moderate only — crews upload
   their own work from member.html.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  if (!AdminSession.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  initSidebar();
  await renderOverview();
  await renderEditorsTable();
  await renderPortfolioTable();
  await renderFeaturedTable();
  wireEditorForm();
  wireEditorsSearch();
  wirePortfolioSearch();
  wireFeaturedSearch();
  wireSettings();
  wireLogout();
});

const DEFAULT_AVATAR_COLOR = 'linear-gradient(145deg,#A855F7,#FF2E88)';

function initials(name) { return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

/* ---------- sidebar / view switching ---------- */

function initSidebar() {
  const buttons = document.querySelectorAll('.admin-nav button');
  const views = document.querySelectorAll('.admin-view');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      document.querySelector('.admin-sidebar')?.classList.remove('open');
      closeEditorPanel();
    });
  });
  document.getElementById('admin-mobile-toggle')?.addEventListener('click', () => {
    document.querySelector('.admin-sidebar').classList.toggle('open');
  });
}

/* ---------- overview ---------- */

async function renderOverview() {
  const editors = await EditorsAPI.all();
  const portfolio = await PortfolioAPI.all();
  document.getElementById('stat-editors').textContent = editors.length;
  document.getElementById('stat-portfolio').textContent = portfolio.length;
  document.getElementById('stat-featured').textContent = portfolio.filter(p => p.featured).length;
  document.getElementById('stat-open').textContent = editors.filter(e => e.status === 'open').length;
}

async function refreshAll() {
  await renderOverview();
  await renderEditorsTable();
  await renderPortfolioTable();
  await renderFeaturedTable();
}

/* ---------- editors table (with live search) ---------- */

let allEditorsCache = [];
let editorCountsCache = {};
let editorsSearchQuery = '';

async function renderEditorsTable() {
  const tbody = document.getElementById('editors-tbody');
  tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Loading…</td></tr>`;
  allEditorsCache = await EditorsAPI.all();
  const counts = await Promise.all(allEditorsCache.map(e => PortfolioAPI.byEditor(e.id)));
  editorCountsCache = Object.fromEntries(allEditorsCache.map((e, i) => [e.id, counts[i].length]));
  renderEditorsRows();
}

function renderEditorsRows() {
  const tbody = document.getElementById('editors-tbody');
  const q = editorsSearchQuery.trim().toLowerCase();
  const filtered = allEditorsCache.filter(e => {
    if (!q) return true;
    const haystack = [e.nickname, e.role, e.username || ''].join(' ').toLowerCase();
    return haystack.includes(q);
  });

  tbody.innerHTML = filtered.length ? filtered.map(e => `
    <tr>
      <td><span class="admin-row-avatar" style="${e.avatarImage ? `background-image:url(${e.avatarImage});background-size:cover;background-position:center` : `background:${e.avatarColor}`}">${e.avatarImage ? '' : initials(e.nickname)}</span>${e.nickname}</td>
      <td>${e.role}</td>
      <td><span class="status-pill status-${e.status}" style="position:static;display:inline-flex"><span class="dot"></span>${e.status}</span></td>
      <td>${editorCountsCache[e.id] ?? 0}</td>
      <td>
        <div class="row-actions">
          <button data-edit-editor="${e.id}" aria-label="Edit">${svgEdit()}</button>
          <button data-delete-editor="${e.id}" class="danger" aria-label="Delete">${svgTrash()}</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="5" class="table-empty">${q ? 'No crews match your search.' : 'No editors yet. Add your first one above.'}</td></tr>`;

  tbody.querySelectorAll('[data-edit-editor]').forEach(b => b.addEventListener('click', () => openEditorForm(b.dataset.editEditor)));
  tbody.querySelectorAll('[data-delete-editor]').forEach(b => b.addEventListener('click', () => confirmDeleteEditor(b.dataset.deleteEditor)));
}

function wireEditorsSearch() {
  const input = document.getElementById('editors-search');
  if (!input) return;
  // live search — filters the already-loaded list, no re-fetch needed
  input.addEventListener('input', (e) => {
    editorsSearchQuery = e.target.value;
    renderEditorsRows();
  });
}

async function confirmDeleteEditor(id) {
  const editor = await EditorsAPI.get(id);
  if (!editor) return;
  ModalSystem.confirm({
    title: `Delete ${editor.nickname}?`,
    body: `This permanently removes ${editor.nickname}, their account access, and every portfolio project attached to them. This can't be undone.`,
    confirmLabel: 'Delete Editor',
    danger: true,
    onConfirm: async () => {
      try {
        await EditorsAPI.remove(id);
        closeEditorPanel();
        await refreshAll();
        ModalSystem.success({ title: 'Editor deleted', body: `${editor.nickname} has been removed.` });
      } catch (err) {
        ModalSystem.open({ title: 'Delete failed', body: '<p>Something went wrong. Please try again.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
      }
    },
  });
}

/* ---------- avatar upload + crop ---------- */

function openAvatarCropModal(srcDataUrl, onApply) {
  const SIZE = 260;
  const OUT = 320;

  const body = `
    <div class="crop-stage" id="crop-stage">
      <img id="crop-img" src="${srcDataUrl}" draggable="false" alt="" />
    </div>
    <div class="crop-zoom-row">
      <span>Zoom</span>
      <input type="range" id="crop-zoom" min="0" max="100" value="0" />
    </div>
  `;

  const overlay = ModalSystem.open({
    title: 'Edit Photo',
    body,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Apply', kind: 'primary', onClick: () => applyCrop() },
    ],
  });
  overlay.querySelector('.modal-card').classList.add('modal-crop');

  const stage = overlay.querySelector('#crop-stage');
  const img = overlay.querySelector('#crop-img');
  const zoomSlider = overlay.querySelector('#crop-zoom');

  let iw = 0, ih = 0, baseScale = 1, scale = 1, x = 0, y = 0;
  let dragging = false, startX = 0, startY = 0, startImgX = 0, startImgY = 0;

  function applyTransform() {
    img.style.width = (iw * scale) + 'px';
    img.style.height = (ih * scale) + 'px';
    img.style.transform = `translate(${x}px, ${y}px)`;
  }

  function clamp() {
    const dw = iw * scale, dh = ih * scale;
    const minX = Math.min(0, SIZE - dw);
    const minY = Math.min(0, SIZE - dh);
    x = Math.max(minX, Math.min(0, x));
    y = Math.max(minY, Math.min(0, y));
  }

  function setZoom(t) {
    scale = baseScale * (1 + t * 2); // up to 3x baseScale
    clamp();
    applyTransform();
  }

  function initImage() {
    iw = img.naturalWidth;
    ih = img.naturalHeight;
    baseScale = Math.max(SIZE / iw, SIZE / ih);
    scale = baseScale;
    x = (SIZE - iw * scale) / 2;
    y = (SIZE - ih * scale) / 2;
    applyTransform();
  }
  if (img.complete && img.naturalWidth) initImage();
  else img.onload = initImage;

  zoomSlider.addEventListener('input', () => setZoom(zoomSlider.value / 100));

  function pointerDown(e) {
    dragging = true;
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX; startY = p.clientY;
    startImgX = x; startImgY = y;
    e.preventDefault();
  }
  function pointerMove(e) {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    x = startImgX + (p.clientX - startX);
    y = startImgY + (p.clientY - startY);
    clamp();
    applyTransform();
  }
  function pointerUp() { dragging = false; }

  stage.addEventListener('mousedown', pointerDown);
  window.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  stage.addEventListener('touchstart', pointerDown, { passive: false });
  window.addEventListener('touchmove', pointerMove, { passive: false });
  window.addEventListener('touchend', pointerUp);

  function cleanup() {
    window.removeEventListener('mousemove', pointerMove);
    window.removeEventListener('mouseup', pointerUp);
    window.removeEventListener('touchmove', pointerMove);
    window.removeEventListener('touchend', pointerUp);
  }

  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cleanup(); });
  overlay.querySelector('.modal-close')?.addEventListener('click', cleanup);
  overlay.querySelectorAll('.modal-actions .btn').forEach(b => {
    if (b.textContent.trim() === 'Cancel') b.addEventListener('click', cleanup);
  });

  function applyCrop() {
    const canvas = document.createElement('canvas');
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    const srcX = -x / scale;
    const srcY = -y / scale;
    const srcSize = SIZE / scale;
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
    const outUrl = canvas.toDataURL('image/jpeg', 0.88);
    cleanup();
    onApply(outUrl);
  }
}

/* ---------- editor add/edit form (inline panel) ---------- */

function closeEditorPanel() {
  const panel = document.getElementById('editor-form-panel');
  if (!panel) return;
  panel.style.display = 'none';
  panel.innerHTML = '';
}

async function openEditorForm(editorId) {
  const editor = editorId ? await EditorsAPI.get(editorId) : null;
  const s = (editor && editor.socials) || {};
  const panel = document.getElementById('editor-form-panel');
  if (!panel) return;

  let currentAvatarImage = editor ? (editor.avatarImage || null) : null;
  // there's no color-picker field anymore (replaced by photo upload) —
  // keep the editor's existing avatarColor as the fallback circle color,
  // or fall back to the studio default for brand-new editors.
  const avatarColor = editor ? (editor.avatarColor || DEFAULT_AVATAR_COLOR) : DEFAULT_AVATAR_COLOR;

  panel.innerHTML = `
    <div class="panel-form-head">
      <h3>${editor ? `Edit ${editor.nickname}` : 'Add Editor'}</h3>
      <button type="button" class="panel-form-close" id="editor-form-close" aria-label="Close">${svgClose()}</button>
    </div>
    <form id="editor-form" class="form-grid">
      <div class="field full">
        <span>Avatar Photo</span>
        <div class="avatar-upload-row">
          <div class="avatar-upload-preview" id="avatar-preview" style="${currentAvatarImage ? `background-image:url(${currentAvatarImage});background-size:cover;background-position:center` : `background:${avatarColor}`}">
            ${currentAvatarImage ? '' : `<span id="avatar-preview-initials">${editor ? initials(editor.nickname) : '?'}</span>`}
            <button type="button" class="avatar-edit-btn" id="avatar-edit-btn" aria-label="Change photo">${svgEdit()}</button>
          </div>
          <div style="font-size:12px;color:var(--ink-faint);line-height:1.6">
            Upload your Photo.
            <br><button type="button" class="btn btn-ghost btn-sm" id="avatar-remove-btn" style="margin-top:8px;${currentAvatarImage ? '' : 'display:none'}">Remove Photo</button>
          </div>
        </div>
        <input type="file" id="avatar-file-input" accept="image/*" hidden />
      </div>
      <label class="field full"><span>Nickname</span><input required name="nickname" value="${editor ? editor.nickname : ''}" placeholder="e.g. Kiyo" /></label>
      <label class="field full"><span>Role</span>
        <select required name="role">
          <option value="" ${!editor || !editor.role ? 'selected' : ''} disabled>Select a role…</option>
          <option value="201Founder" ${editor && editor.role === '201Founder' ? 'selected' : ''}>201Founder</option>
          <option value="201Crew" ${editor && editor.role === '201Crew' ? 'selected' : ''}>201Crew</option>
          <option value="2vMember" ${editor && editor.role === '2vMember' ? 'selected' : ''}>2vMember</option>
        </select>
      </label>
      <label class="field full"><span>Bio</span><textarea name="bio" placeholder="Short bio shown on cards">${editor ? editor.bio : ''}</textarea></label>
      <label class="field full"><span>Experience</span><textarea name="experience" placeholder="Experience shown on profile">${editor ? editor.experience : ''}</textarea></label>
      <label class="field full"><span>Skills (comma separated)</span><input name="skills" value="${editor ? (editor.skills || []).join(', ') : ''}" placeholder="Color Grading, Sound Design" /></label>
      <label class="field full"><span>Software (comma separated)</span><input name="software" value="${editor ? (editor.software || []).join(', ') : ''}" placeholder="Premiere Pro, After Effects" /></label>
      <label class="field"><span>Commission Status</span>
        <select name="status">
          <option value="open" ${editor && editor.status === 'open' ? 'selected' : ''}>🟢 Open</option>
          <option value="busy" ${editor && editor.status === 'busy' ? 'selected' : ''}>🟡 Busy</option>
          <option value="closed" ${editor && editor.status === 'closed' ? 'selected' : ''}>🔴 Closed</option>
        </select>
      </label>
      
      <label class="field"><span>Facebook URL</span><input name="facebook" value="${s.facebook || ''}" placeholder="https://facebook.com/…" /></label>
      <label class="field"><span>Instagram URL</span><input name="instagram" value="${s.instagram || ''}" placeholder="https://instagram.com/…" /></label>
      <label class="field"><span>Discord URL</span><input name="discord" value="${s.discord || ''}" placeholder="https://discord.com/…" /></label>
      <label class="field"><span>TikTok URL</span><input name="tiktok" value="${s.tiktok || ''}" placeholder="https://tiktok.com/@…" /></label>
      <label class="field"><span>X (Twitter) URL</span><input name="x" value="${s.x || ''}" placeholder="https://x.com/…" /></label>
      <label class="field"><span>YouTube URL</span><input name="youtube" value="${s.youtube || ''}" placeholder="https://youtube.com/@…" /></label>
      <label class="field"><span>WhatsApp URL</span><input name="whatsapp" value="${s.whatsapp || ''}" placeholder="https://wa.me/…" /></label>
      <label class="field"><span>Payhip URL</span><input name="payhip" value="${s.payhip || ''}" placeholder="https://payhip.com/…" /></label>

      <div class="field full" style="border-top:1px solid var(--line);padding-top:20px;margin-top:6px">
        <span style="color:var(--ink);font-size:13px;text-transform:none;font-weight:700">Member Login Account</span>
        <p style="font-size:12px;color:var(--ink-faint);margin-top:4px;line-height:1.6">
          Lets ${editor ? editor.nickname : 'this editor'} sign in at member-login.html to manage their own profile and portfolio.
          ${editor ? 'Leave password blank to keep their current password.' : ''}
        </p>
      </div>
      <label class="field"><span>Username</span><input name="username" value="${editor ? (editor.username || '') : ''}" placeholder="e.g. kiyo" autocomplete="off" /></label>
      <label class="field"><span>${editor ? 'New Password (optional)' : 'Password'}</span><input type="password" name="password" placeholder="${editor ? 'Leave blank to keep current' : 'Set a password'}" autocomplete="new-password" /></label>
      <div class="field full" id="account-status-msg" style="font-size:12px;color:var(--ink-faint)"></div>
    </form>
    <div class="panel-form-actions">
      <button type="button" class="btn btn-ghost" id="editor-form-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="editor-form-save">${editor ? 'Save Changes' : 'Add Editor'}</button>
    </div>
  `;

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  function refreshAvatarPreview() {
    const preview = document.getElementById('avatar-preview');
    const removeBtn = document.getElementById('avatar-remove-btn');
    if (!preview) return;
    if (currentAvatarImage) {
      preview.style.background = `url(${currentAvatarImage}) center/cover`;
      const initSpan = preview.querySelector('#avatar-preview-initials');
      if (initSpan) initSpan.remove();
      if (removeBtn) removeBtn.style.display = '';
    } else {
      preview.style.background = avatarColor;
      let initSpan = preview.querySelector('#avatar-preview-initials');
      if (!initSpan) {
        initSpan = document.createElement('span');
        initSpan.id = 'avatar-preview-initials';
        preview.insertBefore(initSpan, preview.querySelector('.avatar-edit-btn'));
      }
      const nicknameInput = document.querySelector('#editor-form input[name="nickname"]');
      initSpan.textContent = initials(nicknameInput ? nicknameInput.value : (editor ? editor.nickname : '?'));
      if (removeBtn) removeBtn.style.display = 'none';
    }
  }

  document.getElementById('avatar-edit-btn').addEventListener('click', () => {
    document.getElementById('avatar-file-input').click();
  });
  document.getElementById('avatar-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      openAvatarCropModal(reader.result, (croppedDataUrl) => {
        currentAvatarImage = croppedDataUrl;
        refreshAvatarPreview();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
  document.getElementById('avatar-remove-btn')?.addEventListener('click', () => {
    currentAvatarImage = null;
    refreshAvatarPreview();
  });
  document.querySelector('#editor-form input[name="nickname"]')?.addEventListener('input', refreshAvatarPreview);

  document.getElementById('editor-form-close').addEventListener('click', closeEditorPanel);
  document.getElementById('editor-form-cancel').addEventListener('click', closeEditorPanel);

  document.getElementById('editor-form-save').addEventListener('click', async () => {
    const form = document.getElementById('editor-form');
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const statusMsg = document.getElementById('account-status-msg');
    statusMsg.textContent = '';

    const username = fd.get('username').trim();
    const newPassword = fd.get('password');

    // username uniqueness check (excluding this editor's own id when editing)
    if (username) {
      const clash = await EditorsAPI.findByUsername(username, editor ? editor.id : null);
      if (clash) {
        statusMsg.textContent = `That username is already taken by ${clash.nickname}.`;
        statusMsg.style.color = '#ff5470';
        return;
      }
    }

    // require a password when creating a fresh account with a username
    if (username && !newPassword && !editor) {
      statusMsg.textContent = 'Set a password for this new account.';
      statusMsg.style.color = '#ff5470';
      return;
    }

    const record = {
      id: editor ? editor.id : null,
      nickname: fd.get('nickname').trim(),
      role: fd.get('role').trim(),
      bio: fd.get('bio').trim(),
      experience: fd.get('experience').trim(),
      skills: fd.get('skills').split(',').map(s => s.trim()).filter(Boolean),
      software: fd.get('software').split(',').map(s => s.trim()).filter(Boolean),
      status: fd.get('status'),
      avatarColor: avatarColor,
      avatarImage: currentAvatarImage,
      banner: editor ? editor.banner : 'linear-gradient(120deg,#151515,#0b0b0b)',
      socials: {
        facebook: fd.get('facebook').trim(),
        instagram: fd.get('instagram').trim(),
        discord: fd.get('discord').trim(),
        tiktok: fd.get('tiktok').trim(),
        x: fd.get('x').trim(),
        youtube: fd.get('youtube').trim(),
        whatsapp: fd.get('whatsapp').trim(),
        payhip: fd.get('payhip').trim(),
      },
      username: username || (editor ? editor.username : ''),
    };

    const saveBtn = document.getElementById('editor-form-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const saved = await EditorsAPI.save(record);
      if (newPassword) {
        const { error: pwErr } = await sb.rpc('set_editor_password', { p_editor_id: saved.id, p_password: newPassword });
        if (pwErr) throw pwErr;
      }
      closeEditorPanel();
      await refreshAll();
      ModalSystem.success({ title: 'Saved', body: `${record.nickname} is live on the site.` });
    } catch (err) {
      ModalSystem.open({ title: 'Save failed', body: '<p>Something went wrong saving to the database. Please try again.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = editor ? 'Save Changes' : 'Add Editor';
    }
  });
}

/* ---------- portfolio: folder-style view (view + moderate only) ---------- */

let activePortfolioFolder = null; // editor id, 'unassigned', or null (showing the grid)

async function renderPortfolioTable() {
  if (activePortfolioFolder) {
    await renderPortfolioFolderDetail(activePortfolioFolder);
  } else {
    await renderPortfolioFolderGrid();
  }
}

let allPortfolioFolderEditors = [];
let allPortfolioFolderOrphaned = [];
let portfolioFolderCounts = {};
let portfolioSearchQuery = '';

async function renderPortfolioFolderGrid() {
  const grid = document.getElementById('portfolio-folder-grid');
  const detail = document.getElementById('portfolio-folder-detail');
  if (!grid || !detail) return;
  grid.style.display = 'grid';
  detail.style.display = 'none';
  PreviewPanel.close('admin-portfolio-preview-panel');

  grid.innerHTML = `<div class="admin-panel" style="grid-column:1/-1"><div class="table-empty">Loading…</div></div>`;

  const editors = await EditorsAPI.all();
  const allItems = await PortfolioAPI.all();
  const editorIds = new Set(editors.map(e => e.id));
  const orphaned = allItems.filter(p => !editorIds.has(p.editorId));

  allPortfolioFolderEditors = editors;
  allPortfolioFolderOrphaned = orphaned;

  if (!editors.length && !orphaned.length) {
    grid.innerHTML = `<div class="admin-panel" style="grid-column:1/-1"><div class="table-empty">No crews yet. Add one from the Crews tab first.</div></div>`;
    return;
  }

  const counts = await Promise.all(editors.map(e => PortfolioAPI.byEditor(e.id)));
  portfolioFolderCounts = Object.fromEntries(editors.map((e, i) => [e.id, counts[i].length]));

  renderPortfolioFolderGridRows();
}

function renderPortfolioFolderGridRows() {
  const grid = document.getElementById('portfolio-folder-grid');
  if (!grid) return;
  const q = portfolioSearchQuery.trim().toLowerCase();

  const editors = allPortfolioFolderEditors.filter(e => {
    if (!q) return true;
    return [e.nickname, e.role].join(' ').toLowerCase().includes(q);
  });
  const showOrphaned = allPortfolioFolderOrphaned.length > 0 && (!q || 'unassigned'.includes(q));

  if (!editors.length && !showOrphaned) {
    grid.innerHTML = `<div class="admin-panel" style="grid-column:1/-1"><div class="table-empty">No crews match your search.</div></div>`;
    return;
  }

  grid.innerHTML = editors.map(e => `
    <div class="portfolio-folder-card" data-open-folder="${e.id}">
      <div class="portfolio-folder-banner" style="background:${e.banner || 'linear-gradient(140deg,#151515,#0b0b0b)'}">
        <span class="status-pill status-${e.status}"><span class="dot"></span>${e.status}</span>
        <div class="portfolio-folder-avatar" style="${e.avatarImage ? `background-image:url(${e.avatarImage});background-size:cover;background-position:center` : `background:${e.avatarColor}`}">${e.avatarImage ? '' : initials(e.nickname)}</div>
      </div>
      <div class="portfolio-folder-body">
        <div class="portfolio-folder-name">${e.nickname}</div>
        <div class="portfolio-folder-role">${e.role}</div>
        <button class="btn btn-outline btn-sm" style="width:100%;margin-top:16px">Open Folder</button>
        <div class="portfolio-folder-count">${portfolioFolderCounts[e.id] || 0} project${(portfolioFolderCounts[e.id] || 0) === 1 ? '' : 's'} in portfolio</div>
      </div>
    </div>
  `).join('') + (showOrphaned ? `
    <div class="portfolio-folder-card" data-open-folder="unassigned">
      <div class="portfolio-folder-banner" style="background:linear-gradient(140deg,#2a2a2a,#0b0b0b)">
        <div class="portfolio-folder-avatar" style="background:#333">?</div>
      </div>
      <div class="portfolio-folder-body">
        <div class="portfolio-folder-name">Unassigned</div>
        <div class="portfolio-folder-role">No matching crew</div>
        <button class="btn btn-outline btn-sm" style="width:100%;margin-top:16px">Open Folder</button>
        <div class="portfolio-folder-count">${allPortfolioFolderOrphaned.length} project${allPortfolioFolderOrphaned.length === 1 ? '' : 's'} in portfolio</div>
      </div>
    </div>
  ` : '');

  grid.querySelectorAll('[data-open-folder]').forEach(el => {
    el.addEventListener('click', () => {
      activePortfolioFolder = el.dataset.openFolder;
      renderPortfolioTable();
    });
  });
}

function wirePortfolioSearch() {
  const input = document.getElementById('portfolio-search');
  if (!input) return;
  input.addEventListener('input', (e) => {
    portfolioSearchQuery = e.target.value;
    if (!activePortfolioFolder) renderPortfolioFolderGridRows();
  });
}

async function renderPortfolioFolderDetail(folderId) {
  const detail = document.getElementById('portfolio-folder-detail');
  const grid = document.getElementById('portfolio-folder-grid');
  if (!grid || !detail) return;
  grid.style.display = 'none';
  detail.style.display = 'block';
  detail.innerHTML = `<div class="admin-panel"><div class="table-empty">Loading…</div></div>`;

  const editors = await EditorsAPI.all();
  const editorIds = new Set(editors.map(e => e.id));
  let items, headName, headRole, headAvatarHtml, folderEditor = null;

  if (folderId === 'unassigned') {
    const allItems = await PortfolioAPI.all();
    items = allItems.filter(p => !editorIds.has(p.editorId));
    headName = 'Unassigned';
    headRole = 'No matching crew';
    headAvatarHtml = `<span class="admin-row-avatar" style="background:#333">?</span>`;
  } else {
    folderEditor = await EditorsAPI.get(folderId);
    if (!folderEditor) { activePortfolioFolder = null; renderPortfolioTable(); return; }
    items = await PortfolioAPI.byEditor(folderEditor.id);
    headName = folderEditor.nickname;
    headRole = folderEditor.role;
    headAvatarHtml = `<span class="admin-row-avatar" style="${folderEditor.avatarImage ? `background-image:url(${folderEditor.avatarImage});background-size:cover;background-position:center` : `background:${folderEditor.avatarColor}`}">${folderEditor.avatarImage ? '' : initials(folderEditor.nickname)}</span>`;
  }

  detail.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="portfolio-folder-back" style="margin-bottom:18px">${svgArrowLeft()} Back to folders</button>
    <div class="admin-panel" style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      ${headAvatarHtml}
      <div>
        <div style="font-size:16px;font-weight:700">${headName}</div>
        <div style="font-size:13px;color:var(--ink-faint)">${headRole} · ${items.length} project${items.length === 1 ? '' : 's'}</div>
      </div>
    </div>
    <div class="admin-portfolio-grid">
      ${items.length ? items.map(p => adminPortfolioCardHTML(p)).join('') : `<p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0">No projects here yet.</p>`}
    </div>
    <div class="inline-preview-panel inline-preview-embedded" id="admin-portfolio-preview-panel" style="display:none"></div>
  `;

  document.getElementById('portfolio-folder-back').addEventListener('click', () => {
    activePortfolioFolder = null;
    renderPortfolioTable();
  });
  detail.querySelectorAll('[data-preview-portfolio]').forEach(el => el.addEventListener('click', async () => {
  const item = await PortfolioAPI.get(el.dataset.previewPortfolio);
  if (!item) return;
  const itemEditor = folderEditor || await EditorsAPI.get(item.editorId);
  PreviewPanel.openModal(item, itemEditor, { showViewProfile: false });
}));
  detail.querySelectorAll('[data-delete-portfolio]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDeletePortfolio(b.dataset.deletePortfolio);
  }));
}

function adminPortfolioCardHTML(item) {
  const thumb = toDriveThumbnail(item.driveLink);
  const thumbStyle = thumb
    ? `background-image:url(${thumb});background-size:cover;background-position:center`
    : `background:linear-gradient(140deg,#1a1a1a,#0c0c0c)`;
  return `
    <div class="admin-portfolio-card" data-preview-portfolio="${item.id}">
      <div class="admin-portfolio-thumb" style="${thumbStyle}">
        <button class="admin-card-delete" data-delete-portfolio="${item.id}" aria-label="Delete">${svgTrash()}</button>
      </div>
      <div class="admin-portfolio-info">
        <div class="admin-portfolio-row">
          <span class="admin-portfolio-title">${item.title}</span>
          <span class="admin-portfolio-duration">${item.duration}</span>
        </div>
        <div class="admin-portfolio-row">
          <span class="cat-tag">${item.category}</span>
          ${item.featured ? '<span class="admin-portfolio-star">★</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

async function confirmDeletePortfolio(id) {
  const item = await PortfolioAPI.get(id);
  if (!item) return;
  ModalSystem.confirm({
    title: `Delete "${item.title}"?`,
    body: `This removes the project from the portfolio, featured works, and search. This can't be undone.`,
    confirmLabel: 'Delete Project',
    danger: true,
    onConfirm: async () => {
      try {
        await PortfolioAPI.remove(id);
        await refreshAll();
        ModalSystem.success({ title: 'Project deleted', body: `"${item.title}" has been removed.` });
      } catch (err) {
        ModalSystem.open({ title: 'Delete failed', body: '<p>Something went wrong. Please try again.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
      }
    },
  });
}

/* ---------- featured works table ---------- */

let allFeaturedCache = [];
let featuredEditorMap = {};
let featuredSearchQuery = '';

async function renderFeaturedTable() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  grid.innerHTML = `<p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0">Loading…</p>`;
  const items = await PortfolioAPI.all();
  const editors = await EditorsAPI.all();
  featuredEditorMap = Object.fromEntries(editors.map(e => [e.id, e]));
  allFeaturedCache = items;
  renderFeaturedRows();
}

function featuredCardHTML(item) {
  const editor = featuredEditorMap[item.editorId];
  const thumb = toDriveThumbnail(item.driveLink);
  const thumbStyle = thumb
    ? `background-image:url(${thumb});background-size:cover;background-position:center`
    : `background:linear-gradient(140deg,#1a1a1a,#0c0c0c)`;
  return `
    <div class="admin-portfolio-card">
      <div class="admin-portfolio-thumb" style="${thumbStyle}"></div>
      <div class="admin-portfolio-info">
        <div class="admin-portfolio-row">
          <span class="admin-portfolio-title">${item.title}</span>
          <span class="admin-portfolio-duration">${item.duration}</span>
        </div>
        <div class="admin-portfolio-row">
          <span class="cat-tag">${item.category}${editor ? ' · ' + editor.nickname : ''}</span>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink-dim);margin-top:12px;cursor:pointer">
          <input type="checkbox" data-toggle-featured="${item.id}" ${item.featured ? 'checked' : ''} />
          ${item.featured ? '★ Featured' : 'Not featured'}
        </label>
      </div>
    </div>
  `;
}

function renderFeaturedRows() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  const q = featuredSearchQuery.trim().toLowerCase();
  const filtered = allFeaturedCache.filter(p => {
    if (!q) return true;
    const editor = featuredEditorMap[p.editorId];
    const haystack = [p.title, editor ? editor.nickname : '', p.category].join(' ').toLowerCase();
    return haystack.includes(q);
  });

  grid.innerHTML = filtered.length
    ? filtered.map(p => featuredCardHTML(p)).join('')
    : `<p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0">${q ? 'No projects match your search.' : 'No portfolio projects yet.'}</p>`;

  grid.querySelectorAll('[data-toggle-featured]').forEach(cb => {
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', async () => {
      cb.disabled = true;
      const item = await PortfolioAPI.get(cb.dataset.toggleFeatured);
      if (!item) return;
      item.featured = cb.checked;
      try {
        await PortfolioAPI.save(item);
        await refreshAll();
      } catch (err) {
        cb.disabled = false;
        cb.checked = !cb.checked;
        ModalSystem.open({ title: 'Update failed', body: '<p>Something went wrong. Please try again.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
      }
    });
  });
}

function wireFeaturedSearch() {
  const input = document.getElementById('featured-search');
  if (!input) return;
  input.addEventListener('input', (e) => {
    featuredSearchQuery = e.target.value;
    renderFeaturedRows();
  });
}

/* ---------- form triggers ---------- */

function wireEditorForm() {
  document.getElementById('add-editor-btn')?.addEventListener('click', () => openEditorForm(null));
}

/* ---------- settings ---------- */

function wireSettings() {
  const form = document.getElementById('settings-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('current-password').value;
    const next = document.getElementById('new-password').value;
    const confirmPw = document.getElementById('confirm-password').value;

    const { data: currentOk, error: verifyErr } = await sb.rpc('verify_admin_password', { p_password: current });
    if (verifyErr || !currentOk) {
      ModalSystem.open({ title: 'Incorrect password', body: '<p>Your current password doesn\'t match.</p>', actions: [{ label: 'Try again', kind: 'primary' }] });
      return;
    }
    if (!next || next.length < 4) {
      ModalSystem.open({ title: 'Password too short', body: '<p>Choose a new password with at least 4 characters.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
      return;
    }
    if (next !== confirmPw) {
      ModalSystem.open({ title: "Passwords don't match", body: '<p>Double check the new password fields match.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
      return;
    }
    ModalSystem.confirm({
      title: 'Update admin password?',
      body: 'You will need this new password the next time you sign in.',
      confirmLabel: 'Save Changes',
      onConfirm: async () => {
        try {
          await SettingsAPI.save({ adminPassword: next });
          form.reset();
          ModalSystem.success({ title: 'Password updated', body: 'Your admin password has been changed.' });
        } catch (err) {
          ModalSystem.open({ title: 'Update failed', body: '<p>Something went wrong. Please try again.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
        }
      },
    });
  });
}
/* ---------- logout ---------- */

function wireLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    ModalSystem.confirm({
      title: 'Log out?',
      body: 'You\'ll need your admin password to sign back in.',
      confirmLabel: 'Log Out',
      onConfirm: () => {
        AdminSession.logout();
        window.location.href = 'login.html';
      },
    });
  });
}

/* ---------- icons ---------- */

function svgEdit() {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
}
function svgTrash() {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>`;
}
function svgClose() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
}
function svgArrowLeft() {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
}
function svgEye() {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
