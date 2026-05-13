(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;

  UpworkSniperExtension.prototype.createSettingsButton = function(jobId = null) {
    const view = this.createSettingsPanelView(jobId);
    this.renderSettingsWeightControls(view);
    this.bindSettingsPanelEvents(view, jobId);
    return view.wrap;
  };

  UpworkSniperExtension.prototype.createSettingsPanelView = function(jobId = null) {
    const wrap = document.createElement('div');
    wrap.className = 'sniper-settings-wrap';
    const feedbackEmail = 'anderrosariotav@gmail.com';

    const btn = document.createElement('button');
    btn.className = 'sniper-settings-btn';
    btn.type = 'button';
    btn.title = this.t('settings');
    btn.textContent = '\u2699';
    if (!this.hasSeenWeightsUpdate()) btn.classList.add('has-update');
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
    ['en', 'es'].forEach((lang) => {
      const langBtn = document.createElement('button');
      langBtn.type = 'button';
      langBtn.className = 'sniper-lang-btn';
      langBtn.setAttribute('data-lang', lang);
      langBtn.textContent = lang.toUpperCase();
      langRow.appendChild(langBtn);
    });
    panel.appendChild(langRow);

    const nicheLabel = document.createElement('div');
    nicheLabel.className = 'sniper-settings-label';
    nicheLabel.textContent = this.t('niche');
    panel.appendChild(nicheLabel);

    const nicheSelectEl = document.createElement('select');
    nicheSelectEl.className = 'sniper-settings-select sniper-niche-select';
    [
      ['customer_service', this.t('nicheCustomerService')],
      ['customer_support', this.t('nicheCustomerSupport')],
      ['customer_specialist', this.t('nicheCustomerSpecialist')],
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      nicheSelectEl.appendChild(option);
    });
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

    const weightsContainer = document.createElement('div');
    weightsContainer.className = 'sniper-weights-container';
    panel.appendChild(weightsContainer);

    const weightsActions = document.createElement('div');
    weightsActions.className = 'sniper-weights-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'sniper-save-weights-btn';
    saveBtn.textContent = this.t('saveWeights');
    const resetWeightsBtn = document.createElement('button');
    resetWeightsBtn.type = 'button';
    resetWeightsBtn.className = 'sniper-reset-weights-btn';
    resetWeightsBtn.textContent = this.t('resetWeights');
    weightsActions.appendChild(saveBtn);
    weightsActions.appendChild(resetWeightsBtn);
    panel.appendChild(weightsActions);

    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'sniper-settings-feedback';
    feedbackDiv.style.marginTop = '8px';
    feedbackDiv.textContent = this.t('feedback') + ' ';
    const feedbackLink = document.createElement('a');
    feedbackLink.href = '#';
    feedbackLink.className = 'sniper-feedback-email';
    feedbackLink.setAttribute('data-email', feedbackEmail);
    feedbackLink.title = this.t('copyEmail');
    feedbackLink.textContent = feedbackEmail;
    feedbackDiv.appendChild(feedbackLink);
    panel.appendChild(feedbackDiv);

    const resetSkillsBtn = document.createElement('button');
    resetSkillsBtn.type = 'button';
    resetSkillsBtn.className = 'sniper-reset-skills-btn';
    resetSkillsBtn.textContent = this.t('resetSkills');
    panel.appendChild(resetSkillsBtn);

    const copyStatus = document.createElement('div');
    copyStatus.className = 'sniper-settings-copy-status';
    copyStatus.setAttribute('aria-live', 'polite');
    panel.appendChild(copyStatus);
    wrap.appendChild(panel);

    return { wrap, btn, panel, weightsContainer, weightsInfoTooltip, nicheSelectEl, copyStatus, feedbackEmail };
  };
})();
