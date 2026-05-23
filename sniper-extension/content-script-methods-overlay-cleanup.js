(() => {
  'use strict';
  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const buildOverlayDecisionPayload = (instance, rawOverlayJobId, rawResolvedCardJobId, removeReason) => {
    const overlayRaw = String(rawOverlayJobId || '').trim();
    const resolvedRaw = String(rawResolvedCardJobId || '').trim();
    const normalizedOverlay =
      typeof instance.normalizeJobIdForCompare === 'function'
        ? instance.normalizeJobIdForCompare(overlayRaw)
        : overlayRaw;
    const normalizedResolved =
      typeof instance.normalizeJobIdForCompare === 'function'
        ? instance.normalizeJobIdForCompare(resolvedRaw)
        : resolvedRaw;
    const variantsOverlay =
      typeof instance.getComparableJobIdVariants === 'function'
        ? Array.from(instance.getComparableJobIdVariants(overlayRaw))
        : overlayRaw
          ? [overlayRaw]
          : [];
    const variantsResolved =
      typeof instance.getComparableJobIdVariants === 'function'
        ? Array.from(instance.getComparableJobIdVariants(resolvedRaw))
        : resolvedRaw
          ? [resolvedRaw]
          : [];
    return {
      rawOverlayJobId: overlayRaw || null,
      rawResolvedCardJobId: resolvedRaw || null,
      normalizedOverlayJobId: normalizedOverlay || null,
      normalizedResolvedCardJobId: normalizedResolved || null,
      variantsOverlay,
      variantsResolved,
      removeReason: String(removeReason || ''),
    };
  };
  const sameJobId = (instance, left, right) => {
    if (typeof instance.isSameJobId === 'function') return instance.isSameJobId(left, right);
    return String(left || '').trim() === String(right || '').trim();
  };
  const emitFlow = (instance, phase, payload) => {
    if (typeof instance.flow !== 'function') return;
    instance.flow(phase, payload);
    if (phase === 'overlay-removed') {
      const removeReason = String(payload?.removeReason || '');
      if (removeReason.startsWith('orphan')) {
        instance.flow('cleanup-orphan-remove', {
          jobId: payload?.rawOverlayJobId || null,
          reason: removeReason,
        });
      }
    }
  };

  UpworkSniperExtension.prototype.findOverlayForJob = function(card, targetJobId) {
    if (!card || !targetJobId) return null;
    return Array.from(card.querySelectorAll('.sniper-overlay[data-job-id]')).find((overlay) =>
      sameJobId(this, overlay.getAttribute('data-job-id'), targetJobId)
    ) || null;
  };

  UpworkSniperExtension.prototype.removeOverlaysForJob = function(card, targetJobId, reason = 'remove-job-ui') {
    if (!card || !targetJobId) return 0;
    let removed = 0;
    Array.from(card.querySelectorAll('.sniper-overlay, .sniper-left-panel')).forEach((el) => {
      const rawJobId = el.getAttribute('data-job-id');
      if (rawJobId && !sameJobId(this, rawJobId, targetJobId)) return;
      emitFlow(this, 'overlay-removed', buildOverlayDecisionPayload(this, rawJobId, targetJobId, reason));
      el.remove();
      removed += 1;
    });
    this.markCardJobId(card, targetJobId);
    return removed;
  };

  UpworkSniperExtension.prototype.cleanupOverlays = function(card, targetJobId = null) {
    if (!card) return;
    const clean = (selector, type) => {
      let kept = false;
      Array.from(card.querySelectorAll(selector)).forEach((el) => {
        const rawJobId = el.getAttribute('data-job-id');
        const isLegacy = !rawJobId;
        if (!targetJobId) {
          if (!isLegacy) return;
          emitFlow(this, 'overlay-removed', buildOverlayDecisionPayload(this, rawJobId, null, `cleanup-general-legacy-${type}`));
          el.remove();
          return;
        }
        if (isLegacy || !sameJobId(this, rawJobId, targetJobId)) {
          const mismatch = type === 'panel' ? 'cleanup-target-panel-jobid-mismatch' : 'cleanup-target-jobid-mismatch';
          const reason = isLegacy ? `cleanup-target-legacy-${type}` : mismatch;
          emitFlow(this, 'overlay-removed', buildOverlayDecisionPayload(this, rawJobId, targetJobId, reason));
          el.remove();
          return;
        }
        if (kept) {
          emitFlow(this, 'overlay-removed', buildOverlayDecisionPayload(this, rawJobId, targetJobId, `cleanup-target-duplicate-${type}`));
          el.remove();
          return;
        }
        kept = true;
        emitFlow(this, 'overlay-retained-check', buildOverlayDecisionPayload(this, rawJobId, targetJobId, `cleanup-target-keep-${type}`));
      });
    };
    clean('.sniper-overlay', 'overlay');
    clean('.sniper-left-panel', 'panel');
    if (targetJobId) this.markCardJobId(card, targetJobId);
  };

  UpworkSniperExtension.prototype.removeOrphanOverlays = function() {
    const isInsideModal = (el) =>
      el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');

    const overlays = Array.from(document.querySelectorAll('.sniper-overlay'));
    overlays.forEach((overlay) => {
      const card = overlay.closest(
        'div.air3-card, section.air3-card-section, article.job-tile, [data-test="job-tile"]'
      );
      if (!card || isInsideModal(card)) {
        emitFlow(
          this,
          'overlay-removed',
          buildOverlayDecisionPayload(this, overlay.getAttribute('data-job-id'), null, 'orphan-no-card-or-modal')
        );
        overlay.remove();
        return;
      }

      const overlayJobId = overlay.getAttribute('data-job-id');
      if (!overlayJobId) {
        emitFlow(
          this,
          'overlay-removed',
          buildOverlayDecisionPayload(this, overlayJobId, null, 'orphan-overlay-without-jobid')
        );
        overlay.remove();
        return;
      }

      let resolvedCardJobId = this.getMarkedCardJobId(card, overlayJobId);
      if (!resolvedCardJobId) resolvedCardJobId = this.getCardJobId(card);

      if (!resolvedCardJobId) {
        // DOM virtualizado: conserva overlay hasta poder resolver el job real.
        emitFlow(
          this,
          'overlay-retained-check',
          buildOverlayDecisionPayload(this, overlayJobId, null, 'orphan-card-jobid-unresolved')
        );
        return;
      }

      if (!sameJobId(this, resolvedCardJobId, overlayJobId)) {
        emitFlow(
          this,
          'overlay-removed',
          buildOverlayDecisionPayload(this, overlayJobId, resolvedCardJobId, 'orphan-jobid-mismatch')
        );
        overlay.remove();
        return;
      }
      emitFlow(
        this,
        'overlay-retained-check',
        buildOverlayDecisionPayload(this, overlayJobId, resolvedCardJobId, 'orphan-jobid-matched')
      );
    });

    const panels = Array.from(document.querySelectorAll('.sniper-left-panel'));
    panels.forEach((panel) => {
      const card = panel.closest(
        'div.air3-card, section.air3-card-section, article.job-tile, [data-test="job-tile"]'
      );
      if (!card || isInsideModal(card)) {
        emitFlow(
          this,
          'overlay-removed',
          buildOverlayDecisionPayload(this, panel.getAttribute('data-job-id'), null, 'orphan-panel-no-card-or-modal')
        );
        panel.remove();
        return;
      }

      const panelJobId = panel.getAttribute('data-job-id');
      if (!panelJobId) {
        emitFlow(
          this,
          'overlay-removed',
          buildOverlayDecisionPayload(this, panelJobId, null, 'orphan-panel-without-jobid')
        );
        panel.remove();
        return;
      }

      let resolvedCardJobId = this.getMarkedCardJobId(card, panelJobId);
      if (!resolvedCardJobId) resolvedCardJobId = this.getCardJobId(card);
      if (!resolvedCardJobId) {
        emitFlow(
          this,
          'overlay-retained-check',
          buildOverlayDecisionPayload(this, panelJobId, null, 'orphan-panel-card-jobid-unresolved')
        );
        return;
      }
      if (!sameJobId(this, resolvedCardJobId, panelJobId)) {
        emitFlow(
          this,
          'overlay-removed',
          buildOverlayDecisionPayload(this, panelJobId, resolvedCardJobId, 'orphan-panel-jobid-mismatch')
        );
        panel.remove();
        return;
      }
      emitFlow(
        this,
        'overlay-retained-check',
        buildOverlayDecisionPayload(this, panelJobId, resolvedCardJobId, 'orphan-panel-jobid-matched')
      );
    });
  };

  UpworkSniperExtension.prototype.resolveOuterCard = function(card) {
    if (!card) return card;
    const isCardWrapper = (el) => {
      if (!el || !(el instanceof Element)) return false;
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) return false;

      const hasClass = (name) => el.classList && el.classList.contains(name);

      if (hasClass('air3-card')) return true;
      if (hasClass('job-tile') && !hasClass('job-tile-title') && !hasClass('job-tile-list')) return true;
      if (el.hasAttribute('data-test') && el.getAttribute('data-test') === 'job-tile') return true;
      return false;
    };

    let current = card;
    let fallback = null;
    for (let depth = 0; current && current !== document.body && depth < 5; depth += 1) {
      if (isCardWrapper(current)) {
        if (current.classList && current.classList.contains('air3-card')) return current;
        fallback = fallback || current;
      }
      current = current.parentElement;
    }
    return fallback || card;
  };
})();
