/* ============================================================
   2vStudio — member.js
   Member dashboard. Each member can only view/edit their own
   editor profile and their own portfolio items.
   Guarded by MemberSession (storage.js).
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  if (!MemberSession.isLoggedIn()) {
    window.location.href = 'member-login.html';
    return;
  }
  const editor = await EditorsAPI.get(MemberSession.currentEditorId());
  if (!editor) {
    MemberSession.logout();
    window.location.href = 'member-login.html';
    return;
  }

  initSidebar(editor);
  await renderProfilePanel(editor);
  await renderPortfolioTable(editor);
  wirePortfolioAdd(editor);
  wireLogout();
});

function initials(name) { return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

async function currentEditor() { return EditorsAPI.get(MemberSession.currentEditorId()); }

/* ---------- password show/hide toggle (reusable) ---------- */

function wirePasswordToggles(scope) {
  scope.querySelectorAll('[data-toggle-password]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = isHidden
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });
}

/* ---------- sidebar / view switching ---------- */

function initSidebar(editor) {
  const buttons = document.querySelectorAll('.admin-nav button');
  const views = document.querySelectorAll('.admin-view');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      document.querySelector('.admin-sidebar')?.classList.remove('open');
    });
  });
  document.getElementById('admin-mobile-toggle')?.addEventListener('click', () => {
    document.querySelector('.admin-sidebar').classList.toggle('open');
  });
  const welcome = document.getElementById('member-welcome');
  if (welcome && editor) welcome.textContent = `Welcome, ${editor.nickname}`;
}

/* ---------- avatar upload + crop (same behavior as admin) ---------- */

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
    scale = baseScale * (1 + t * 2);
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

/* ---------- profile form (own account only, id locked) ---------- */

