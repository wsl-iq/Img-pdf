/**
 * suggest
 * Recommend PDF settings based on image aspect ratios.
 */

(function () {
  'use strict';

  var App = window.App;

  App.Suggest = {
    suggestSettings: function (items) {
      if (!items || !items.length) return null;

      var total = items.length;
      var portrait = 0;
      var landscape = 0;
      var square = 0;

      items.forEach(function (it) {
        var r = it.width / it.height;
        if (r > 1.1) landscape++;
        else if (r < 0.9) portrait++;
        else square++;
      });

      if (portrait >= landscape + square) {
        return {
          orientation: 'portrait',
          reason: 'معظم صورك طولية - ننصح بـ A4 طولي'
        };
      }

      if (landscape >= portrait + square) {
        return {
          orientation: 'landscape',
          reason: 'معظم صورك عرضية - ننصح بـ A4 عرضي'
        };
      }

      return {
        orientation: 'auto',
        reason: 'صورك متنوعة - ننصح بالوضع التلقائي'
      };
    }
  };

  console.log('[suggest] loaded');
})();