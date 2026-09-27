/**
 * ui
 * DOM element cache, toasts, modals, image grid rendering, view switching.
 */

(function () {
  'use strict';

  var App = window.App;
  var Utils = App.Utils;

  var els = {};

  function cacheElements() {
    var ids = [
      'dropZone', 'fileInput', 'imageGrid', 'emptyState', 'imageCount',
      'btnClearAll', 'btnGenerate', 'btnReorderToggle', 'btnExportWord',
      'btnUndo', 'btnRedo', 'btnToggleTheme',
      'btnExportSettings', 'btnImportSettings', 'importInput',
      'viewMain', 'viewSettings', 'viewRecords', 'viewStats',
      'btnBackSettings', 'btnBackRecords', 'btnBackStats',
      'recordsList', 'btnClearRecords', 'btnWipeStorage',
      'statsChart', 'statsSummary',
      'mainNav', 'toastContainer', 'modalContainer', 'editorContainer'
    ];
    ids.forEach(function (id) {
      els[id] = document.getElementById(id);
    });
  }

  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var iconMap = {
      success: 'ico-check',
      error: 'ico-close',
      warning: 'ico-info',
      info: 'ico-info'
    };

    toast.innerHTML = '<svg class="icon"><use href="#' + (iconMap[type] || 'ico-info') +
      '"/></svg><span>' + message + '</span>';

    els.toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('removing');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  function showModal(title, message, onConfirm, confirmText, cancelText) {
    confirmText = confirmText || 'تأكيد';
    cancelText = cancelText || 'إلغاء';

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<h2>' + title + '</h2>' +
        '<p>' + message + '</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-secondary" data-action="cancel">' + cancelText + '</button>' +
          '<button type="button" class="btn btn-danger" data-action="confirm">' + confirmText + '</button>' +
        '</div>' +
      '</div>';

    els.modalContainer.appendChild(overlay);

    function close() {
      overlay.style.opacity = '0';
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', function () {
      close();
      onConfirm();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    var focusable = overlay.querySelectorAll('button');
    if (focusable.length) focusable[0].focus();
  }

  function renderImages(items, handlers, reorderMode) {
    if (items.length === 0) {
      els.imageGrid.classList.add('hidden');
      els.emptyState.classList.remove('hidden');
      els.imageCount.textContent = '0';
      return;
    }

    els.imageGrid.classList.remove('hidden');
    els.emptyState.classList.add('hidden');
    els.imageCount.textContent = items.length;

    var fragment = document.createDocumentFragment();

    items.forEach(function (item, index) {
      var li = document.createElement('li');
      li.className = 'image-card';
      li.setAttribute('data-id', item.id);
      if (reorderMode) li.draggable = true;

      var t = item.transforms || {};
      var styles = [];
      if (t.rotation) styles.push('transform: rotate(' + t.rotation + 'deg)');
      if (t.brightness !== undefined || t.contrast !== undefined) {
        styles.push('filter: brightness(' + (t.brightness === undefined ? 1 : t.brightness) +
          ') contrast(' + (t.contrast === undefined ? 1 : t.contrast) + ')');
      }

      li.innerHTML =
        '<img src="' + item.url + '" alt="" loading="lazy" style="' + styles.join(';') + '">' +
        '<span class="image-card-index">' + (index + 1) + '</span>' +
        '<div class="image-card-overlay">' +
          '<div class="image-card-actions">' +
            '<button type="button" class="btn-icon" data-action="edit" aria-label="تحرير">' +
              '<svg class="icon"><use href="#ico-edit"/></svg>' +
            '</button>' +
            '<button type="button" class="btn-icon" data-action="up" aria-label="أعلى">' +
              '<svg class="icon"><use href="#ico-up"/></svg>' +
            '</button>' +
            '<button type="button" class="btn-icon" data-action="down" aria-label="أسفل">' +
              '<svg class="icon"><use href="#ico-down"/></svg>' +
            '</button>' +
            '<button type="button" class="btn-icon danger" data-action="remove" aria-label="حذف">' +
              '<svg class="icon"><use href="#ico-trash"/></svg>' +
            '</button>' +
          '</div>' +
          '<div>' +
            '<div class="image-card-name force-ltr-inline">' + Utils.escapeHtml(item.name) + '</div>' +
            '<div class="image-card-size force-ltr-inline">' +
              Utils.formatBytes(item.size) + ' - ' + item.width + 'x' + item.height +
            '</div>' +
          '</div>' +
        '</div>';

      li.querySelector('[data-action="remove"]').addEventListener('click', function (e) {
        e.stopPropagation();
        handlers.onRemove(item.id);
      });
      li.querySelector('[data-action="edit"]').addEventListener('click', function (e) {
        e.stopPropagation();
        handlers.onEdit(item.id);
      });
      li.querySelector('[data-action="up"]').addEventListener('click', function (e) {
        e.stopPropagation();
        handlers.onMoveUp(item.id);
      });
      li.querySelector('[data-action="down"]').addEventListener('click', function (e) {
        e.stopPropagation();
        handlers.onMoveDown(item.id);
      });

      fragment.appendChild(li);
    });

    els.imageGrid.innerHTML = '';
    els.imageGrid.appendChild(fragment);
  }

  function renderRecords(records) {
    var recent = records.recentOperations || [];

    var html =
      '<div class="record-item">' +
        '<span class="record-label">ملفات PDF المُنشأة</span>' +
        '<span class="record-value">' + (records.totalPdfs || 0) + '</span>' +
      '</div>' +
      '<div class="record-item">' +
        '<span class="record-label">إجمالي الصور المُعالجة</span>' +
        '<span class="record-value">' + (records.totalImages || 0) + '</span>' +
      '</div>' +
      '<div class="record-item">' +
        '<span class="record-label">آخر إنشاء</span>' +
        '<span class="record-value">' + Utils.formatDate(records.lastGeneration) + '</span>' +
      '</div>' +
      '<div class="record-item">' +
        '<span class="record-label">أول استخدام</span>' +
        '<span class="record-value">' + Utils.formatDate(records.firstUse) + '</span>' +
      '</div>';

    if (recent.length) {
      html += '<div class="records-subtitle">آخر العمليات:</div>';
      recent.slice(0, 10).forEach(function (op) {
        html +=
          '<div class="record-item small">' +
            '<span class="record-label">' + Utils.formatDate(op.date) + '</span>' +
            '<span class="record-value">' + op.imageCount + ' صور - ' + (op.pageSize || '').toUpperCase() + '</span>' +
          '</div>';
      });
    }

    els.recordsList.innerHTML = html;
  }

  var currentView = 'main';
  var animating = false;

  function getViewEl(name) {
    switch (name) {
      case 'main': return els.viewMain;
      case 'settings': return els.viewSettings;
      case 'records': return els.viewRecords;
      case 'stats': return els.viewStats;
      default: return null;
    }
  }

  function showView(name, direction) {
    direction = direction || 'forward';
    if (animating || name === currentView) return;

    var fromEl = getViewEl(currentView);
    var toEl = getViewEl(name);
    if (!fromEl || !toEl) return;

    animating = true;
    toEl.classList.remove('hidden');

    var isMobile = document.body.dataset.device === 'mobile';

    if (isMobile) {
      if (direction === 'forward') {
        toEl.classList.add('view-enter-right');
        fromEl.classList.add('view-exit-left');
      } else {
        toEl.classList.add('view-enter-left');
        fromEl.classList.add('view-exit-right');
      }
    } else {
      toEl.classList.add('view-enter-right');
      fromEl.classList.add('view-exit-right');
    }

    setTimeout(function () {
      fromEl.classList.add('hidden');
      fromEl.classList.remove('view-exit-left', 'view-exit-right');
      toEl.classList.remove('view-enter-left', 'view-enter-right');
      currentView = name;
      animating = false;

      window.scrollTo({ top: 0, behavior: 'auto' });

      var navBtns = document.querySelectorAll('.main-nav-btn');
      for (var i = 0; i < navBtns.length; i++) {
        navBtns[i].classList.toggle('active', navBtns[i].getAttribute('data-view') === name);
      }
    }, 380);
  }

  function updateSegmented(container, value) {
    if (!container) return;
    var buttons = container.querySelectorAll('button[data-value]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var isActive = btn.getAttribute('data-value') === String(value);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    }
  }

  function syncSettingsUI(settings) {
    var groups = document.querySelectorAll('[data-setting]');
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var key = group.getAttribute('data-setting');
      var val = settings[key];
      if (val !== undefined) updateSegmented(group, val);
    }
  }

  App.UI = {
    els: els,
    cacheElements: cacheElements,
    showToast: showToast,
    showModal: showModal,
    renderImages: renderImages,
    renderRecords: renderRecords,
    showView: showView,
    getCurrentView: function () { return currentView; },
    updateSegmented: updateSegmented,
    syncSettingsUI: syncSettingsUI
  };

  console.log('[ui] loaded');
})();

// cacheElements
// showView 