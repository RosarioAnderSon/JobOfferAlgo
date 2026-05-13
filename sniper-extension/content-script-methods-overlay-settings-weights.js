(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;

  UpworkSniperExtension.prototype.renderSettingsWeightControls = function(view) {
    const { weightsContainer, weightsInfoTooltip } = view;
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
    const thresholdLabels = {
      hireRate: { A: { label: 'A+', unit: '%' }, B: { label: 'B', unit: '%' }, C: { label: 'C', unit: '%' } },
      spend: { A: { label: 'A+', unit: '$' }, B: { label: 'B', unit: '$' }, C: { label: 'C', unit: '$' } },
      rating: { A: { label: 'A+', unit: 'star' }, min: { label: 'Min', unit: 'star' } },
      activity: { fresh: { label: 'Fresh', unit: 'h' }, recent: { label: 'Recent', unit: 'h' } },
      proposals: { A: { label: 'A+', unit: 'props' }, B: { label: 'B', unit: 'props' }, C: { label: 'C', unit: 'props' } },
      jobs: { A: { label: 'A+', unit: 'jobs' }, B: { label: 'B', unit: 'jobs' } },
    };

    const formatWeightTotal = (value) => {
      if (!Number.isFinite(value)) return '0';
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    };
    const getCurrentTotalWeight = () => {
      const liveInputs = Array.from(weightsContainer.querySelectorAll('.sniper-weight-input[data-type="weight"]'));
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

    weightKeys.forEach((key) => {
      const group = document.createElement('div');
      group.className = 'sniper-weight-group';
      const thresholdConfig = thresholdLabels[key];
      const hasThresholds = thresholdConfig && Object.keys(thresholdConfig).length > 0;
      const row = document.createElement('div');
      row.className = 'sniper-weight-row';
      const label = document.createElement('label');

      if (hasThresholds) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'sniper-threshold-toggle';
        toggleBtn.textContent = '>';
        label.appendChild(toggleBtn);
      } else {
        const spacer = document.createElement('span');
        spacer.style.display = 'inline-block';
        spacer.style.width = '12px';
        label.appendChild(spacer);
      }
      label.appendChild(document.createTextNode(' ' + weightLabels[key]));

      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.min = '0';
      weightInput.max = '100';
      weightInput.setAttribute('data-key', key);
      weightInput.setAttribute('data-type', 'weight');
      weightInput.value = currentWeights[key]?.weight ?? 0;
      weightInput.className = 'sniper-weight-input';

      row.appendChild(label);
      row.appendChild(weightInput);
      group.appendChild(row);

      if (hasThresholds) {
        const thresholdPanel = document.createElement('div');
        thresholdPanel.className = 'sniper-thresholds-panel';
        thresholdPanel.setAttribute('data-threshold-panel', key);
        thresholdPanel.style.display = 'none';
        Object.keys(thresholdConfig).forEach((thresholdKey) => {
          const config = thresholdConfig[thresholdKey];
          const thresholdRow = document.createElement('div');
          thresholdRow.className = 'sniper-threshold-row';
          const thresholdLabel = document.createElement('span');
          thresholdLabel.textContent = config.label + ' =';
          const inputWrap = document.createElement('div');
          inputWrap.className = 'sniper-input-wrap';
          const thresholdInput = document.createElement('input');
          thresholdInput.type = 'number';
          thresholdInput.setAttribute('data-key', key);
          thresholdInput.setAttribute('data-thresh', thresholdKey);
          thresholdInput.value = currentWeights[key]?.thresholds?.[thresholdKey] ?? '';
          thresholdInput.className = 'sniper-weight-input sniper-thresh-input';
          const unit = document.createElement('span');
          unit.className = 'sniper-input-unit';
          unit.textContent = config.unit;
          inputWrap.appendChild(thresholdInput);
          inputWrap.appendChild(unit);
          thresholdRow.appendChild(thresholdLabel);
          thresholdRow.appendChild(inputWrap);
          thresholdPanel.appendChild(thresholdRow);
        });
        group.appendChild(thresholdPanel);
      }
      weightsContainer.appendChild(group);
    });

    view.currentWeights = currentWeights;
    view.refreshWeightsTooltip = refreshWeightsTooltip;
    refreshWeightsTooltip();
  };
})();
