/* ============================================================
   2vStudio — preview-panel.js
   Inline (non-modal) project preview panel. Shared by the
   homepage (app.js) and editor profile page (editor.js).
   Supports a custom targetId so the panel can render wherever
   it makes sense on the page (top of page, or right below a grid).
   Requires: js/storage.js (toDriveEmbed) loaded before this.
   Optional: showCommissionModal(editor) defined in the calling
   page — used for the "Commission Editor" button.
   ============================================================ */

const PreviewPanel = (() => {
  function panelEl(targetId) {
    return document.getElementById(targetId || 'inline-preview-panel');
  }

  function close(targetId) {
    const panel = panelEl(targetId);
    if (!panel) return;
    panel.style.display = 'none';
    panel.innerHTML = '';
  }

  function open(item, editor, opts = {}) {
    const targetId = opts.targetId || 'inline-preview-panel';
    const panel = panelEl(targetId);
    if (!panel || !item) return;

    const embed = toDriveEmbed(item.driveLink);
    const showViewProfile = opts.showViewProfile !== false && !!editor;
    const showCommission = opts.showCommission !== false;
    const closeBtnId = `inline-preview-close__${targetId}`;
    const commissionBtnId = `inline-preview-commission-btn__${targetId}`;

    panel.innerHTML = `
      <div class="inline-preview-card fade-in">
        <button class="inline-preview-close" id="${closeBtnId}" aria-label="Close preview">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="preview-modal-grid">
          <div class="preview-video-wrap">
            ${embed
              ? `<iframe src="${embed}" allow="autoplay" allowfullscreen></iframe>`
              : `<div class="no-video">Preview video coming soon.</div>`}
          </div>
          <div class="preview-details">
            <h3>${item.title}</h3>
            <div class="editor-line">by ${editor ? editor.nickname : 'Unknown editor'}</div>
            <p class="desc">${item.description || ''}</p>
            <div class="preview-meta">
              <div class="meta-item"><div class="k">Category</div><div class="v">${item.category}</div></div>
              <div class="meta-item"><div class="k">Software</div><div class="v">${item.software}</div></div>
              <div class="meta-item"><div class="k">Duration</div><div class="v">${item.duration}</div></div>
              <div class="meta-item"><div class="k">Date</div><div class="v">${item.date}</div></div>
            </div>
            <div class="preview-actions">
              ${showCommission ? `<button class="btn btn-primary" id="preview-modal-commission-btn">Commission Editor</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    document.getElementById(closeBtnId)?.addEventListener('click', () => close(targetId));
    if (showCommission) {
      document.getElementById(commissionBtnId)?.addEventListener('click', () => {
        if (editor && typeof showCommissionModal === 'function') showCommissionModal(editor);
      });
    }
  }
  
  function openModal(item, editor, opts = {}) {
    if (!item) return;
    const embed = toDriveEmbed(item.driveLink);
    const showCommission = opts.showCommission !== false;
    const body = `
      <div class="preview-modal-grid">
        <div class="preview-video-wrap">
          ${embed
            ? `<iframe src="${embed}" allow="autoplay" allowfullscreen></iframe>`
            : `<div class="no-video">Preview video coming soon.</div>`}
        </div>
        <div class="preview-details">
          <h3>${item.title}</h3>
          <div class="editor-line">by ${editor ? editor.nickname : 'Unknown editor'}</div>
          <p class="desc">${item.description || ''}</p>
          <div class="preview-meta">
            <div class="meta-item"><div class="k">Category</div><div class="v">${item.category}</div></div>
            <div class="meta-item"><div class="k">Software</div><div class="v">${item.software}</div></div>
            <div class="meta-item"><div class="k">Duration</div><div class="v">${item.duration}</div></div>
            <div class="meta-item"><div class="k">Date</div><div class="v">${item.date}</div></div>
          </div>
          <div class="preview-actions">
              ${showCommission ? `<button class="btn btn-primary" id="preview-modal-commission-btn">Commission Editor</button>` : ''}
            </div>
        </div>
      </div>
    `;

    const overlay = ModalSystem.open({ body });
    overlay.querySelector('.modal-card').classList.add('modal-lg');

    if (showCommission) {
      overlay.querySelector('#preview-modal-commission-btn')?.addEventListener('click', () => {
        if (editor && typeof showCommissionModal === 'function') showCommissionModal(editor);
      });
    }

    return overlay;
  }

  return { open, close, openModal };

  return { open, close };
})();
