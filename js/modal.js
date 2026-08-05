/* ============================================================
   2vStudio — modal.js
   Premium glassmorphism modal system. Replaces every native
   confirm()/alert(). All modals route through ModalSystem.
   ============================================================ */

const ModalSystem = (() => {
  let root = null;
  let activeModal = null;
  let lastFocused = null;

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'modal-root';
    document.body.appendChild(root);
    return root;
  }

  function trapKeydown(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab' && activeModal) {
      const focusables = activeModal.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function open({ icon = '', title = '', body = '', actions = [], variant = 'default' } = {}) {
    ensureRoot();
    close(true);
    lastFocused = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const card = document.createElement('div');
    card.className = `modal-card modal-${variant}`;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    card.innerHTML = `
      <button class="modal-close" aria-label="Close">${iconClose()}</button>
      ${icon ? `<div class="modal-icon">${icon}</div>` : ''}
      ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
      ${body ? `<div class="modal-body">${body}</div>` : ''}
      <div class="modal-actions"></div>
    `;

    const actionsWrap = card.querySelector('.modal-actions');
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.kind === 'danger' ? 'btn-danger' : a.kind === 'ghost' ? 'btn-ghost' : 'btn-primary'}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        if (a.onClick) a.onClick();
        if (a.closeOnClick !== false) close();
      });
      actionsWrap.appendChild(btn);
    });

    card.querySelector('.modal-close').addEventListener('click', () => close());
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

    overlay.appendChild(card);
    root.appendChild(overlay);
    document.addEventListener('keydown', trapKeydown);
    document.body.classList.add('modal-open');

    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    activeModal = overlay;
    const firstFocusable = card.querySelector('.btn-primary') || card.querySelector('button');
    if (firstFocusable) firstFocusable.focus();

    return overlay;
  }

  function close(skipRestore) {
    if (!activeModal) return;
    const el = activeModal;
    el.classList.remove('is-visible');
    document.removeEventListener('keydown', trapKeydown);
    document.body.classList.remove('modal-open');
    setTimeout(() => el.remove(), 280);
    activeModal = null;
    if (!skipRestore && lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function iconClose() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  }

  /* ---- convenience presets ---- */

  function confirm({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm }) {
    open({
      title,
      body: `<p>${body}</p>`,
      variant: danger ? 'danger' : 'default',
      icon: danger ? iconWarn() : iconAsk(),
      actions: [
        { label: cancelLabel, kind: 'ghost' },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: onConfirm },
      ],
    });
  }

  function success({ title, body, closeLabel = 'Done' }) {
    open({
      title,
      body: `<p>${body}</p>`,
      icon: iconCheck(),
      variant: 'success',
      actions: [{ label: closeLabel, kind: 'primary' }],
    });
  }

  function iconWarn() {
    return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/></svg>`;
  }
  function iconAsk() {
    return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5M12 17h.01"/></svg>`;
  }
  function iconCheck() {
    return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>`;
  }

  return { open, close, confirm, success };
})();
