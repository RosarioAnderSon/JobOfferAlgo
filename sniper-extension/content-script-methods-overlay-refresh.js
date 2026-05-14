(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logVerbose = logs.logVerbose || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.copyTextToClipboard = async function(text) {
    const value = String(text || '').trim();
    if (!value) return false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
      logError('DETAIL', 'Clipboard API failed, trying fallback', error);
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      logError('DETAIL', 'execCommand copy failed', error);
    }

    textarea.remove();
    return copied;
  };

  UpworkSniperExtension.prototype.refreshOverlaysFromCache = function() {
    const overlays = Array.from(document.querySelectorAll('.sniper-overlay'));
    overlays.forEach((overlay) => overlay.remove());
    this.applyCachedOverlaysToFeed();
    this.renderGlobalMissingSkillsSidebar();
  };

  UpworkSniperExtension.prototype.updateAllScoresInPlace = function(newWeights) {
    const cache = typeof this.loadCache === 'function' ? this.loadCache() : {};
    const overlays = document.querySelectorAll('.sniper-overlay');
    overlays.forEach((overlay) => {
      const jobId = overlay.getAttribute('data-job-id');
      if (!jobId) return;
      const entry =
        typeof this.resolveCachedEntryForJobId === 'function'
          ? this.resolveCachedEntryForJobId(jobId, cache)?.entry
          : cache[jobId];
      if (entry && entry.rawData && typeof window.SniperCoreEvaluate === 'function') {
        const result = window.SniperCoreEvaluate(entry.rawData, newWeights);
        if (typeof this.setCachedResult === 'function') {
          this.setCachedResult(jobId, result, entry.rawData);
        }

        const oldScore = overlay.querySelector('.sniper-score');
        if (oldScore && typeof this.createScoreBadge === 'function') {
          const newScore = this.createScoreBadge(result, entry.rawData);
          overlay.replaceChild(newScore, oldScore);
        }
      }
    });
  };
})();
