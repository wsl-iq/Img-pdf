/**
 * app
 * Main controller. Boots all subsystems and wires UI events.
 */

(function () {
  'use strict';

  var App = window.App;
  var Utils = App.Utils;
  var Storage = App.Storage;
  var IDB = App.IDB;
  var History = App.History;
  var Theme = App.Theme;
  var Fonts = App.Fonts;
  var SizeScreen = App.SizeScreen;
  var Haptics = App.Haptics;
  var Badge = App.Badge;
  var Images = App.Images;
  var PDF = App.PDF;
  var Docx = App.Docx;
  var Editor = App.Editor;
  var Suggest = App.Suggest;
  var Stats = App.Stats;
  var ExportImport = App.ExportImport;
  var Shortcuts = App.Shortcuts;
  var UI = App.UI;

  var reorderMode = false;
  var settings = Storage.getSettings();
  var dragState = { draggingId: null };

  function init() {
    UI.cacheElements();
    SizeScreen.init();
    Theme.init();
    Fonts.init();

    settings = Storage.getSettings();
    UI.syncSettingsUI(settings);
    Haptics.set(settings.haptics !== false);

    bindEvents();
    registerShortcuts();
    setupHistory();

    restoreSession().then(function () {
      renderAll();
      renderStats();
      registerServiceWorker();
      UI.showToast('مرحباً بك', 'info', 2500);
      console.log('[app] initialized');
    });
  }

  function restoreSession() {
    return IDB.loadSessionImages().then(function (saved) {
      if (saved.length > 0) {
        saved.forEach(function (item) { Images.restoreItem(item); });
        UI.showToast('تم استرجاع ' + saved.length + ' صورة', 'info', 3000);
      }
    }).catch(function () {});
  }

  function persistSession() {
    if (Images.count() > 0) {
      return IDB.saveSessionImages(Images.getAll()).catch(function () {});
    }
    return IDB.clearSessionImages().catch(function () {});
  }

  function setupHistory() {
    History.push({
      order: Images.getAll().map(function (i) { return i.id; }),
      settings: settings
    }, 'initial');

    History.onChange(function (s) {
      if (UI.els.btnUndo) UI.els.btnUndo.disabled = !s.canUndo;
      if (UI.els.btnRedo) UI.els.btnRedo.disabled = !s.canRedo;
    });

    if (UI.els.btnUndo) UI.els.btnUndo.disabled = true;
    if (UI.els.btnRedo) UI.els.btnRedo.disabled = true;
  }

  function registerShortcuts() {
    Shortcuts.init();
    Shortcuts.register('ctrl+o', function () {
      if (UI.els.fileInput) UI.els.fileInput.click();
    }, 'فتح صور');
    Shortcuts.register('ctrl+s', function () { handleGenerate(); }, 'إنشاء PDF');
    Shortcuts.register('ctrl+z', function () { handleUndo(); }, 'تراجع');
    Shortcuts.register('ctrl+shift+z', function () { handleRedo(); }, 'إعادة');
    Shortcuts.register('escape', function () {
      if (UI.getCurrentView() !== 'main') UI.showView('main', 'backward');
    }, 'رجوع');
  }

  function renderAll() {
    var items = Images.getAll();
    UI.renderImages(items, {
      onRemove: handleRemove,
      onEdit: handleEdit,
      onMoveUp: handleMoveUp,
      onMoveDown: handleMoveDown
    }, reorderMode);
    UI.renderRecords(Storage.getRecords());
    updateToolbarState();
    Badge.set(items.length);
    persistSession();
  }

  function updateToolbarState() {
    var c = Images.count();
    if (UI.els.btnGenerate) UI.els.btnGenerate.disabled = c === 0;
    if (UI.els.btnClearAll) UI.els.btnClearAll.disabled = c === 0;
    if (UI.els.btnReorderToggle) UI.els.btnReorderToggle.disabled = c < 2;
    if (UI.els.btnExportWord) UI.els.btnExportWord.disabled = c === 0;
  }

  function pushHistory(label) {
    History.push({
      order: Images.getAll().map(function (i) { return i.id; }),
      settings: settings
    }, label);
  }

  function handleRemove(id) {
    var item = Images.getById(id);
    if (!item) return;
    Haptics.tap();
    UI.showModal('حذف الصورة', 'هل أنت متأكد من حذف "' + Utils.escapeHtml(item.name) + '"؟', function () {
      Images.remove(id);
      renderAll();
      pushHistory('remove');
      UI.showToast('تم حذف الصورة', 'success', 2000);
      Haptics.success();
    }, 'حذف');
  }

  function handleEdit(id) {
    var item = Images.getById(id);
    if (!item) return;
    Haptics.tap();
    Editor.open(item, function (transforms) {
      Images.updateTransforms(id, transforms);
      renderAll();
      UI.showToast('تم حفظ التعديلات', 'success', 2000);
    });
  }

  function handleMoveUp(id) {
    if (Images.moveUp(id)) {
      renderAll();
      pushHistory('move');
    }
  }

  function handleMoveDown(id) {
    if (Images.moveDown(id)) {
      renderAll();
      pushHistory('move');
    }
  }

  function handleClearAll() {
    var c = Images.count();
    if (c === 0) return;
    Haptics.tap();
    UI.showModal('حذف جميع الصور', 'هل أنت متأكد من حذف ' + c + ' صورة؟', function () {
      Images.clearAll();
      renderAll();
      pushHistory('clear');
      UI.showToast('تم حذف جميع الصور', 'success', 2000);
      Haptics.success();
    }, 'حذف الكل');
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;

    UI.showToast('جار معالجة الصور', 'info', 1500);

    Images.addFiles(files).then(function (result) {
      renderAll();
      pushHistory('add');

      if (result.added > 0) {
        UI.showToast('تمت إضافة ' + result.added + ' صورة', 'success', 2500);
        Haptics.success();

        var s = Suggest.suggestSettings(Images.getAll());
        if (s && Images.count() > 2) {
          setTimeout(function () {
            UI.showToast(s.reason, 'info', 4000);
          }, 800);
        }
      }

      if (result.rejected.length > 0) {
        result.rejected.forEach(function (r) {
          UI.showToast(r.name + ': ' + r.reason, 'error', 4000);
        });
        Haptics.warning();
      }
    });
  }

  function handleGenerate() {
    var items = Images.getAll();
    if (items.length === 0) {
      UI.showToast('لا توجد صور', 'warning', 2500);
      return;
    }

    var btn = UI.els.btnGenerate;
    var original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>جار الإنشاء</span>';

    setTimeout(function () {
      PDF.build(items, {
        pageSize: settings.pageSize,
        orientation: settings.orientation,
        margin: settings.margin,
        quality: settings.quality,
        compression: settings.compression,
        pageNumbers: settings.pageNumbers
      }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = 'images-' + ts + '.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);

        Storage.addRecord('pdf_generated', {
          imageCount: items.length,
          pageSize: settings.pageSize,
          orientation: settings.orientation
        });

        renderAll();
        renderStats();
        UI.showToast('تم إنشاء PDF (' + items.length + ' صور)', 'success', 3500);
        Haptics.success();
      }).catch(function (err) {
        console.error('PDF error', err);
        UI.showToast('فشل إنشاء PDF', 'error', 4000);
        Haptics.error();
      }).then(function () {
        btn.disabled = false;
        btn.innerHTML = original;
      });
    }, 50);
  }

  function handleExportWord() {
    var items = Images.getAll();
    if (items.length === 0) {
      UI.showToast('لا توجد صور', 'warning', 2000);
      return;
    }

    UI.showToast('جار تجهيز Word', 'info', 2000);

    Docx.export(items).then(function () {
      UI.showToast('تم تصدير Word', 'success', 2500);
      Haptics.success();
    }).catch(function () {
      UI.showToast('فشل تصدير Word', 'error', 3000);
    });
  }

  function handleUndo() {
    var snap = History.undo();
    if (!snap) return;
    Haptics.light();
    applySnapshot(snap);
    UI.showToast('تم التراجع', 'info', 1500);
  }

  function handleRedo() {
    var snap = History.redo();
    if (!snap) return;
    Haptics.light();
    applySnapshot(snap);
    UI.showToast('تم الإعادة', 'info', 1500);
  }

  function applySnapshot(snap) {
    var all = Images.getAll();
    var reordered = snap.order.map(function (id) {
      return all.filter(function (i) { return i.id === id; })[0];
    }).filter(Boolean);

    if (reordered.length === all.length) {
      Images.replaceAll(reordered);
    }
    renderAll();
  }

  function handleWipeStorage() {
    Haptics.tap();
    UI.showModal('حذف كل التخزين', 'سيتم حذف كل الإعدادات والسجلات والصور نهائيا.', function () {
      Storage.wipeAllStorage();
      IDB.wipeDB().then(function () {
        Images.clearAll();
        History.reset();
        settings = Storage.getSettings();
        Theme.init();
        Fonts.init();
        UI.syncSettingsUI(settings);
        renderAll();
        renderStats();
        UI.showToast('تم حذف كل التخزين', 'success', 2500);
        Haptics.success();
      });
    }, 'حذف الكل');
  }

  function handleClearRecords() {
    UI.showModal('مسح السجلات', 'هل أنت متأكد من مسح جميع السجلات؟', function () {
      Storage.clearRecords();
      UI.renderRecords(Storage.getRecords());
      renderStats();
      UI.showToast('تم مسح السجلات', 'success', 2000);
    }, 'مسح');
  }

  function renderStats() {
    var records = Storage.getRecords();
    var chart = Stats.buildWeeklyChart(records.recentOperations || []);

    if (UI.els.statsChart) UI.els.statsChart.innerHTML = chart;

    var totalImages = records.totalImages || 0;
    var totalPdfs = records.totalPdfs || 0;
    var avg = totalPdfs > 0 ? Math.round(totalImages / totalPdfs) : 0;

    if (UI.els.statsSummary) {
      UI.els.statsSummary.innerHTML =
        '<div class="record-item">' +
          '<span class="record-label">إجمالي الملفات</span>' +
          '<span class="record-value">' + totalPdfs + '</span>' +
        '</div>' +
        '<div class="record-item">' +
          '<span class="record-label">إجمالي الصور</span>' +
          '<span class="record-value">' + totalImages + '</span>' +
        '</div>' +
        '<div class="record-item">' +
          '<span class="record-label">متوسط الصور لكل ملف</span>' +
          '<span class="record-value">' + avg + '</span>' +
        '</div>';
    }
  }

  function setupDragDrop() {
    var dz = UI.els.dropZone;
    if (!dz) return;

    ['dragenter', 'dragover'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(function (evt) {
      dz.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.remove('dragover');
      });
    });

    dz.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files) handleFiles(files);
    });
  }

  function setupGridDrag() {
    var grid = UI.els.imageGrid;
    if (!grid) return;

    grid.addEventListener('dragstart', function (e) {
      var card = e.target.closest('.image-card');
      if (!card) return;
      dragState.draggingId = card.getAttribute('data-id');
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', function (e) {
      var card = e.target.closest('.image-card');
      if (card) card.classList.remove('dragging');
      var all = grid.querySelectorAll('.image-card');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('drag-over');
      dragState.draggingId = null;
    });

    grid.addEventListener('dragover', function (e) {
      e.preventDefault();
      var card = e.target.closest('.image-card');
      if (!card || card.getAttribute('data-id') === dragState.draggingId) return;
      e.dataTransfer.dropEffect = 'move';
      var all = grid.querySelectorAll('.image-card');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('drag-over');
      card.classList.add('drag-over');
    });

    grid.addEventListener('drop', function (e) {
      e.preventDefault();
      var card = e.target.closest('.image-card');
      if (!card || !dragState.draggingId) return;
      var targetId = card.getAttribute('data-id');
      if (targetId === dragState.draggingId) return;

      var items = Images.getAll();
      var fromIdx = -1;
      var toIdx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === dragState.draggingId) fromIdx = i;
        if (items[i].id === targetId) toIdx = i;
      }
      if (fromIdx !== -1 && toIdx !== -1) {
        Images.move(fromIdx, toIdx);
        renderAll();
        pushHistory('reorder');
      }
      var all = grid.querySelectorAll('.image-card');
      for (var j = 0; j < all.length; j++) all[j].classList.remove('drag-over');
    });
  }

  function setupSettingsHandlers() {
    var view = UI.els.viewSettings;
    if (!view) return;

    view.addEventListener('click', function (e) {
      var btn = e.target.closest('.segmented button[data-value]');
      if (!btn) return;

      var group = btn.closest('[data-setting]');
      if (!group) return;

      e.stopPropagation();
      Haptics.tap();

      var key = group.getAttribute('data-setting');
      var rawValue = btn.getAttribute('data-value');
      var value = rawValue;

      if (key === 'haptics' || key === 'pageNumbers') {
        value = rawValue === 'true';
      }

      if (key === 'theme') {
        Theme.set(rawValue);
      } else if (key === 'font') {
        Fonts.set(rawValue);
      } else if (key === 'haptics') {
        Haptics.set(value);
        settings[key] = value;
        Storage.saveSettings(settings);
      } else {
        settings[key] = value;
        Storage.saveSettings(settings);
      }

      UI.updateSegmented(group, rawValue);
    });
  }

  function bindEvents() {
    if (!UI.els.dropZone) {
      console.error('[app] dropZone not found');
      return;
    }

    UI.els.dropZone.addEventListener('click', function () {
      UI.els.fileInput.click();
    });

    UI.els.dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        UI.els.fileInput.click();
      }
    });

    UI.els.fileInput.addEventListener('change', function (e) {
      handleFiles(e.target.files);
      e.target.value = '';
    });

    UI.els.btnClearAll.addEventListener('click', handleClearAll);
    UI.els.btnGenerate.addEventListener('click', handleGenerate);
    UI.els.btnExportWord.addEventListener('click', handleExportWord);

    UI.els.btnReorderToggle.addEventListener('click', function () {
      reorderMode = !reorderMode;
      UI.els.btnReorderToggle.classList.toggle('active', reorderMode);
      renderAll();
      UI.showToast(reorderMode ? 'وضع الترتيب مفعل' : 'وضع الترتيب معطل', 'info', 2000);
      Haptics.tap();
    });

    UI.els.btnUndo.addEventListener('click', handleUndo);
    UI.els.btnRedo.addEventListener('click', handleRedo);

    UI.els.btnToggleTheme.addEventListener('click', function () {
      var next = Theme.toggle();
      UI.showToast(next === 'dark' ? 'المظهر الداكن' : 'المظهر الفاتح', 'info', 1500);
      UI.syncSettingsUI(Storage.getSettings());
      Haptics.tap();
    });

    UI.els.btnExportSettings.addEventListener('click', function () {
      ExportImport.export();
      UI.showToast('تم تصدير الإعدادات', 'success', 2000);
    });

    UI.els.btnImportSettings.addEventListener('click', function () {
      UI.els.importInput.click();
    });

    UI.els.importInput.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      ExportImport.import(file).then(function () {
        settings = Storage.getSettings();
        Theme.init();
        Fonts.init();
        UI.syncSettingsUI(settings);
        renderAll();
        UI.showToast('تم استيراد الإعدادات', 'success', 2500);
      }).catch(function () {
        UI.showToast('فشل استيراد الملف', 'error', 3000);
      });
      e.target.value = '';
    });

    UI.els.btnBackSettings.addEventListener('click', function () {
      UI.showView('main', 'backward');
    });
    UI.els.btnBackRecords.addEventListener('click', function () {
      UI.showView('main', 'backward');
    });
    UI.els.btnBackStats.addEventListener('click', function () {
      UI.showView('main', 'backward');
    });

    UI.els.btnClearRecords.addEventListener('click', handleClearRecords);
    UI.els.btnWipeStorage.addEventListener('click', handleWipeStorage);

    /* --- Main navigation --- */
    if (UI.els.mainNav) {
      UI.els.mainNav.addEventListener('click', function (e) {
        var btn = e.target.closest('.main-nav-btn');
        if (!btn) return;
        Haptics.tap();
        var target = btn.getAttribute('data-view');
        if (target === UI.getCurrentView()) return;
        UI.showView(target, 'forward');
        if (target === 'stats') renderStats();
        if (target === 'records') UI.renderRecords(Storage.getRecords());
      });
    }

    setupSettingsHandlers();
    setupDragDrop();
    setupGridDrag();

    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) { e.preventDefault(); });

    window.addEventListener('beforeunload', function (e) {
      if (Images.count() > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    window.addEventListener('popstate', function () {
      if (UI.getCurrentView() !== 'main') {
        UI.showView('main', 'backward');
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        persistSession();
        Storage.saveSession({
          lastActive: new Date().toISOString(),
          imageCount: Images.count()
        });
      }
    });

    SizeScreen.onChange(function () {
      var v = UI.getCurrentView();
      if (v === 'records') UI.renderRecords(Storage.getRecords());
      if (v === 'stats') renderStats();
    });

    window.addEventListener('unload', function () {
      Images.cleanup();
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('service-worker.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[app] controller ready');
})();

// bind