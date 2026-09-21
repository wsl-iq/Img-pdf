// import * as Utils from './utils.js';
import * as Storage from './storage.js';
import * as Theme from './theme.js';
import * as Fonts from './fonts.js';
import * as SizeScreen from './sizeScreen.js';
import * as Images from './images.js';
import * as PDF from './pdf.js';
import * as UI from './ui.js';

let reorderMode = false;
let settings = Storage.getSettings();
let dragState = { draggingId: null };

/* Init */
const init = () => {
  UI.cacheElements();

  // Boot subsystems
  SizeScreen.initSizeScreen();
  Theme.initTheme();
  Fonts.initFont();
  settings = Storage.getSettings();
  UI.syncSettingsUI(settings);

  bindEvents();
  renderAll();
  registerServiceWorker();

  UI.showToast('مرحباً بك في محول الصور إلى PDF', 'info', 2500);
};

/* Render */
const renderAll = () => {
  const items = Images.getAll();
  UI.renderImages(
    items,
    { onRemove: handleRemove, onMoveUp: handleMoveUp, onMoveDown: handleMoveDown },
    reorderMode
  );
  UI.renderRecords(Storage.getRecords());
  updateToolbarState();
};

const updateToolbarState = () => {
  const count = Images.count();
  UI.els.btnGenerate.disabled = count === 0;
  UI.els.btnClearAll.disabled = count === 0;
  UI.els.btnReorderToggle.disabled = count < 2;
};

/* Handlers */
const handleRemove = (id) => {
  const item = Images.getById(id);
  if (!item) return;
  UI.showModal(
    'حذف الصورة',
    `هل أنت متأكد من حذف "${item.name}"؟`,
    () => {
      Images.remove(id);
      renderAll();
      UI.showToast('تم حذف الصورة', 'success', 2000);
    },
    'حذف'
  );
};

const handleMoveUp = (id) => { if (Images.moveUp(id)) renderAll(); };
const handleMoveDown = (id) => { if (Images.moveDown(id)) renderAll(); };

const handleClearAll = () => {
  const count = Images.count();
  if (count === 0) return;
  UI.showModal(
    'حذف جميع الصور',
    `هل أنت متأكد من حذف ${count} صورة؟ لا يمكن التراجع عن هذا الإجراء.`,
    () => {
      Images.clearAll();
      renderAll();
      UI.showToast('تم حذف جميع الصور', 'success', 2000);
    },
    'حذف الكل'
  );
};

const handleFiles = async (files) => {
  if (!files || files.length === 0) return;
  UI.showToast('جارٍ معالجة الصور...', 'info', 1500);
  const result = await Images.addFiles(files);
  renderAll();

  if (result.added > 0) {
    UI.showToast(`تمت إضافة ${result.added} صورة`, 'success', 2500);
  }
  if (result.rejected.length > 0) {
    result.rejected.forEach((r) => {
      UI.showToast(`${r.name}: ${r.reason}`, 'error', 4000);
    });
  }
  if (result.added === 0 && result.rejected.length === 0) {
    UI.showToast('لم يتم إضافة أي صورة', 'warning', 2500);
  }
};

