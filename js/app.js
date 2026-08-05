/* ============================================================
   2vStudio — app.js
   Homepage behaviour: loading screen, nav, hero motion,
   editors grid + filters, featured reel, search, music player.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initLoadingScreen();
  initNav();
  initScrollProgress();
  initHeroMotion();
  initReveal();
  await initEditorsGrid();
  await initFeaturedReel();
  await initAboutStats();
  initSearch();
  initJoinSection();
  wireStaticButtons();
});

/* ---------- utils ---------- */

function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function statusLabel(status) {
  return { open: 'Open', busy: 'Busy', closed: 'Closed' }[status] || 'Open';
}

function openSocialConfirm(url, label) {
  if (!url) {
    ModalSystem.open({
      title: 'No link yet',
      body: `<p>This editor hasn't added a ${label || 'social'} link.</p>`,
      actions: [{ label: 'Got it', kind: 'primary' }],
    });
    return;
  }
  ModalSystem.open({
    title: 'Leaving 2vStudio',
    icon: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></svg>`,
    body: `<p>Commissions happen off-platform. You're about to open ${label || 'their social'} in a new tab.</p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Open Link', kind: 'primary', onClick: () => window.open(url, '_blank', 'noopener') },
    ],
  });
}

/* ---------- loading screen ---------- */

function initLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  const veil = document.getElementById('page-veil');
  if (!screen) return;
  const fill = screen.querySelector('.loader-bar-fill');
  const pct = screen.querySelector('.loader-pct');

  let progress = 0;
  const tick = () => {
    progress += Math.random() * 18 + 6;
    if (progress >= 100) progress = 100;
    if (fill) fill.style.width = progress + '%';
    if (pct) pct.textContent = Math.floor(progress) + '%';
    if (progress < 100) {
      setTimeout(tick, 120 + Math.random() * 120);
    } else {
      setTimeout(() => {
        screen.classList.add('hidden');
        document.body.classList.remove('nav-locked');
        document.querySelectorAll('.hero-title').forEach(t => t.classList.add('reveal-ready'));
      }, 260);
    }
  };
  document.body.classList.add('nav-locked');
  setTimeout(tick, 260);

  if (veil) setTimeout(() => veil.classList.add('veil-hidden'), 50);
}

/* ---------- nav ---------- */

function initNav() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = document.querySelector('.nav-burger');
  const sheet = document.querySelector('.nav-sheet');
  if (burger && sheet) {
    burger.addEventListener('click', () => {
      sheet.classList.toggle('open');
      document.body.classList.toggle('nav-locked', sheet.classList.contains('open'));
    });
    sheet.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      sheet.classList.remove('open');
      document.body.classList.remove('nav-locked');
    }));
  }

  // active link highlight by scroll position
  const sections = [...document.querySelectorAll('main [id]')];
  const links = [...document.querySelectorAll('.nav-links a')];
  if (sections.length && links.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + entry.target.id));
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    sections.forEach(s => io.observe(s));
  }
}

function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    bar.style.width = scrolled + '%';
  }, { passive: true });
}

/* ---------- hero motion ---------- */

