(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logVerbose = logs.logVerbose || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.extractJobIdFromHref = function(href) {
    const source = String(href || '');
    if (!source) return null;
    const match = source.match(/~([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  };

  UpworkSniperExtension.prototype.getFeedJobLinks = function(root) {
    const scope = root || document;
    return Array.from(scope.querySelectorAll('a[href*="~"]'));
  };

  UpworkSniperExtension.prototype.getFeedJobCards = function(root) {
    const scope = root || document;
    const isInsideModal = (el) =>
      el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');

    const cards = [];
    const seen = new Set();
    const addCard = (node) => {
      if (!(node instanceof Element)) return;
      if (isInsideModal(node)) return;
      if (seen.has(node)) return;
      seen.add(node);
      cards.push(node);
    };

    const strongSelectors = [
      'section.air3-card-section',
      'article.job-tile',
      '[data-test="job-tile"]',
      '[data-test*="job-tile"]',
      '[class*="job-tile"]',
    ];
    strongSelectors.forEach((selector) => {
      scope.querySelectorAll(selector).forEach((el) => addCard(el));
    });

    const links = this.getFeedJobLinks(scope);
    links.forEach((link) => {
      const candidate = link.closest(
        '[data-test="job-tile"], [data-test*="job-tile"], section.air3-card-section, article.job-tile, [class*="job-tile"], article[class*="job"], section[class*="job"]'
      );
      if (candidate) addCard(candidate);
    });

    return cards;
  };

  UpworkSniperExtension.prototype.getCardJobId = function(card) {
    if (!card) return null;

    const stableAttr = card.getAttribute('data-sniper-job-id');
    if (stableAttr) return stableAttr;

    const directAttrs = ['data-job-id', 'data-opening-uid', 'data-ev-opening_uid'];
    for (const attr of directAttrs) {
      const value = card.getAttribute(attr);
      if (value && /^[A-Za-z0-9]+$/.test(value)) {
        if (value.startsWith('0') || value.length >= 20) return value;
      }
    }

    const links = this.getFeedJobLinks(card);
    for (const link of links) {
      const jobId = this.extractJobIdFromHref(link.getAttribute('href') || link.href || '');
      if (jobId) return jobId;
    }

    return null;
  };

  UpworkSniperExtension.prototype.markCardJobId = function(card, jobId) {
    if (!card || !jobId) return;
    card.setAttribute('data-sniper-job-id', jobId);
  };

  UpworkSniperExtension.prototype.cleanupOverlays = function(card, targetJobId = null) {
    if (!card) return;

    const overlays = Array.from(card.querySelectorAll('.sniper-overlay'));
    let keptOverlayForTarget = false;
    overlays.forEach((overlay) => {
      const overlayJobId = overlay.getAttribute('data-job-id');
      const isLegacy = !overlayJobId;
      // En limpieza dirigida por card: mantener solo 1 overlay del targetJobId.
      if (targetJobId) {
        if (isLegacy || overlayJobId !== targetJobId) {
          overlay.remove();
          return;
        }
        if (keptOverlayForTarget) {
          overlay.remove();
          return;
        }
        keptOverlayForTarget = true;
        return;
      }

      // Limpieza general (sin target): solo legacy.
      if (isLegacy) {
        overlay.remove();
      }
    });

    const panels = Array.from(card.querySelectorAll('.sniper-left-panel'));
    let keptPanelForTarget = false;
    panels.forEach((panel) => {
      const panelJobId = panel.getAttribute('data-job-id');
      const isLegacy = !panelJobId;
      // En limpieza dirigida por card: mantener solo 1 panel del targetJobId.
      if (targetJobId) {
        if (isLegacy || panelJobId !== targetJobId) {
          panel.remove();
          return;
        }
        if (keptPanelForTarget) {
          panel.remove();
          return;
        }
        keptPanelForTarget = true;
        return;
      }

      // Limpieza general (sin target): solo legacy.
      if (isLegacy) {
        panel.remove();
      }
    });

    if (targetJobId) this.markCardJobId(card, targetJobId);
  };

  UpworkSniperExtension.prototype.removeOrphanOverlays = function() {
    const isInsideModal = (el) =>
      el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');

    const overlays = Array.from(document.querySelectorAll('.sniper-overlay'));
    overlays.forEach((overlay) => {
      const card = overlay.closest(
        'section.air3-card-section, article.job-tile, [data-test="job-tile"], [data-test*="job-tile"], [class*="job-tile"], article[class*="job"], section[class*="job"]'
      );
      if (!card || isInsideModal(card)) {
        overlay.remove();
        return;
      }

      const overlayJobId = overlay.getAttribute('data-job-id');
      if (!overlayJobId) {
        overlay.remove();
        return;
      }

      // Usar data-sniper-job-id como fuente de verdad (se guardó en tick 1)
      let resolvedCardJobId = card.getAttribute('data-sniper-job-id');
      if (!resolvedCardJobId) {
        // Fallback: intenta extraerlo nuevamente si el atributo no existe
        resolvedCardJobId = this.getCardJobId(card);
      }

      if (!resolvedCardJobId) {
        // DOM virtualizado: conserva overlay hasta poder resolver el job real.
        return;
      }

      if (resolvedCardJobId !== overlayJobId) {
        overlay.remove();
      }
    });

    const panels = Array.from(document.querySelectorAll('.sniper-left-panel'));
    panels.forEach((panel) => {
      const card = panel.closest(
        'section.air3-card-section, article.job-tile, [data-test="job-tile"], [data-test*="job-tile"], [class*="job-tile"], article[class*="job"], section[class*="job"]'
      );
      if (!card || isInsideModal(card)) {
        panel.remove();
        return;
      }

      const panelJobId = panel.getAttribute('data-job-id');
      if (!panelJobId) {
        panel.remove();
        return;
      }

      // Usar data-sniper-job-id como fuente de verdad
      let resolvedCardJobId = card.getAttribute('data-sniper-job-id');
      if (!resolvedCardJobId) {
        resolvedCardJobId = this.getCardJobId(card);
      }
      if (!resolvedCardJobId) return;
      if (resolvedCardJobId !== panelJobId) panel.remove();
    });
  };

  UpworkSniperExtension.prototype.injectOverlay = function(card, result, rawData, jobId = null) {
    const overlay = document.createElement('div');
    overlay.className = 'sniper-overlay';

    if (jobId) {
      overlay.setAttribute('data-job-id', jobId);
      this.markCardJobId(card, jobId);
    }

    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'sniper-badges';

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
      const badgeEl = this.createBadge(badge, rawData);
      const resolved = badgeEl.getAttribute('data-badge-resolved') || badge;
      renderedBadges.push(resolved);
      if (badgeEl.getAttribute('data-badge-alias') === '1') {
        aliasMappedBadges.push(`${badge} -> ${resolved}`);
      }
      if (badgeEl.getAttribute('data-badge-unknown') === '1') {
        unknownBadges.push(badge);
      }
      badgesContainer.appendChild(badgeEl);
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

    const scoreEl = this.createScoreBadge(result, rawData);
    const settingsEl = this.createSettingsButton(jobId);

    overlay.appendChild(badgesContainer);
    overlay.appendChild(scoreEl);
    overlay.appendChild(settingsEl);

    card.style.position = 'relative';
    card.appendChild(overlay);
    this.renderGlobalMissingSkillsSidebar();
  };

  UpworkSniperExtension.prototype.createSettingsButton = function(jobId = null) {
    const wrap = document.createElement('div');
    wrap.className = 'sniper-settings-wrap';
    const feedbackEmail = 'anderrosariotav@gmail.com';

    const btn = document.createElement('button');
    btn.className = 'sniper-settings-btn';
    btn.type = 'button';
    btn.title = this.t('settings');
    btn.textContent = '\u2699';
    if (!this.hasSeenWeightsUpdate()) {
      btn.classList.add('has-update');
    }
    wrap.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'sniper-settings-panel';
    if (this.settingsPanelOpenJobId && this.settingsPanelOpenJobId === jobId) {
      panel.classList.add('open');
      this.settingsPanelOpenJobId = null;
    }
    const langLabel = document.createElement('div');
    langLabel.className = 'sniper-settings-label';
    langLabel.textContent = this.t('language');
    panel.appendChild(langLabel);

    const langRow = document.createElement('div');
    langRow.className = 'sniper-settings-lang-row';
    const btnEn = document.createElement('button');
    btnEn.type = 'button';
    btnEn.className = 'sniper-lang-btn';
    btnEn.setAttribute('data-lang', 'en');
    btnEn.textContent = 'EN';
    const btnEs = document.createElement('button');
    btnEs.type = 'button';
    btnEs.className = 'sniper-lang-btn';
    btnEs.setAttribute('data-lang', 'es');
    btnEs.textContent = 'ES';
    langRow.appendChild(btnEn);
    langRow.appendChild(btnEs);
    panel.appendChild(langRow);

    const nicheLabel = document.createElement('div');
    nicheLabel.className = 'sniper-settings-label';
    nicheLabel.textContent = this.t('niche');
    panel.appendChild(nicheLabel);

    const nicheSelectEl = document.createElement('select');
    nicheSelectEl.className = 'sniper-settings-select sniper-niche-select';
    const optService = document.createElement('option');
    optService.value = 'customer_service';
    optService.textContent = this.t('nicheCustomerService');
    const optSupport = document.createElement('option');
    optSupport.value = 'customer_support';
    optSupport.textContent = this.t('nicheCustomerSupport');
    const optSpecialist = document.createElement('option');
    optSpecialist.value = 'customer_specialist';
    optSpecialist.textContent = this.t('nicheCustomerSpecialist');
    nicheSelectEl.appendChild(optService);
    nicheSelectEl.appendChild(optSupport);
    nicheSelectEl.appendChild(optSpecialist);
    panel.appendChild(nicheSelectEl);

    const weightsLabel = document.createElement('div');
    weightsLabel.className = `sniper-settings-label sniper-weights-label ${!this.hasSeenWeightsUpdate() ? 'has-update' : ''}`;
    const weightsLabelRow = document.createElement('div');
    weightsLabelRow.className = 'sniper-weights-label-row';
    const weightsLabelText = document.createElement('span');
    weightsLabelText.className = 'sniper-weights-label-text';
    weightsLabelText.textContent = this.t('scoreWeightsTitle');
    const weightsInfoWrap = document.createElement('span');
    weightsInfoWrap.className = 'sniper-weights-info-wrap';
    const weightsInfoTrigger = document.createElement('button');
    weightsInfoTrigger.type = 'button';
    weightsInfoTrigger.className = 'sniper-weights-info-trigger';
    weightsInfoTrigger.textContent = 'i';
    weightsInfoTrigger.setAttribute('aria-label', this.t('scoreWeightsTitle'));
    const weightsInfoTooltip = document.createElement('div');
    weightsInfoTooltip.className = 'sniper-weights-info-tooltip';
    weightsInfoTooltip.setAttribute('role', 'tooltip');
    weightsInfoWrap.appendChild(weightsInfoTrigger);
    weightsInfoWrap.appendChild(weightsInfoTooltip);
    weightsLabelRow.appendChild(weightsLabelText);
    weightsLabelRow.appendChild(weightsInfoWrap);
    weightsLabel.appendChild(weightsLabelRow);
    panel.appendChild(weightsLabel);

    const weightsContainerEl = document.createElement('div');
    weightsContainerEl.className = 'sniper-weights-container';
    panel.appendChild(weightsContainerEl);

    const weightsActions = document.createElement('div');
    weightsActions.className = 'sniper-weights-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sniper-save-weights-btn';
    saveBtn.textContent = this.t('saveWeights');
    const resetWeightsBtnEl = document.createElement('button');
    resetWeightsBtnEl.type = 'button';
    resetWeightsBtnEl.className = 'sniper-reset-weights-btn';
    resetWeightsBtnEl.textContent = this.t('resetWeights');
    weightsActions.appendChild(saveBtn);
    weightsActions.appendChild(resetWeightsBtnEl);
    panel.appendChild(weightsActions);

    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'sniper-settings-feedback';
    feedbackDiv.style.marginTop = '8px';
    feedbackDiv.textContent = this.t('feedback') + ' ';
    const feedbackLinkEl = document.createElement('a');
    feedbackLinkEl.href = '#';
    feedbackLinkEl.className = 'sniper-feedback-email';
    feedbackLinkEl.setAttribute('data-email', feedbackEmail);
    feedbackLinkEl.title = this.t('copyEmail');
    feedbackLinkEl.textContent = feedbackEmail;
    feedbackDiv.appendChild(feedbackLinkEl);
    panel.appendChild(feedbackDiv);

    const resetSkillsBtn = document.createElement('button');
    resetSkillsBtn.type = 'button';
    resetSkillsBtn.className = 'sniper-reset-skills-btn';
    resetSkillsBtn.textContent = this.t('resetSkills');
    panel.appendChild(resetSkillsBtn);

    const copyStatusEl = document.createElement('div');
    copyStatusEl.className = 'sniper-settings-copy-status';
    copyStatusEl.setAttribute('aria-live', 'polite');
    panel.appendChild(copyStatusEl);
    wrap.appendChild(panel);

    const weightsContainer = weightsContainerEl;
    const currentWeights = this.getScoreWeights();
    const weightKeys = ['hireRate', 'spend', 'rating', 'activity', 'proposals', 'payment', 'jobs'];
    const weightLabels = {
      hireRate: this.t('hireRate'),
      spend: this.t('spend'),
      rating: this.t('rating'),
      activity: this.t('activity'),
      proposals: this.t('proposals'),
      payment: this.t('payment'),
      jobs: this.t('jobsPosted'),
    };

    const formatWeightTotal = (value) => {
      if (!Number.isFinite(value)) return '0';
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    };

    const getCurrentTotalWeight = () => {
      const liveInputs = Array.from(
        weightsContainer.querySelectorAll('.sniper-weight-input[data-type="weight"]')
      );
      if (liveInputs.length > 0) {
        return liveInputs.reduce((sum, input) => {
          const parsed = parseFloat(input.value);
          return Number.isFinite(parsed) && parsed > 0 ? sum + parsed : sum;
        }, 0);
      }

      return weightKeys.reduce((sum, key) => {
        const parsed = parseFloat(currentWeights[key]?.weight);
        return Number.isFinite(parsed) && parsed > 0 ? sum + parsed : sum;
      }, 0);
    };

    const refreshWeightsTooltip = () => {
      const total = formatWeightTotal(getCurrentTotalWeight());
      const totalLine = this.t('scoreWeightsCurrentTotal').replace('{total}', total);
      weightsInfoTooltip.textContent = `${this.t('scoreWeightsInfo')}\n${totalLine}`;
    };

    const thresholdLabels = {
      hireRate: { A: { label: 'A+', unit: '%' }, B: { label: 'B', unit: '%' }, C: { label: 'C', unit: '%' } },
      spend: { A: { label: 'A+', unit: '$' }, B: { label: 'B', unit: '$' }, C: { label: 'C', unit: '$' } },
      rating: { A: { label: 'A+', unit: 'star' }, min: { label: 'Min', unit: 'star' } },
      activity: { fresh: { label: 'Fresh', unit: 'h' }, recent: { label: 'Recent', unit: 'h' } },
      proposals: { A: { label: 'A+', unit: 'props' }, B: { label: 'B', unit: 'props' }, C: { label: 'C', unit: 'props' } },
      jobs: { A: { label: 'A+', unit: 'jobs' }, B: { label: 'B', unit: 'jobs' } }
    };

    weightKeys.forEach(key => {
      const group = document.createElement('div');
      group.className = 'sniper-weight-group';
      
      const hasThresholds = thresholdLabels[key] && Object.keys(thresholdLabels[key]).length > 0;
      
      const weightVal = currentWeights[key]?.weight ?? 0;

      const weightRow = document.createElement('div');
      weightRow.className = 'sniper-weight-row';

      const wLabel = document.createElement('label');
      if (hasThresholds) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'sniper-threshold-toggle';
        toggleBtn.textContent = '>';
        wLabel.appendChild(toggleBtn);
        wLabel.appendChild(document.createTextNode(' ' + weightLabels[key]));
      } else {
        const spacer = document.createElement('span');
        spacer.style.display = 'inline-block';
        spacer.style.width = '12px';
        wLabel.appendChild(spacer);
        wLabel.appendChild(document.createTextNode(' ' + weightLabels[key]));
      }

      const wInput = document.createElement('input');
      wInput.type = 'number';
      wInput.min = '0';
      wInput.max = '100';
      wInput.setAttribute('data-key', key);
      wInput.setAttribute('data-type', 'weight');
      wInput.value = weightVal;
      wInput.className = 'sniper-weight-input';

      weightRow.appendChild(wLabel);
      weightRow.appendChild(wInput);
      group.appendChild(weightRow);

      if (hasThresholds) {
        const threshObj = currentWeights[key]?.thresholds || {};
        const threshKeys = Object.keys(thresholdLabels[key]);
        
        const threshPanel = document.createElement('div');
        threshPanel.className = 'sniper-thresholds-panel';
        threshPanel.setAttribute('data-threshold-panel', key);
        threshPanel.style.display = 'none';

        threshKeys.forEach(tk => {
          const config = thresholdLabels[key][tk];
          const trRow = document.createElement('div');
          trRow.className = 'sniper-threshold-row';

          const trLabel = document.createElement('span');
          trLabel.textContent = config.label + ' =';

          const trWrap = document.createElement('div');
          trWrap.className = 'sniper-input-wrap';

          const trInput = document.createElement('input');
          trInput.type = 'number';
          trInput.setAttribute('data-key', key);
          trInput.setAttribute('data-thresh', tk);
          trInput.value = threshObj[tk] ?? '';
          trInput.className = 'sniper-weight-input sniper-thresh-input';

          const trUnit = document.createElement('span');
          trUnit.className = 'sniper-input-unit';
          trUnit.textContent = config.unit;

          trWrap.appendChild(trInput);
          trWrap.appendChild(trUnit);
          trRow.appendChild(trLabel);
          trRow.appendChild(trWrap);
          threshPanel.appendChild(trRow);
        });
        
        group.appendChild(threshPanel);
      }

      weightsContainer.appendChild(group);
    });

    refreshWeightsTooltip();

    weightsContainer.addEventListener('input', (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute('data-type') !== 'weight') return;
      refreshWeightsTooltip();
    });

    // Toggle logic
    weightsContainer.addEventListener('click', (ev) => {
      const toggleBtn = ev.target.closest('.sniper-threshold-toggle');
      if (toggleBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        const weightGroup = toggleBtn.closest('.sniper-weight-group');
        const thresholdPanel = weightGroup ? weightGroup.querySelector('.sniper-thresholds-panel') : null;
        if (thresholdPanel) {
          const isHidden = thresholdPanel.style.display === 'none';
          thresholdPanel.style.display = isHidden ? 'block' : 'none';
          toggleBtn.textContent = isHidden ? 'v' : '>';
        }
      }
    });

    const saveWeightsBtn = panel.querySelector('.sniper-save-weights-btn');
    if (saveWeightsBtn) {
      saveWeightsBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const newWeights = JSON.parse(JSON.stringify(currentWeights));
        
        weightsContainer.querySelectorAll('.sniper-weight-input').forEach(input => {
          const key = input.getAttribute('data-key');
          const type = input.getAttribute('data-type');
          const thresh = input.getAttribute('data-thresh');
          
          let val = parseFloat(input.value);
          if (isNaN(val) || val < 0) val = 0;
          
          if (type === 'weight') {
            if (val > 100) val = 100;
            if (!newWeights[key]) newWeights[key] = { weight: 0, thresholds: {} };
            newWeights[key].weight = val;
          } else if (thresh) {
            if (!newWeights[key]) newWeights[key] = { weight: 0, thresholds: {} };
            if (!newWeights[key].thresholds) newWeights[key].thresholds = {};
            newWeights[key].thresholds[thresh] = val;
          }
        });
        
        Object.assign(currentWeights, newWeights);
        this.setScoreWeights(newWeights, true);
        this.updateAllScoresInPlace(newWeights);
        refreshWeightsTooltip();
        
        const copyStatus = panel.querySelector('.sniper-settings-copy-status');
        if(copyStatus) {
           copyStatus.textContent = this.t('weightsSavedDone');
           setTimeout(() => copyStatus.textContent = '', 1800);
        }
      });
    }

    const resetWeightsBtn = panel.querySelector('.sniper-reset-weights-btn');
    if (resetWeightsBtn) {
      resetWeightsBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const defaultW = this.getDefaultWeights();
        this.setScoreWeights(defaultW, true);
        this.updateAllScoresInPlace(defaultW);
        
        // Update local object
        Object.assign(currentWeights, defaultW);
        
        // Update inputs
        weightsContainer.querySelectorAll('.sniper-weight-input').forEach(input => {
          const key = input.getAttribute('data-key');
          const type = input.getAttribute('data-type');
          const thresh = input.getAttribute('data-thresh');
          
          if (type === 'weight') {
            input.value = defaultW[key]?.weight ?? 0;
          } else if (thresh) {
            input.value = defaultW[key]?.thresholds?.[thresh] ?? 0;
          }
        });
        refreshWeightsTooltip();
        const copyStatus = panel.querySelector('.sniper-settings-copy-status');
        if(copyStatus) {
           copyStatus.textContent = this.t('weightsResetDone');
           setTimeout(() => copyStatus.textContent = '', 1800);
        }
      });
    }

    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      
      const isOpening = !panel.classList.contains('open');
      panel.classList.toggle('open');

      if (!isOpening && !this.hasSeenWeightsUpdate()) {
        this.markWeightsUpdateSeen();
        btn.classList.remove('has-update');
        const weightsLabel = panel.querySelector('.sniper-weights-label');
        if (weightsLabel) weightsLabel.classList.remove('has-update');
      }
    });

    panel.querySelectorAll('.sniper-lang-btn').forEach((el) => {
      const lang = el.getAttribute('data-lang');
      if (lang === this.language) el.classList.add('active');
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (lang !== this.language) {
          this.settingsPanelOpenJobId = jobId;
          this.setLanguage(lang);
        }
      });
    });

    const nicheSelect = nicheSelectEl;
    if (nicheSelect) {
      nicheSelect.value = this.getSelectedNiche();
      nicheSelect.addEventListener('change', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setSelectedNiche(nicheSelect.value);
        this.settingsPanelOpenJobId = jobId;
        this.refreshOverlaysFromCache();
      });
    }

    const feedbackLink = panel.querySelector('.sniper-feedback-email');
    const copyStatus = copyStatusEl;
    if (feedbackLink && copyStatus) {
      feedbackLink.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const email = feedbackLink.getAttribute('data-email') || feedbackEmail;
        const copied = await this.copyTextToClipboard(email);
        copyStatus.textContent = copied ? this.t('emailCopied') : this.t('emailCopyFailed');
        copyStatus.classList.toggle('is-error', !copied);
        setTimeout(() => {
          if (copyStatus.textContent === this.t('emailCopied') || copyStatus.textContent === this.t('emailCopyFailed')) {
            copyStatus.textContent = '';
            copyStatus.classList.remove('is-error');
          }
        }, 1800);
      });
    }

    const resetBtn = panel.querySelector('.sniper-reset-skills-btn');
    if (resetBtn && copyStatus) {
      resetBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.resetSkillsTracking();
        copyStatus.textContent = this.t('resetDone');
        copyStatus.classList.remove('is-error');
        this.refreshOverlaysFromCache();
      });
    }

    document.addEventListener(
      'click',
      (event) => {
        if (!panel.classList.contains('open')) return;
        const target = event.target;
        if (target instanceof Node && wrap.contains(target)) return;
        
        panel.classList.remove('open');
        if (!this.hasSeenWeightsUpdate()) {
          this.markWeightsUpdateSeen();
          btn.classList.remove('has-update');
          const weightsLabel = panel.querySelector('.sniper-weights-label');
          if (weightsLabel) weightsLabel.classList.remove('has-update');
        }
      },
      { capture: true }
    );

    panel.addEventListener('click', (ev) => ev.stopPropagation());

    return wrap;
  };

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
      const entry = cache[jobId];
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

  window.__sniperOverlayLoaded = true;
})();
