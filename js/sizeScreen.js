/**
 * sizeScreen
 * Device detection and reactive breakpoints.
 */

(function () {
  'use strict';

  var App = window.App;
  var currentDevice = 'mobile';
  var listeners = [];

  function detect(width) {
    if (width < 600) return 'mobile';
    if (width < 1200) return 'ipad';
    return 'computer';
  }

  function getInfo() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var d = detect(w);
    return {
      device: d,
      width: w,
      height: h,
      isMobile: d === 'mobile',
      isIpad: d === 'ipad',
      isComputer: d === 'computer',
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isPortrait: h > w,
      isLandscape: w > h,
      dpr: window.devicePixelRatio || 1
    };
  }

  function applyAttr(d) {
    if (document.body && document.body.dataset.device !== d) {
      document.body.dataset.device = d;
    }
  }

  function notify(info) {
    listeners.forEach(function (cb) {
      try { cb(info); } catch (e) {}
    });
  }

  function check() {
    var info = getInfo();
    if (info.device !== currentDevice) {
      currentDevice = info.device;
      applyAttr(currentDevice);
    }
    notify(info);
  }

  App.SizeScreen = {
    init: function () {
      var info = getInfo();
      currentDevice = info.device;
      applyAttr(currentDevice);

      var queries = [
        window.matchMedia('(max-width: 599px)'),
        window.matchMedia('(min-width: 600px) and (max-width: 1199px)'),
        window.matchMedia('(min-width: 1200px)')
      ];

      queries.forEach(function (q) {
        if (q.addEventListener) q.addEventListener('change', check);
        else if (q.addListener) q.addListener(check);
      });

      var timer = null;
      window.addEventListener('resize', function () {
        clearTimeout(timer);
        timer = setTimeout(check, 120);
      }, { passive: true });

      window.addEventListener('orientationchange', function () {
        setTimeout(check, 200);
      }, { passive: true });
    },

    get: function () { return currentDevice; },

    info: getInfo,

    onChange: function (cb) {
      listeners.push(cb);
      return function () {
        listeners = listeners.filter(function (l) { return l !== cb; });
      };
    }
  };

  console.log('[sizeScreen] loaded');
})();