async function renderProfilePanel(editor) {
  const s = editor.socials || {};
  const panel = document.getElementById('member-profile-panel');
  if (!panel || !editor) return;

  let currentAvatarImage = editor.avatarImage || null;

  panel.innerHTML = `
    <form id="member-profile-form" class="form-grid">
      <div class="field full">
        <span>Avatar Photo</span>
        <div class="avatar-upload-row">
          <div class="avatar-upload-preview" id="avatar-preview" style="${currentAvatarImage ? `background-image:url(${currentAvatarImage});background-size:cover;background-position:center` : `background:${editor.avatarColor}`}">
            ${currentAvatarImage ? '' : `<span id="avatar-preview-initials">${initials(editor.nickname)}</span>`}
            <button type="button" class="avatar-edit-btn" id="avatar-edit-btn" aria-label="Change photo">${svgEdit()}</button>
          </div>
          <div style="font-size:12px;color:var(--ink-faint);line-height:1.6">
            Upload your Photo.
            <br><button type="button" class="btn btn-ghost btn-sm" id="avatar-remove-btn" style="margin-top:8px;${currentAvatarImage ? '' : 'display:none'}">Remove Photo</button>
          </div>
        </div>
        <input type="file" id="avatar-file-input" accept="image/*" hidden />
      </div>
      <label class="field full"><span>Nickname</span><input required name="nickname" value="${editor.nickname}" /></label>
      <label class="field full"><span>Role</span>
        <select required name="role">
          <option value="" ${!editor.role ? 'selected' : ''} disabled>Select a role…</option>
          <option value="201Founder" ${editor && editor.role === '201Founder' ? 'selected' : ''}>201Founder</option>
          <option value="201Crew" ${editor.role === '201Crew' ? 'selected' : ''}>201Crew</option>
          <option value="2vMember" ${editor.role === '2vMember' ? 'selected' : ''}>2vMember</option>
        </select>
      </label>
      <label class="field full"><span>Bio</span><textarea name="bio">${editor.bio || ''}</textarea></label>
      <label class="field full"><span>Experience</span><textarea name="experience">${editor.experience || ''}</textarea></label>
      <label class="field full"><span>Skills (comma separated)</span><input name="skills" value="${(editor.skills || []).join(', ')}" /></label>
      <label class="field full"><span>Software (comma separated)</span><input name="software" value="${(editor.software || []).join(', ')}" /></label>
      <label class="field"><span>Commission Status</span>
        <select name="status">
          <option value="open" ${editor.status === 'open' ? 'selected' : ''}>🟢 Open</option>
          <option value="busy" ${editor.status === 'busy' ? 'selected' : ''}>🟡 Busy</option>
          <option value="closed" ${editor.status === 'closed' ? 'selected' : ''}>🔴 Closed</option>
        </select>
      </label>

      <label class="field"><span>Facebook URL</span><input name="facebook" value="${s.facebook || ''}" /></label>
      <label class="field"><span>Instagram URL</span><input name="instagram" value="${s.instagram || ''}" /></label>
      <label class="field"><span>Discord URL</span><input name="discord" value="${s.discord || ''}" /></label>
      <label class="field"><span>TikTok URL</span><input name="tiktok" value="${s.tiktok || ''}" /></label>
      <label class="field"><span>X (Twitter) URL</span><input name="x" value="${s.x || ''}" /></label>
      <label class="field"><span>YouTube URL</span><input name="youtube" value="${s.youtube || ''}" /></label>
      <label class="field"><span>WhatsApp URL</span><input name="whatsapp" value="${s.whatsapp || ''}" /></label>
      <label class="field"><span>Payhip URL</span><input name="payhip" value="${s.payhip || ''}" /></label>
    </form>
    <div class="panel-form-actions">
      <button type="button" class="btn btn-primary" id="member-profile-save">Save Changes</button>
    </div>

    <div style="border-top:1px solid var(--line);margin:28px 0 22px"></div>
    <h3 style="font-size:15px;font-weight:700;margin-bottom:16px">Change Password</h3>
    <form id="member-password-form" class="form-grid">
      <label class="field"><span>New password</span>
        <div class="password-field-wrap">
          <input type="password" id="member-new-password" />
          <button type="button" class="password-toggle-btn" data-toggle-password="member-new-password" aria-label="Show password">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </label>
      <label class="field"><span>Confirm new password</span>
        <div class="password-field-wrap">
          <input type="password" id="member-confirm-password" />
          <button type="button" class="password-toggle-btn" data-toggle-password="member-confirm-password" aria-label="Show password">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </label>
    </form>
    <div class="panel-form-actions">
      <button type="button" class="btn btn-outline" id="member-password-save">Update Password</button>
    </div>
  `;

  // wire up the eye-icon show/hide toggles for the two password fields above
  wirePasswordToggles(panel);

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
      const colorSelect = document.querySelector('#member-profile-form select[name="avatarColor"]');
      preview.style.background = colorSelect ? colorSelect.value : editor.avatarColor;
      let initSpan = preview.querySelector('#avatar-preview-initials');
      if (!initSpan) {
        initSpan = document.createElement('span');
        initSpan.id = 'avatar-preview-initials';
        preview.insertBefore(initSpan, preview.querySelector('.avatar-edit-btn'));
      }
      const nicknameInput = document.querySelector('#member-profile-form input[name="nickname"]');
      initSpan.textContent = initials(nicknameInput ? nicknameInput.value : editor.nickname);
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
  document.querySelector('#member-profile-form select[name="avatarColor"]')?.addEventListener('change', refreshAvatarPreview);
  document.querySelector('#member-profile-form input[name="nickname"]')?.addEventListener('input', refreshAvatarPreview);

  // ---- Save profile fields (no password touched here anymore) ----
  document.getElementById('member-profile-save').addEventListener('click', async () => {
    const form = document.getElementById('member-profile-form');
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const record = {
      id: editor.id,
      username: editor.username,
      nickname: fd.get('nickname').trim(),
      role: fd.get('role').trim(),
      bio: fd.get('bio').trim(),
      experience: fd.get('experience').trim(),
      skills: fd.get('skills').split(',').map(s => s.trim()).filter(Boolean),
      software: fd.get('software').split(',').map(s => s.trim()).filter(Boolean),
      status: fd.get('status'),
      avatarColor: editor.avatarColor,
      avatarImage: currentAvatarImage,
      banner: editor.banner,
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
    };
    const saveBtn = document.getElementById('member-profile-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const saved = await EditorsAPI.save(record);
      Object.assign(editor, saved);
      initSidebar(editor);
      ModalSystem.success({ title: 'Saved', body: 'Your profile has been updated.' });
    } catch (err) {
      ModalSystem.open({ title: 'Save failed', body: `<p>Something went wrong saving to the database. Please try again.</p>`, actions: [{ label: 'Got it', kind: 'primary' }] });
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });

  // ---- Change password — goes through the set_editor_password RPC,
  // never touches the password column directly from the client ----
  document.getElementById('member-password-save').addEventListener('click', async () => {
    const next = document.getElementById('member-new-password').value;
    const confirmPw = document.getElementById('member-confirm-password').value;
    if (!next || next.length < 4) {
      ModalSystem.open({ title: 'Password too short', body: '<p>Choose a password with at least 4 characters.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
      return;
    }
    if (next !== confirmPw) {
      ModalSystem.open({ title: "Passwords don't match", body: '<p>Double check both fields match.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
      return;
    }
    const saveBtn = document.getElementById('member-password-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const { error } = await sb.rpc('set_editor_password', { p_editor_id: editor.id, p_password: next });
      if (error) throw error;
      document.getElementById('member-new-password').value = '';
      document.getElementById('member-confirm-password').value = '';
      ModalSystem.success({ title: 'Password updated', body: 'Use your new password next time you sign in.' });
    } catch (err) {
      console.error('set_editor_password failed', err);
      ModalSystem.open({ title: 'Update failed', body: '<p>Something went wrong. Please try again.</p>', actions: [{ label: 'Got it', kind: 'primary' }] });
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Update Password';
    }
  });
}

/* ---------- own portfolio ---------- */

const CATEGORIES = ['Video Editing', 'Motion Graphics', 'Graphic Design', 'VFX', 'Music', 'AMV', 'GMV', 'Thumbnail Design'];

async function renderPortfolioTable(editor) {
  const tbody = document.getElementById('member-portfolio-tbody');
  tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Loading…</td></tr>`;
  const items = await PortfolioAPI.byEditor(editor.id);
  tbody.innerHTML = items.length ? items.map(p => `
    <tr>
      <td>${p.title}</td>
      <td>${p.category}</td>
      <td>${p.featured ? '★ Featured' : '—'}</td>
      <td>
        <div class="row-actions">
          <button data-edit-portfolio="${p.id}" aria-label="Edit">${svgEdit()}</button>
          <button data-delete-portfolio="${p.id}" class="danger" aria-label="Delete">${svgTrash()}</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="4" class="table-empty">No projects yet. Upload your first one above.</td></tr>`;

  tbody.querySelectorAll('[data-edit-portfolio]').forEach(b => b.addEventListener('click', () => openPortfolioForm(editor, b.dataset.editPortfolio)));
  tbody.querySelectorAll('[data-delete-portfolio]').forEach(b => b.addEventListener('click', () => confirmDeletePortfolio(editor, b.dataset.deletePortfolio)));
}

async function confirmDeletePortfolio(editor, id) {
  const item = await PortfolioAPI.get(id);
  if (!item || item.editorId !== editor.id) return;
  ModalSystem.confirm({
    title: `Delete "${item.title}"?`,
    body: `This removes the project from your portfolio, featured works, and search. This can't be undone.`,
    confirmLabel: 'Delete Project',
    danger: true,
    onConfirm: async () => {
      await PortfolioAPI.remove(id);
      closePortfolioPanel();
      await renderPortfolioTable(editor);
      ModalSystem.success({ title: 'Project deleted', body: `"${item.title}" has been removed.` });
    },
  });
}

function closePortfolioPanel() {
  const panel = document.getElementById('member-portfolio-form-panel');
  if (!panel) return;
  panel.style.display = 'none';
  panel.innerHTML = '';
}

async function openPortfolioForm(editor, portfolioId) {
  const item = portfolioId ? await PortfolioAPI.get(portfolioId) : null;
  if (item && item.editorId !== editor.id) return; // guard: can't touch someone else's item
  const panel = document.getElementById('member-portfolio-form-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="panel-form-head">
      <h3>${item ? `Edit "${item.title}"` : 'Upload Portfolio Project'}</h3>
      <button type="button" class="panel-form-close" id="member-portfolio-form-close" aria-label="Close">${svgClose()}</button>
    </div>
    <form id="member-portfolio-form" class="form-grid">
      <label class="field full"><span>Title</span><input required name="title" value="${item ? item.title : ''}" placeholder="Title of your Edit"/></label>
      <label class="field"><span>Category</span>
        <select name="category">${CATEGORIES.map(c => `<option ${item && item.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </label>
      <label class="field"><span>Software</span><input name="software" value="${item ? item.software : ''}" placeholder="e.g. Premiere Pro" /></label>
      <label class="field"><span>Duration</span><input name="duration" value="${item ? item.duration : ''}" placeholder="e.g. 2:14" /></label>
      <label class="field full"><span>Google Drive Video Link</span><input name="driveLink" value="${item ? item.driveLink : ''}" placeholder="https://drive.google.com/file/d/FILE_ID/view" /></label>
      <div class="field full" id="member-drive-link-status" style="font-size:12px;color:var(--ink-faint)"></div>
      <label class="field full"><span>Description</span><textarea name="description" placeholder="What is this project?">${item ? item.description : ''}</textarea></label>
    </form>
    <div class="panel-form-actions">
      <button type="button" class="btn btn-ghost" id="member-portfolio-form-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="member-portfolio-form-save">${item ? 'Save Changes' : 'Upload'}</button>
    </div>
  `;

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('member-portfolio-form-close').addEventListener('click', closePortfolioPanel);
  document.getElementById('member-portfolio-form-cancel').addEventListener('click', closePortfolioPanel);

  document.getElementById('member-portfolio-form-save').addEventListener('click', async () => {
    const form = document.getElementById('member-portfolio-form');
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const driveLink = fd.get('driveLink').trim();
    if (driveLink && !isValidDriveLink(driveLink)) {
      document.getElementById('member-drive-link-status').textContent = 'That doesn\'t look like a valid Google Drive file link.';
      document.getElementById('member-drive-link-status').style.color = '#ff5470';
      return;
    }
    const record = {
      id: item ? item.id : null,
      title: fd.get('title').trim(),
      editorId: editor.id,
      category: fd.get('category'),
      software: fd.get('software').trim(),
      duration: fd.get('duration').trim() || '—',
      driveLink,
      description: fd.get('description').trim(),
      featured: item ? item.featured : false,
      date: item ? item.date : new Date().toISOString().slice(0, 10),
    };
    const saveBtn = document.getElementById('member-portfolio-form-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      await PortfolioAPI.save(record);
      closePortfolioPanel();
      await renderPortfolioTable(editor);
      ModalSystem.success({ title: item ? 'Saved' : 'Upload complete', body: `"${record.title}" is now visible in your portfolio${record.featured ? ', featured works,' : ''} and search.` });
    } catch (err) {
      ModalSystem.open({ title: 'Save failed', body: `<p>Something went wrong saving to the database. Please try again.</p>`, actions: [{ label: 'Got it', kind: 'primary' }] });
    }
  });
}

function wirePortfolioAdd(editor) {
  document.getElementById('member-add-portfolio-btn')?.addEventListener('click', () => openPortfolioForm(editor, null));
}

/* ---------- logout ---------- */

function wireLogout() {
  document.getElementById('member-logout-btn')?.addEventListener('click', () => {
    ModalSystem.confirm({
      title: 'Log out?',
      body: 'You\'ll need your username and password to sign back in.',
      confirmLabel: 'Log Out',
      onConfirm: () => {
        MemberSession.logout();
        window.location.href = 'member-login.html';
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
