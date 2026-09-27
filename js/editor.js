/**
 * editor
 * Per-image rotation and brightness/contrast adjustments.
 */

(function () {
  'use strict';

  var App = window.App;
  var Haptics = App.Haptics;

  var currentItem = null;
  var currentTransforms = null;
  var onSaveCallback = null;

  var state = {
    rotation: 0,
    brightness: 1,
    contrast: 1,
    removeWhite: false
  };

  function renderPanel(tab) {
    var panel = document.getElementById('editorPanel');
    if (!panel) return;
    panel.innerHTML = '';

    if (tab === 'rotate') {
      panel.innerHTML =
        '<div class="editor-row">' +
          '<button type="button" class="btn btn-secondary" data-rotate="-90">-90</button>' +
          '<button type="button" class="btn btn-secondary" data-rotate="90">+90</button>' +
          '<button type="button" class="btn btn-secondary" data-rotate="180">180</button>' +
        '</div>' +
        '<div class="editor-row">' +
          '<label class="editor-label">تدوير حر</label>' +
          '<input type="range" id="rotationSlider" min="0" max="360" value="' + state.rotation + '">' +
          '<span class="editor-value">' + state.rotation + '</span>' +
        '</div>';
    } else {
      panel.innerHTML =
        '<div class="editor-row">' +
          '<label class="editor-label">السطوع</label>' +
          '<input type="range" id="brightnessSlider" min="0.5" max="1.5" step="0.05" value="' + state.brightness + '">' +
          '<span class="editor-value">' + Math.round(state.brightness * 100) + '%</span>' +
        '</div>' +
        '<div class="editor-row">' +
          '<label class="editor-label">التباين</label>' +
          '<input type="range" id="contrastSlider" min="0.5" max="1.5" step="0.05" value="' + state.contrast + '">' +
          '<span class="editor-value">' + Math.round(state.contrast * 100) + '%</span>' +
        '</div>' +
        '<div class="editor-row">' +
          '<label class="editor-label" style="min-width:auto">' +
            '<input type="checkbox" id="removeWhiteToggle"' + (state.removeWhite ? ' checked' : '') + '>' +
            ' إزالة الخلفية البيضاء' +
          '</label>' +
        '</div>';
    }

    bindPanelInputs();
  }

  function bindPanelInputs() {
    var rot = document.getElementById('rotationSlider');
    if (rot) {
      rot.oninput = function (e) {
        state.rotation = parseInt(e.target.value, 10);
        applyPreview();
        var val = e.target.closest('.editor-row').querySelector('.editor-value');
        if (val) val.textContent = state.rotation;
      };
    }

    var bri = document.getElementById('brightnessSlider');
    if (bri) {
      bri.oninput = function (e) {
        state.brightness = parseFloat(e.target.value);
        applyPreview();
        var val = e.target.closest('.editor-row').querySelector('.editor-value');
        if (val) val.textContent = Math.round(state.brightness * 100) + '%';
      };
    }

    var con = document.getElementById('contrastSlider');
    if (con) {
      con.oninput = function (e) {
        state.contrast = parseFloat(e.target.value);
        applyPreview();
        var val = e.target.closest('.editor-row').querySelector('.editor-value');
        if (val) val.textContent = Math.round(state.contrast * 100) + '%';
      };
    }

    var rem = document.getElementById('removeWhiteToggle');
    if (rem) {
      rem.onchange = function (e) {
        state.removeWhite = e.target.checked;
        applyPreview();
      };
    }
  }

  function applyPreview() {
    var img = document.getElementById('editorImage');
    if (!img) return;
    img.style.transform = 'rotate(' + state.rotation + 'deg)';
    img.style.filter = 'brightness(' + state.brightness + ') contrast(' + state.contrast + ')';
  }

  function close() {
    var c = document.getElementById('editorContainer');
    if (c) c.innerHTML = '';
    currentItem = null;
    currentTransforms = null;
    onSaveCallback = null;
  }

  function save() {
    if (Haptics) Haptics.success();
    currentTransforms.rotation = state.rotation;
    currentTransforms.brightness = state.brightness;
    currentTransforms.contrast = state.contrast;
    currentTransforms.removeWhite = state.removeWhite;
    if (onSaveCallback) onSaveCallback(currentTransforms);
    close();
  }

  App.Editor = {
    open: function (item, saveCb) {
      currentItem = item;
      currentTransforms = item.transforms ? Object.assign({}, item.transforms) : {};
      currentTransforms.rotation = currentTransforms.rotation || 0;
      currentTransforms.brightness = currentTransforms.brightness === undefined ? 1 : currentTransforms.brightness;
      currentTransforms.contrast = currentTransforms.contrast === undefined ? 1 : currentTransforms.contrast;
      currentTransforms.removeWhite = currentTransforms.removeWhite || false;
      onSaveCallback = saveCb;

      state.rotation = currentTransforms.rotation;
      state.brightness = currentTransforms.brightness;
      state.contrast = currentTransforms.contrast;
      state.removeWhite = currentTransforms.removeWhite;

      var container = document.getElementById('editorContainer');
      if (!container) return;

      container.innerHTML =
        '<div class="editor-overlay">' +
          '<div class="editor-sheet">' +
            '<div class="editor-header">' +
              '<button type="button" class="btn-icon" id="editorCancel" aria-label="إلغاء">' +
                '<svg class="icon"><use href="#ico-close"/></svg>' +
              '</button>' +
              '<h3 class="editor-title">تحرير الصورة</h3>' +
              '<button type="button" class="btn-icon" id="editorSave" aria-label="حفظ">' +
                '<svg class="icon"><use href="#ico-check"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="editor-preview">' +
              '<img id="editorImage" alt="">' +
            '</div>' +
            '<div class="editor-tabs">' +
              '<button type="button" class="editor-tab active" data-tab="rotate">' +
                '<svg class="icon"><use href="#ico-rotate"/></svg> تدوير' +
              '</button>' +
              '<button type="button" class="editor-tab" data-tab="adjust">' +
                '<svg class="icon"><use href="#ico-sliders"/></svg> ضبط' +
              '</button>' +
            '</div>' +
            '<div class="editor-panel" id="editorPanel"></div>' +
          '</div>' +
        '</div>';

      var img = document.getElementById('editorImage');
      img.src = item.url;

      renderPanel('rotate');
      applyPreview();

      container.onclick = function (e) {
        var tab = e.target.closest('.editor-tab');
        if (tab) {
          if (Haptics) Haptics.tap();
          var tabs = container.querySelectorAll('.editor-tab');
          for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
          tab.classList.add('active');
          renderPanel(tab.getAttribute('data-tab'));
          return;
        }

        var rot = e.target.closest('[data-rotate]');
        if (rot) {
          if (Haptics) Haptics.tap();
          var delta = parseInt(rot.getAttribute('data-rotate'), 10);
          state.rotation = (state.rotation + delta + 360) % 360;
          applyPreview();
          var slider = document.getElementById('rotationSlider');
          if (slider) slider.value = state.rotation;
          var val = container.querySelector('.editor-value');
          if (val) val.textContent = state.rotation;
          return;
        }

        if (e.target.closest('#editorCancel')) {
          close();
          return;
        }

        if (e.target.closest('#editorSave')) {
          save();
          return;
        }
      };
    }
  };

  console.log('[editor] loaded');
})();