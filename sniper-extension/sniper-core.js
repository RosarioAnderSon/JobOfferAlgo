(() => {
  'use strict';

  const evaluateSniper = window.SniperCoreEvaluate;
  if (typeof evaluateSniper !== 'function') return;

  const api = { evaluateSniper };
  const root =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
        ? window
        : typeof self !== 'undefined'
          ? self
          : this;

  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = api;
  }

  if (root) {
    root.evaluateSniper = evaluateSniper;
  }
})();
