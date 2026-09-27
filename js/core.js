/**
 * core
 * Global namespace and error handlers.
 */

(function () {
  'use strict';

  window.App = window.App || {};

  window.addEventListener('error', function (e) {
    console.error('[App Error]', e.message, 'at', e.filename, ':', e.lineno);
  });

  window.addEventListener('unhandledrejection', function (e) {
    console.error('[App Promise Rejection]', e.reason);
  });

  console.log('[core] loaded');
})();