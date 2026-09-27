/**
 * stats
 * SVG-based weekly chart from recent operations.
 */

(function () {
  'use strict';

  var App = window.App;

  App.Stats = {
    buildWeeklyChart: function (operations) {
      var days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      var counts = [0, 0, 0, 0, 0, 0, 0];

      var now = Date.now();
      var weekAgo = now - 7 * 24 * 60 * 60 * 1000;

      (operations || []).forEach(function (op) {
        var t = new Date(op.date).getTime();
        if (t >= weekAgo) {
          var d = new Date(op.date).getDay();
          counts[d] += op.imageCount || 1;
        }
      });

      var max = 1;
      for (var i = 0; i < counts.length; i++) {
        if (counts[i] > max) max = counts[i];
      }

      var W = 320;
      var H = 120;
      var pad = 20;
      var barW = (W - pad * 2) / 7 - 6;

      var bars = '';
      for (var j = 0; j < counts.length; j++) {
        var v = counts[j];
        var h = (v / max) * (H - pad * 2);
        var x = pad + j * ((W - pad * 2) / 7) + 3;
        var y = H - pad - h;

        bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h +
          '" rx="4" fill="var(--accent)" opacity="' + (v ? 0.9 : 0.15) + '"/>';

        bars += '<text x="' + (x + barW / 2) + '" y="' + (H - 4) +
          '" text-anchor="middle" font-size="10" fill="var(--text-muted)">' + days[j] + '</text>';

        if (v) {
          bars += '<text x="' + (x + barW / 2) + '" y="' + (y - 4) +
            '" text-anchor="middle" font-size="10" fill="var(--text)">' + v + '</text>';
        }
      }

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" width="100%" height="auto">' +
        bars + '</svg>';
    }
  };

  console.log('[stats] loaded');
})();