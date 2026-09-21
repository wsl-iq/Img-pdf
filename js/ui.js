import { formatBytes, formatDate } from './utils.js';

export const els = {};

export const cacheElements = () => {
  const ids = [
    'dropZone', 'fileInput', 'imageGrid', 'emptyState', 'imageCount',
    'btnClearAll', 'btnGenerate', 'btnReorderToggle',
    'viewMain', 'viewSettings', 'viewRecords',
    'btnBackSettings', 'btnBackRecords',
    'recordsList', 'btnClearRecords',
    'btnToggleSettings', 'btnToggleRecords', 'btnToggleTheme',
    'btnWipeStorage', 'toastContainer', 'modalContainer',
  ];
  ids.forEach((id) => { els[id] = document.getElementById(id); });
};

/* Toast */
export const showToast = (message, type = 'info', duration = 3000) => {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconMap = {
    success: 'icon-check',
    error: 'icon-close',
    warning: 'icon-info',
    info: 'icon-info',
  };
  toast.innerHTML = `<span class="icon ${iconMap[type] || 'icon-info'}" aria-hidden="true"></span><span>${message}</span>`;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

/* Modal */
export const showModal = (
  title,
  message,
  onConfirm,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء'
) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <h2 id="modalTitle">${title}</h2>
      <p>${message}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">${cancelText}</button>
        <button type="button" class="btn btn-danger" data-action="confirm">${confirmText}</button>
      </div>
    </div>
  `;
  els.modalContainer.appendChild(overlay);

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    close();
    onConfirm();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const focusable = overlay.querySelectorAll('button');
  if (focusable.length) focusable[0].focus();
};

/* Render Image Grid */
export const renderImages = (items, handlers, reorderMode) => {
  if (items.length === 0) {
    els.imageGrid.classList.add('hidden');
    els.emptyState.classList.remove('hidden');
    els.imageCount.textContent = '0';
    return;
  }

  els.imageGrid.classList.remove('hidden');
  els.emptyState.classList.add('hidden');
  els.imageCount.textContent = items.length;

  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'image-card';
    li.dataset.id = item.id;
    li.setAttribute('role', 'listitem');
    if (reorderMode) li.draggable = true;

    li.innerHTML = `
      <img src="${item.url}" alt="${item.name}" loading="lazy" />
      <span class="image-card-index">${index + 1}</span>
      <div class="image-card-overlay">
        <div class="image-card-actions">
          <button type="button" class="btn-icon btn-sm" data-action="up" aria-label="تحريك لأعلى" title="لأعلى">
            <span class="icon icon-up" aria-hidden="true"></span>
          </button>
          <button type="button" class="btn-icon btn-sm" data-action="down" aria-label="تحريك لأسفل" title="لأسفل">
            <span class="icon icon-down" aria-hidden="true"></span>
          </button>
          <button type="button" class="btn-icon btn-sm danger" data-action="remove" aria-label="حذف الصورة" title="حذف">
            <span class="icon icon-trash" aria-hidden="true"></span>
          </button>
        </div>
        <div>
          <div class="image-card-name force-ltr-inline">${item.name}</div>
          <div class="image-card-size force-ltr-inline">${formatBytes(item.size)} · ${item.width}×${item.height}</div>
        </div>
      </div>
    `;

    li.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onRemove(item.id);
    });
    li.querySelector('[data-action="up"]').addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onMoveUp(item.id);
    });
    li.querySelector('[data-action="down"]').addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onMoveDown(item.id);
    });

    fragment.appendChild(li);
  });

  els.imageGrid.innerHTML = '';
  els.imageGrid.appendChild(fragment);
};

/* Render Records */
export const renderRecords = (records) => {
  const recent = records.recentOperations || [];
  els.recordsList.innerHTML = `
    <div class="record-item">
      <span class="record-label">ملفات PDF المُنشأة</span>
      <span class="record-value">${records.totalPdfs || 0}</span>
    </div>
    <div class="record-item">
      <span class="record-label">إجمالي الصور المُعالجة</span>
      <span class="record-value">${records.totalImages || 0}</span>
    </div>
    <div class="record-item">
      <span class="record-label">آخر إنشاء</span>
      <span class="record-value">${formatDate(records.lastGeneration)}</span>
    </div>
    <div class="record-item">
      <span class="record-label">أول استخدام</span>
      <span class="record-value">${formatDate(records.firstUse)}</span>
    </div>
    ${
      recent.length
        ? `
      <div class="records-subtitle">آخر العمليات:</div>
      ${recent
        .slice(0, 5)
        .map(
          (op) => `
        <div class="record-item small">
          <span class="record-label">${formatDate(op.date)}</span>
          <span class="record-value">${op.imageCount} صور · ${op.pageSize.toUpperCase()}</span>
        </div>`
        )
        .join('')}
    `
        : ''
    }
  `;
};

/* View Switching with Animation */
let currentView = 'main';
let isAnimating = false;

const VIEWS = {
  main: () => els.viewMain,
  settings: () => els.viewSettings,
  records: () => els.viewRecords,
};

export const showView = (name, direction = 'forward') => {
  if (isAnimating || name === currentView) return;

  const fromEl = VIEWS[currentView]?.();
  const toEl = VIEWS[name]?.();
  if (!fromEl || !toEl) return;

  isAnimating = true;

  // Prepare target
  toEl.classList.remove('hidden');

  // Animation classes
  const isMobile = document.body.dataset.device === 'mobile';

  if (isMobile) {
    // Slide on mobile
    if (direction === 'forward') {
      toEl.classList.add('view-enter-right');
      fromEl.classList.add('view-exit-left');
    } else {
      toEl.classList.add('view-enter-left');
      fromEl.classList.add('view-exit-right');
    }
  } else {
    // Fade + scale on desktop
    toEl.classList.add('view-enter-right');
    fromEl.classList.add('view-exit-right');
  }

  const cleanup = () => {
    fromEl.classList.add('hidden');
    fromEl.classList.remove('view-exit-left', 'view-exit-right');
    toEl.classList.remove('view-enter-left', 'view-enter-right');
    currentView = name;
    isAnimating = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Wait for animation to complete
  const duration = isMobile ? 380 : 380;
  setTimeout(cleanup, duration);
};

export const getCurrentView = () => currentView;

/* Segmented Control */
export const updateSegmented = (container, value) => {
  if (!container) return;
  const buttons = container.querySelectorAll('button[data-value]');
  buttons.forEach((btn) => {
    const isActive = btn.dataset.value === String(value);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });
};

/* Sync all settings UI */
export const syncSettingsUI = (settings) => {
  const groups = document.querySelectorAll('[data-setting]');
  groups.forEach((group) => {
    const key = group.dataset.setting;
    const val = settings[key];
    if (val !== undefined) updateSegmented(group, val);
  });
};