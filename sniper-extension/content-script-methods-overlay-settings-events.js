(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;

  UpworkSniperExtension.prototype.bindSettingsPanelEvents = function(view, jobId = null) {
    const { wrap, btn, panel, weightsContainer, nicheSelectEl, copyStatus, feedbackEmail } = view;

    weightsContainer.addEventListener('input', (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute('data-type') !== 'weight') return;
      view.refreshWeightsTooltip();
    });

    weightsContainer.addEventListener('click', (ev) => {
      const toggleBtn = ev.target.closest('.sniper-threshold-toggle');
      if (!toggleBtn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const weightGroup = toggleBtn.closest('.sniper-weight-group');
      const thresholdPanel = weightGroup ? weightGroup.querySelector('.sniper-thresholds-panel') : null;
      if (!thresholdPanel) return;
      const isHidden = thresholdPanel.style.display === 'none';
      thresholdPanel.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? 'v' : '>';
    });

    const saveWeightsBtn = panel.querySelector('.sniper-save-weights-btn');
    saveWeightsBtn?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const newWeights = JSON.parse(JSON.stringify(view.currentWeights));
      weightsContainer.querySelectorAll('.sniper-weight-input').forEach((input) => {
        const key = input.getAttribute('data-key');
        const type = input.getAttribute('data-type');
        const threshold = input.getAttribute('data-thresh');
        let value = parseFloat(input.value);
        if (Number.isNaN(value) || value < 0) value = 0;
        if (!newWeights[key]) newWeights[key] = { weight: 0, thresholds: {} };
        if (type === 'weight') newWeights[key].weight = Math.min(value, 100);
        else if (threshold) newWeights[key].thresholds[threshold] = value;
      });
      Object.assign(view.currentWeights, newWeights);
      this.setScoreWeights(newWeights, true);
      this.updateAllScoresInPlace(newWeights);
      view.refreshWeightsTooltip();
      this.showSettingsStatus(copyStatus, this.t('weightsSavedDone'), false);
    });

    const resetWeightsBtn = panel.querySelector('.sniper-reset-weights-btn');
    resetWeightsBtn?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const defaultWeights = this.getDefaultWeights();
      this.setScoreWeights(defaultWeights, true);
      this.updateAllScoresInPlace(defaultWeights);
      Object.assign(view.currentWeights, defaultWeights);
      weightsContainer.querySelectorAll('.sniper-weight-input').forEach((input) => {
        const key = input.getAttribute('data-key');
        const type = input.getAttribute('data-type');
        const threshold = input.getAttribute('data-thresh');
        input.value = type === 'weight'
          ? defaultWeights[key]?.weight ?? 0
          : defaultWeights[key]?.thresholds?.[threshold] ?? 0;
      });
      view.refreshWeightsTooltip();
      this.showSettingsStatus(copyStatus, this.t('weightsResetDone'), false);
    });

    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const isOpening = !panel.classList.contains('open');
      panel.classList.toggle('open');
      if (!isOpening) this.markSettingsUpdateSeen(btn, panel);
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

    nicheSelectEl.value = this.getSelectedNiche();
    nicheSelectEl.addEventListener('change', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.setSelectedNiche(nicheSelectEl.value);
      this.settingsPanelOpenJobId = jobId;
      this.refreshOverlaysFromCache();
    });

    const feedbackLink = panel.querySelector('.sniper-feedback-email');
    feedbackLink?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const email = feedbackLink.getAttribute('data-email') || feedbackEmail;
      const copied = await this.copyTextToClipboard(email);
      this.showSettingsStatus(copyStatus, copied ? this.t('emailCopied') : this.t('emailCopyFailed'), !copied);
    });

    const resetBtn = panel.querySelector('.sniper-reset-skills-btn');
    resetBtn?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.resetSkillsTracking();
      this.showSettingsStatus(copyStatus, this.t('resetDone'), false);
      this.refreshOverlaysFromCache();
    });

    document.addEventListener('click', (event) => {
      if (!panel.classList.contains('open')) return;
      const target = event.target;
      if (target instanceof Node && wrap.contains(target)) return;
      panel.classList.remove('open');
      this.markSettingsUpdateSeen(btn, panel);
    }, { capture: true });
    panel.addEventListener('click', (ev) => ev.stopPropagation());
  };

  UpworkSniperExtension.prototype.markSettingsUpdateSeen = function(btn, panel) {
    if (this.hasSeenWeightsUpdate()) return;
    this.markWeightsUpdateSeen();
    btn.classList.remove('has-update');
    panel.querySelector('.sniper-weights-label')?.classList.remove('has-update');
  };

  UpworkSniperExtension.prototype.showSettingsStatus = function(copyStatus, message, isError) {
    if (!copyStatus) return;
    copyStatus.textContent = message;
    copyStatus.classList.toggle('is-error', !!isError);
    setTimeout(() => {
      if (copyStatus.textContent === message) {
        copyStatus.textContent = '';
        copyStatus.classList.remove('is-error');
      }
    }, 1800);
  };
})();