function initHeroMotion() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // parallax blobs on mouse move
  const blobs = hero.querySelectorAll('.hero-blob');
  hero.addEventListener('mousemove', (e) => {
    const { innerWidth: w, innerHeight: h } = window;
    const x = (e.clientX / w - 0.5) * 2;
    const y = (e.clientY / h - 0.5) * 2;
    blobs.forEach((b, i) => {
      const strength = (i + 1) * 10;
      b.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
  });

  // floating particles
  const field = hero.querySelector('.hero-particles');
  if (field) {
    for (let i = 0; i < 36; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = 60 + Math.random() * 40 + '%';
      p.style.animation = `drift ${8 + Math.random() * 10}s ${Math.random() * 8}s linear infinite`;
      field.appendChild(p);
    }
  }
}

/* ---------- scroll reveal ---------- */

function initReveal() {
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-scale], [data-reveal-stagger]');
  if (!targets.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(t => io.observe(t));
}

async function initAboutStats() {
  const editorsEl = document.getElementById('about-stat-editors');
  const portfolioEl = document.getElementById('about-stat-portfolio');
  const disciplinesEl = document.getElementById('about-stat-disciplines');
  if (!editorsEl && !portfolioEl && !disciplinesEl) return;

  const [editors, portfolio] = await Promise.all([
    EditorsAPI.all(),
    PortfolioAPI.all(),
  ]);

  const disciplines = new Set(portfolio.map(p => p.category).filter(Boolean));

  if (editorsEl) editorsEl.textContent = editors.length;
  if (portfolioEl) portfolioEl.textContent = portfolio.length;
  if (disciplinesEl) disciplinesEl.textContent = disciplines.size;
}

/* ---------- editors grid ---------- */

let activeFilter = 'all';
let allEditorsCache = [];

function editorCardHTML(editor, portfolioCount) {
  const avatarBg = editor.avatarImage
    ? `background-image:url(${editor.avatarImage});background-size:cover;background-position:center`
    : `background:${editor.avatarColor}`;
  return `
    <article class="editor-card" data-reveal>
      <div class="editor-card-media" style="background:${editor.banner || 'linear-gradient(140deg,#151515,#0b0b0b)'}">
        <span class="status-pill status-${editor.status}"><span class="dot"></span>${statusLabel(editor.status)}</span>
        <div class="editor-avatar" style="${avatarBg}">${editor.avatarImage ? '' : initials(editor.nickname)}</div>
        <div class="editor-card-overlay"></div>
      </div>
      <div class="editor-card-body">
        <div class="nickname">${editor.nickname}</div>
        <div class="role">${editor.role}</div>
        <p class="bio">${editor.bio || ''}</p>
        <div class="editor-card-actions">
          <a class="btn btn-outline btn-sm" href="editor.html?id=${editor.id}">View Portfolio</a>
          <button class="btn btn-primary btn-sm" data-commission="${editor.id}">Commission</button>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--ink-faint)">${portfolioCount} project${portfolioCount === 1 ? '' : 's'} in portfolio</div>
      </div>
    </article>
  `;
}

async function initEditorsGrid() {
  const grid = document.getElementById('editors-grid');
  if (!grid) return;

  grid.innerHTML = `<p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0;">Loading editors…</p>`;
  allEditorsCache = await EditorsAPI.all();
  const counts = await Promise.all(allEditorsCache.map(e => PortfolioAPI.byEditor(e.id)));
  const countMap = Object.fromEntries(allEditorsCache.map((e, i) => [e.id, counts[i].length]));

  function render() {
    const editors = allEditorsCache.filter(e => activeFilter === 'all' || e.status === activeFilter);
    grid.innerHTML = editors.length
      ? editors.map(e => editorCardHTML(e, countMap[e.id] || 0)).join('')
      : `<p style="color:var(--ink-faint);grid-column:1/-1;text-align:center;padding:40px 0;">No editors match this filter yet.</p>`;
    initReveal();
    wireCommissionButtons(grid);
  }

  document.querySelectorAll('.filter-chip[data-status-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-status-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.statusFilter;
      render();
    });
  });

  render();
}

function wireCommissionButtons(scope) {
  scope.querySelectorAll('[data-commission]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const editor = allEditorsCache.find(ed => ed.id === btn.dataset.commission);
      if (!editor) return;
      showCommissionModal(editor);
    });
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
           ${entries.map(([k, v]) => `<button class="btn btn-outline btn-sm" data-open-social="${v}" style="justify-content:space-between;text-transform:capitalize">${k} ${svgArrow()}</button>`).join('')}
         </div>`
      : `<p>${editor.nickname} hasn't linked any socials yet.</p>`,
    actions: [{ label: 'Close', kind: 'ghost' }],
  });
  document.querySelectorAll('[data-open-social]').forEach(b => {
    b.addEventListener('click', () => window.open(b.dataset.openSocial, '_blank', 'noopener'));
  });
}

function svgArrow() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M7 7h10v10"/></svg>`;
}

/* ---------- featured works reel ---------- */

function reelCardHTML(item, editor) {
  const thumb = toDriveThumbnail(item.driveLink);
  const fallbackBg = editor ? editor.avatarColor : 'linear-gradient(140deg,#222,#111)';
  return `
    <div class="reel-card" data-preview="${item.id}" data-reveal-scale>
      <div class="reel-card-bg" style="background:${fallbackBg}" data-thumb-fallback></div>
      ${thumb ? `<img class="reel-card-thumb-img" src="${thumb}" alt="" loading="lazy" onerror="this.remove()" />` : ''}
      <div class="reel-card-shade"></div>
      <div class="reel-card-play">${svgPlay()}</div>
      <div class="reel-card-info">
        <div class="reel-card-cat">${item.category}</div>
        <div class="reel-card-title">${item.title}</div>
        <div class="reel-card-editor">by ${editor ? editor.nickname : 'Unknown'}</div>
      </div>
    </div>
  `;
}

function svgPlay() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
}

async function initFeaturedReel() {
  const track = document.getElementById('reel-track');
  if (!track) return;
  track.innerHTML = `<p style="color:var(--ink-faint)">Loading featured works…</p>`;

  const items = await PortfolioAPI.featured();
  const editors = await EditorsAPI.all();
  const editorMap = Object.fromEntries(editors.map(e => [e.id, e]));

  track.innerHTML = items.length
    ? items.map(item => reelCardHTML(item, editorMap[item.editorId])).join('')
    : `<p style="color:var(--ink-faint)">No featured works yet.</p>`;
  initReveal();

  // re-wire click-to-preview every time the reel is (re)rendered
  track.querySelectorAll('[data-preview]').forEach(card => {
    card.addEventListener('click', () => openPreviewModal(card.dataset.preview));
  });

  document.getElementById('reel-prev')?.addEventListener('click', () => track.scrollBy({ left: -360, behavior: 'smooth' }));
  document.getElementById('reel-next')?.addEventListener('click', () => track.scrollBy({ left: 360, behavior: 'smooth' }));

  initReelDrag(track);
}

