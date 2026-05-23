(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logVerbose = logs.logVerbose || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.injectOverlay = function(card, result, rawData, jobId = null) {
    const overlay = document.createElement('div');
    overlay.className = 'sniper-overlay';
    const targetCard = typeof this.resolveOuterCard === 'function' ? this.resolveOuterCard(card) : card;

    if (jobId) {
      overlay.setAttribute('data-job-id', jobId);
      this.markCardJobId(card, jobId);
      if (targetCard && targetCard !== card) this.markCardJobId(targetCard, jobId);
    }

    const displayBadges = [...(result.badges || [])];
    if (rawData?.supportAvgBadge) displayBadges.push('Niche Avg/hr');
    if (rawData?.skillsMatch) displayBadges.push('Skills match');
    logVerbose('DETAIL', `Badges emitidos (${jobId || 'N/A'}): ${displayBadges.join(' | ')}`);
    if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
      this.diagBadge(`emit jobId=${jobId || 'N/A'} badgeCount=${displayBadges.length}`, displayBadges);
    }

    displayBadges.sort((a, b) => {
      const typeWeight = { 'good': 1, 'bad': 2, 'neutral': 3 };
      const typeA = (this.getBadgeConfig(a, rawData) || {}).type || 'neutral';
      const typeB = (this.getBadgeConfig(b, rawData) || {}).type || 'neutral';
      return (typeWeight[typeA] || 3) - (typeWeight[typeB] || 3);
    });

    const renderedBadges = [];
    const aliasMappedBadges = [];
    const unknownBadges = [];

    displayBadges.forEach((badge) => {
      const config = this.getBadgeConfig(badge, rawData) || {};
      const meta = config._badgeMeta || {};
      const resolved = meta.resolvedBadge || badge;
      renderedBadges.push(resolved);
      if (meta.mappedByAlias) {
        aliasMappedBadges.push(`${badge} -> ${resolved}`);
      }
      if (meta.unknown) {
        unknownBadges.push(badge);
      }
    });
    logVerbose('DETAIL', `Badges renderizados (${jobId || 'N/A'}): ${renderedBadges.join(' | ')}`);
    if (aliasMappedBadges.length > 0) {
      logVerbose('DETAIL', `Badges alias-map (${jobId || 'N/A'}): ${aliasMappedBadges.join(' | ')}`);
    }
    if (unknownBadges.length > 0) {
      logVerbose('DETAIL', `Badges unknown (${jobId || 'N/A'}): ${unknownBadges.join(' | ')}`);
    }
    if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
      this.diagBadge(`render jobId=${jobId || 'N/A'} badgeCount=${renderedBadges.length}`, renderedBadges);
      if (aliasMappedBadges.length > 0) {
        this.diagBadge(`alias jobId=${jobId || 'N/A'} count=${aliasMappedBadges.length}`, aliasMappedBadges);
      }
      if (unknownBadges.length > 0) {
        this.diagBadge(`unknown jobId=${jobId || 'N/A'} count=${unknownBadges.length}`, unknownBadges);
      }
    }

    // Single compact badge counter with hover panel
    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'sniper-badges';

    if (displayBadges.length > 0) {
      // Single counter badge
      const counterEl = document.createElement('span');
      counterEl.className = 'sniper-badge-counter';
      counterEl.textContent = displayBadges.length;
      badgesContainer.appendChild(counterEl);

      // Hover panel with all badge details
      const panel = document.createElement('div');
      panel.className = 'sniper-badges-panel';

      displayBadges.forEach((badge) => {
        const config = this.getBadgeConfig(badge, rawData) || {};
        const meta = config._badgeMeta || {};

        const item = document.createElement('div');
        item.className = 'sniper-badges-panel-item';

        const iconWrap = document.createElement('span');
        iconWrap.className = `sniper-badges-panel-icon ${config.type || 'neutral'}`;
        if (config.iconSvg) {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(config.iconSvg, 'image/svg+xml');
          if (svgDoc.documentElement.nodeName !== 'parsererror') {
            iconWrap.appendChild(svgDoc.documentElement);
          }
        } else {
          iconWrap.textContent = config.icon || '';
        }

        const textWrap = document.createElement('div');
        textWrap.className = 'sniper-badges-panel-text';

        const nameEl = document.createElement('div');
        nameEl.className = 'sniper-badges-panel-name';
        nameEl.textContent = config.tooltipTitle || meta.resolvedBadge || badge;

        const descEl = document.createElement('div');
        descEl.className = 'sniper-badges-panel-desc';
        descEl.textContent = config.description || '';

        textWrap.appendChild(nameEl);
        textWrap.appendChild(descEl);

        item.appendChild(iconWrap);
        item.appendChild(textWrap);
        panel.appendChild(item);
      });

      badgesContainer.appendChild(panel);
    }

    const scoreEl = this.createScoreBadge(result, rawData);
    const settingsEl = this.createSettingsButton(jobId);

    overlay.appendChild(badgesContainer);
    overlay.appendChild(scoreEl);
    overlay.appendChild(settingsEl);

    targetCard.style.position = 'relative';
    if (jobId && typeof this.removeOverlaysForJob === 'function') {
      this.removeOverlaysForJob(targetCard, jobId, 'inject-overlay-replace');
    }
    targetCard.appendChild(overlay);
    this.renderGlobalMissingSkillsSidebar();
  };
})();