const handleGenerate = async () => {
  const items = Images.getAll();
  if (items.length === 0) {
    UI.showToast('لا توجد صور لإنشاء PDF', 'warning', 2500);
    return;
  }

  const btn = UI.els.btnGenerate;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الإنشاء...</span>';

  try {
    await new Promise((r) => setTimeout(r, 50));

    const blob = await PDF.buildPdf(items, {
      pageSize: settings.pageSize,
      orientation: settings.orientation,
      margin: settings.margin,
      quality: settings.quality,
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `images-${timestamp}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    Storage.addRecord('pdf_generated', {
      imageCount: items.length,
      pageSize: settings.pageSize,
      orientation: settings.orientation,
    });

    renderAll();
    UI.showToast(`تم إنشاء PDF بنجاح (${items.length} صور)`, 'success', 3500);
  } catch (e) {
    console.error('PDF generation failed:', e);
    UI.showToast('فشل في إنشاء PDF. حاول مرة أخرى.', 'error', 4000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="icon icon-pdf" aria-hidden="true"></span><span>إنشاء PDF</span>';
  }
};

/* Drag & Drop */
const setupDragDrop = () => {
  const dz = UI.els.dropZone;

  ['dragenter', 'dragover'].forEach((evt) => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('dragover');
    });
  });

  dz.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files) handleFiles(files);
  });
};

const setupGridDrag = () => {
  const grid = UI.els.imageGrid;

  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.image-card');
    if (!card) return;
    dragState.draggingId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });

  grid.addEventListener('dragend', (e) => {
    const card = e.target.closest('.image-card');
    if (card) card.classList.remove('dragging');
    grid.querySelectorAll('.image-card').forEach((c) => c.classList.remove('drag-over'));
    dragState.draggingId = null;
  });

  grid.addEventListener('dragover', (e) => {
    e.preventDefault();
    const card = e.target.closest('.image-card');
    if (!card || card.dataset.id === dragState.draggingId) return;
    e.dataTransfer.dropEffect = 'move';
    grid.querySelectorAll('.image-card').forEach((c) => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });

  grid.addEventListener('drop', (e) => {
    e.preventDefault();
    const card = e.target.closest('.image-card');
    if (!card || !dragState.draggingId) return;
    const targetId = card.dataset.id;
    if (targetId === dragState.draggingId) return;

    const items = Images.getAll();
    const fromIdx = items.findIndex((i) => i.id === dragState.draggingId);
    const toIdx = items.findIndex((i) => i.id === targetId);
    if (fromIdx !== -1 && toIdx !== -1) {
      Images.move(fromIdx, toIdx);
      renderAll();
    }
    grid.querySelectorAll('.image-card').forEach((c) => c.classList.remove('drag-over'));
  });
};

/* Settings handlers (event delegation) */
const setupSettingsHandlers = () => {
  const panel = UI.els.viewSettings;
  if (!panel) return;

  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented button[data-value]');
    if (!btn) return;

    const group = btn.closest('[data-setting]');
    if (!group) return;

    e.stopPropagation();

    const key = group.dataset.setting;
    const value = btn.dataset.value;

    if (key === 'theme') {
      Theme.setTheme(value);
      UI.showToast(value === 'dark' ? 'المظهر الداكن' : value === 'light' ? 'المظهر الفاتح' : 'المظهر التلقائي', 'success', 1500);
    } else if (key === 'font') {
      Fonts.setFont(value);
      UI.showToast('تم تحديث الخط', 'success', 1500);
    } else {
      settings[key] = value;
      Storage.saveSettings(settings);
      UI.showToast('تم تحديث الإعدادات', 'success', 1500);
    }

    UI.updateSegmented(group, value);
  });
};

/* Records */
const handleClearRecords = () => {
  UI.showModal(
    'مسح السجلات',
    'هل أنت متأكد من مسح جميع السجلات؟ لا يمكن التراجع.',
    () => {
      Storage.clearRecords();
      UI.renderRecords(Storage.getRecords());
      UI.showToast('تم مسح السجلات', 'success', 2000);
    },
    'مسح'
  );
};

/* Full storage wipe */
const handleWipeStorage = () => {
  UI.showModal(
    'حذف كل التخزين',
    'سيتم حذف كل الإعدادات والسجلات والصور نهائياً. هل أنت متأكد؟',
    () => {
      // 1. Wipe LocalStorage
      Storage.wipeAllStorage();

      // 2. Clear in-memory images and revoke URLs
      Images.clearAll();

      // 3. Reset settings to defaults
      settings = Storage.getSettings();

      // 4. Re-init theme & fonts
      Theme.initTheme();
      Fonts.initFont();

      // 5. Re-sync UI
      UI.syncSettingsUI(settings);

      // 6. Re-render
      renderAll();

      UI.showToast('تم حذف كل التخزين بنجاح', 'success', 2500);
    },
    'حذف الكل'
  );
};

/* Events */
const bindEvents = () => {
  /*  Drop Zone  */
  UI.els.dropZone.addEventListener('click', () => UI.els.fileInput.click());
  UI.els.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      UI.els.fileInput.click();
    }
  });

  UI.els.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  /*  Toolbar Buttons  */
  UI.els.btnClearAll.addEventListener('click', handleClearAll);
  UI.els.btnGenerate.addEventListener('click', handleGenerate);

  UI.els.btnReorderToggle.addEventListener('click', () => {
    reorderMode = !reorderMode;
    UI.els.btnReorderToggle.classList.toggle('active', reorderMode);
    renderAll();
    UI.showToast(
      reorderMode ? 'وضع الترتيب مفعل — اسحب الصور لترتيبها' : 'وضع الترتيب معطل',
      'info',
      2000
    );
  });

  /*  Header Buttons — Navigate to views  */
  UI.els.btnToggleTheme.addEventListener('click', () => {
    const next = Theme.toggleTheme();
    UI.showToast(next === 'dark' ? 'المظهر الداكن' : 'المظهر الفاتح', 'info', 1500);
    UI.syncSettingsUI(Storage.getSettings());
  });

  UI.els.btnToggleSettings.addEventListener('click', () => {
    UI.showView('settings', 'forward');
  });

  UI.els.btnToggleRecords.addEventListener('click', () => {
    UI.renderRecords(Storage.getRecords());
    UI.showView('records', 'forward');
  });

  /*  Back Buttons  */
  UI.els.btnBackSettings.addEventListener('click', () => {
    UI.showView('main', 'backward');
  });

  UI.els.btnBackRecords.addEventListener('click', () => {
    UI.showView('main', 'backward');
  });

  /*  Records Clear  */
  UI.els.btnClearRecords.addEventListener('click', handleClearRecords);

  /*  Full Storage Wipe  */
  UI.els.btnWipeStorage.addEventListener('click', handleWipeStorage);

  /*  Settings — Event Delegation  */
  setupSettingsHandlers();

  /*  Drag & Drop  */
  setupDragDrop();
  setupGridDrag();

  /*  Prevent default page-level drops  */
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  /*  Warn before unload if images exist  */
  window.addEventListener('beforeunload', (e) => {
    if (Images.count() > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /*  Handle browser back button  */
  window.addEventListener('popstate', () => {
    if (UI.getCurrentView() !== 'main') {
      UI.showView('main', 'backward');
    }
  });

  /*  Session metadata  */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Storage.saveSession({
        lastActive: new Date().toISOString(),
        imageCount: Images.count(),
      });
    }
  });

  /*  Device change — re-render if needed  */
  SizeScreen.onDeviceChange(() => {
    // Re-render records / settings if visible
    const view = UI.getCurrentView();
    if (view === 'records') UI.renderRecords(Storage.getRecords());
  });

  window.addEventListener('unload', () => Images.cleanup());
};

/* Service Worker */
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
};

/* Start */
document.addEventListener('DOMContentLoaded', init);