function initReelDrag(track) {
  let isDown = false;
  let startX = 0;
  let scrollStart = 0;
  let moved = false;

  track.addEventListener('mousedown', (e) => {
    isDown = true;
    moved = false;
    track.classList.add('dragging');
    startX = e.pageX;
    scrollStart = track.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    isDown = false;
    track.classList.remove('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const dx = e.pageX - startX;
    if (Math.abs(dx) > 4) moved = true;
    track.scrollLeft = scrollStart - dx;
  });

  // if the user actually dragged, swallow the click during capture so it
  // never reaches the card's own click listener (which opens the preview) —
  // a plain click (no drag) is left alone and opens the preview as normal
  track.addEventListener('click', (e) => {
    if (moved) e.stopPropagation();
  }, true);
}

/* ---------- inline project preview ---------- */

async function openPreviewModal(portfolioId) {
  const item = await PortfolioAPI.get(portfolioId);
  if (!item) return;
  const editor = await EditorsAPI.get(item.editorId);
  PreviewPanel.openModal(item, editor);
}

/* ---------- search overlay ---------- */

function initSearch() {
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!overlay || !input) return;

  const openBtns = document.querySelectorAll('[data-open-search]');
  openBtns.forEach(b => b.addEventListener('click', () => {
    overlay.classList.add('open');
    document.body.classList.add('nav-locked');
    setTimeout(() => input.focus(), 250);
  }));

  document.getElementById('search-close')?.addEventListener('click', closeSearch);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeSearch(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); openBtns[0]?.click(); }
    if (e.key === 'Escape') closeSearch();
  });

  function closeSearch() {
    overlay.classList.remove('open');
    document.body.classList.remove('nav-locked');
  }

  let searchToken = 0;
  input.addEventListener('input', async () => {
    const token = ++searchToken;
    const q = input.value;
    if (!q.trim()) { results.innerHTML = ''; return; }

    const { editors, portfolio } = await SearchEngine.run(q);
    if (token !== searchToken) return; // stale response, a newer search superseded this one

    if (!editors.length && !portfolio.length) {
      results.innerHTML = `<div class="search-empty">No matches for "${q}"</div>`;
      return;
    }
    const editorMap = Object.fromEntries((await EditorsAPI.all()).map(e => [e.id, e]));
    results.innerHTML = `
      ${editors.length ? `<div class="search-group-label">Editors</div>${editors.map(e => `
        <a class="search-result-row" href="editor.html?id=${e.id}">
          <div class="search-result-avatar" style="${e.avatarImage ? `background-image:url(${e.avatarImage});background-size:cover;background-position:center` : `background:${e.avatarColor}`};border-radius:50%"></div>
          <div><div class="search-result-title">${e.nickname}</div><div class="search-result-sub">${e.role}</div></div>
        </a>`).join('')}` : ''}
      ${portfolio.length ? `<div class="search-group-label">Portfolio</div>${portfolio.map(p => `
        <div class="search-result-row" data-preview="${p.id}" style="cursor:pointer">
          <div class="search-result-thumb" style="background:${(editorMap[p.editorId] || {}).avatarColor || '#222'}"></div>
          <div><div class="search-result-title">${p.title}</div><div class="search-result-sub">${p.category} · ${p.software}</div></div>
        </div>`).join('')}` : ''}
    `;
    results.querySelectorAll('[data-preview]').forEach(row => row.addEventListener('click', () => {
      closeSearch();
      openPreviewModal(row.dataset.preview);
    }));
  });
}

/* ---------- join section ---------- */

function initJoinSection() {
  document.getElementById('join-btn')?.addEventListener('click', () => {
    ModalSystem.open({
      title: 'Join 2vStudio',
      body: `<p>Think your editing stands out? Apply now, submit your best edit, and show us what you're capable of.</p>`,
      actions: [
        { label: 'Maybe later', kind: 'ghost' },
        { label: 'Apply 2vStudio', kind: 'primary', onClick: () => window.open('https://discord.com/invite/yjt2PjRez6', '_blank', 'noopener') },
      ],
    });
  });
}

/* ---------- static buttons (ripple, hero ctas) ---------- */

function wireStaticButtons() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.classList.add('ripple');
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const dot = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      dot.className = 'ripple-dot';
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (e.clientX - rect.left - size / 2) + 'px';
      dot.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(dot);
      setTimeout(() => dot.remove(), 620);
    });
  });
}