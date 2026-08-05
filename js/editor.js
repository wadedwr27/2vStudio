/* ============================================================
   2vStudio — editor.js
   Renders a single editor's profile page from the URL ?id=
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initNavBasic();
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const veil = document.getElementById('page-veil');
  if (veil) setTimeout(() => veil.classList.add('veil-out'), 60);

  if (!id) {
    renderNotFound();
    return;
  }

  const editor = await EditorsAPI.get(id);

  if (!editor) {
    renderNotFound();
    return;
  }
  await renderEditor(editor);
});

function initNavBasic() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  const burger = document.querySelector('.nav-burger');
  const sheet = document.querySelector('.nav-sheet');
  burger?.addEventListener('click', () => sheet?.classList.toggle('open'));
  sheet?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => sheet.classList.remove('open')));
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function statusLabel(status) { return { open: 'Open for work', busy: 'Currently busy', closed: 'Not taking work' }[status] || 'Open'; }

function renderNotFound() {
  document.getElementById('editor-root').innerHTML = `
    <div class="editor-not-found">
      <h2 class="section-title" style="font-size:36px">Editor not found</h2>
      <p style="color:var(--ink-dim)">This profile doesn't exist or may have been removed.</p>
      <a href="index.html#editors" class="btn btn-primary">Back to Editors</a>
    </div>
  `;
}

const SOCIAL_META = {
  facebook: { label: 'Facebook', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>' },
  instagram: { label: 'Instagram', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>' },
  discord: { label: 'Discord', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="7" width="16" height="11" rx="4"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></svg>' },
  tiktok: { label: 'TikTok', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3v11.5a3.5 3.5 0 1 1-3.5-3.5M15 3c0 2.5 2 4.5 4.5 4.5"/></svg>' },
  x: { label: 'X', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l16 16M20 4 4 20"/></svg>' },
  youtube: { label: 'YouTube', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5Z" fill="currentColor" stroke="none"/></svg>' },
  whatsapp: { label: 'WhatsApp', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.3A9 9 0 1 0 12 3Z"/><path d="M8.5 8.5c.3 2.9 2.6 5.2 5.5 5.5" stroke-linecap="round"/></svg>' },
  payhip: { label: 'Payhip', icon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>' },
};

async function renderEditor(editor) {
  document.title = `${editor.nickname} — 2vStudio`;
  const root = document.getElementById('editor-root');
  const socials = editor.socials || {};
  const avatarBg = editor.avatarImage
    ? `background-image:url(${editor.avatarImage});background-size:cover;background-position:center`
    : `background:${editor.avatarColor}`;

  root.innerHTML = `
    <section class="editor-hero">
      <div class="editor-hero-banner" style="background:${editor.banner}"></div>
      <div class="container editor-hero-info">
        <div class="editor-hero-avatar" style="${avatarBg}">${editor.avatarImage ? '' : initials(editor.nickname)}</div>
        <div class="editor-hero-text">
          <div class="nickname">${editor.nickname}</div>
          <div class="role">${editor.role} · <span class="status-pill status-${editor.status}" style="position:static;display:inline-flex;margin-left:4px"><span class="dot"></span>${statusLabel(editor.status)}</span></div>
        </div>
        <div class="editor-hero-actions">
          <button class="btn btn-primary" id="commission-btn">Commission ${editor.nickname}</button>
          <a href="index.html#editors" class="btn btn-outline">All Editors</a>
        </div>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container editor-body-grid">
        <aside class="editor-sidebar" data-reveal>
          <div class="side-card">
            <h4>About</h4>
            <p>${editor.bio || ''}</p>
          </div>
          <div class="side-card">
            <h4>Experience</h4>
            <p>${editor.experience || 'No experience info yet.'}</p>
          </div>
          <div class="side-card">
            <h4>Skills</h4>
            <div class="tag-list">${(editor.skills || []).map(s => `<span class="tag">${s}</span>`).join('') || '<span class="tag">—</span>'}</div>
          </div>
          <div class="side-card">
            <h4>Software</h4>
            <div class="tag-list">${(editor.software || []).map(s => `<span class="tag">${s}</span>`).join('') || '<span class="tag">—</span>'}</div>
          </div>
          <div class="side-card">
            <h4>Social Links</h4>
            <div class="social-grid">
              ${Object.keys(SOCIAL_META).map(k => `
                <button class="social-btn ${socials[k] ? '' : 'disabled'}" data-social="${socials[k] || ''}" data-label="${SOCIAL_META[k].label}">
                  ${SOCIAL_META[k].icon}${SOCIAL_META[k].label}
                </button>
              `).join('')}
            </div>
          </div>
        </aside>

        <div>
          <div class="portfolio-toolbar" data-reveal>
            <div>
              <span class="eyebrow">Portfolio</span>
              <h2 class="section-title" style="font-size:clamp(26px,3vw,36px)">${editor.nickname}'s work</h2>
            </div>
            <div class="filter-bar" id="portfolio-filters" style="margin-bottom:0"></div>
          </div>
          <div class="portfolio-grid" id="editor-portfolio-grid">
            <p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0">Loading portfolio…</p>
          </div>
          <div class="inline-preview-panel inline-preview-embedded" id="editor-preview-panel" style="display:none"></div>
        </div>
      </div>
    </section>
  `;

  await wireEditorPage(editor);
  initRevealLocal();
}

function initRevealLocal() {
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-scale]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  targets.forEach(t => io.observe(t));
}

async function wireEditorPage(editor) {
  document.getElementById('commission-btn')?.addEventListener('click', () => showCommissionModal(editor));
  document.querySelectorAll('.social-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => openSocialConfirm(btn.dataset.social, btn.dataset.label));
  });

  const items = await PortfolioAPI.byEditor(editor.id);
  const categories = ['all', ...new Set(items.map(i => i.category))];
  const filterBar = document.getElementById('portfolio-filters');
  filterBar.innerHTML = categories.map(c => `<button class="filter-chip ${c === 'all' ? 'active' : ''}" data-cat="${c}">${c === 'all' ? 'All' : c}</button>`).join('');

  function renderGrid(cat) {
    const grid = document.getElementById('editor-portfolio-grid');
    PreviewPanel.close('editor-preview-panel');
    const filtered = cat === 'all' ? items : items.filter(i => i.category === cat);
    grid.innerHTML = filtered.length
      ? filtered.map(item => portfolioCardHTML(item, editor)).join('')
      : `<p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0">No projects in this category yet.</p>`;
    grid.querySelectorAll('[data-preview]').forEach(card => card.addEventListener('click', () => openPreviewModal(card.dataset.preview, editor)));
  }

  filterBar.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderGrid(chip.dataset.cat);
    });
  });

  renderGrid('all');
}

function portfolioCardHTML(item, editor) {
  const thumb = toDriveThumbnail(item.driveLink);
  const fallbackBg = editor && editor.avatarColor ? editor.avatarColor : 'linear-gradient(140deg,#1a1a1a,#0c0c0c)';
  const thumbStyle = thumb
    ? `background-image:url(${thumb});background-size:cover;background-position:center`
    : `background:${fallbackBg}`;
  return `
    <div class="portfolio-card" data-preview="${item.id}">
      <div class="portfolio-thumb">
        <div class="portfolio-thumb-bg" style="${thumbStyle}"></div>
        <div class="portfolio-thumb-overlay"><span class="preview-btn">Preview</span></div>
      </div>
      <div class="portfolio-info">
        <div class="title">${item.title}</div>
        <div class="meta"><span class="cat-tag">${item.category}</span><span>${item.duration}</span></div>
      </div>
    </div>
  `;
}

function openSocialConfirm(url, label) {
  if (!url) return;
  ModalSystem.open({
    title: 'Leaving 2vStudio',
    icon: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>`,
    body: `<p>Commissions happen off-platform. You're about to open ${label} in a new tab.</p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Open Link', kind: 'primary', onClick: () => window.open(url, '_blank', 'noopener') },
    ],
  });
}

function showCommissionModal(editor) {
  const socials = editor.socials || {};
  const entries = Object.entries(socials).filter(([, v]) => v);
  ModalSystem.open({
    title: `Commission ${editor.nickname}`,
    body: entries.length
      ? `<p>Commissions happen off-platform. Pick where you'd like to reach out:</p>
         <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">
           ${entries.map(([k, v]) => `<button class="btn btn-outline btn-sm" data-open-social="${v}" style="justify-content:space-between;text-transform:capitalize">${k}</button>`).join('')}
         </div>`
      : `<p>${editor.nickname} hasn't linked any socials yet.</p>`,
    actions: [{ label: 'Close', kind: 'ghost' }],
  });
  document.querySelectorAll('[data-open-social]').forEach(b => b.addEventListener('click', () => window.open(b.dataset.openSocial, '_blank', 'noopener')));
}

function openPreviewModal(portfolioId, editor) {
  PortfolioAPI.get(portfolioId).then(item => {
    if (!item) return;
    PreviewPanel.openModal(item, editor);
  });
}