(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.createScoreBadge = function(result, rawData) {
      const scoreEl = document.createElement('div');
      const gradeClass = result.grade.replace('+', 'plus').replace('-', 'minus');
      scoreEl.className = `sniper-score grade-${gradeClass} has-tooltip`;

      scoreEl.innerHTML = `
        <span class="score-value">${result.finalScore}</span>
        <span class="score-grade">${result.grade}</span>
      `;

      const tooltip = this.createScoreTooltip(result, rawData);
      scoreEl.appendChild(tooltip);

      return scoreEl;
    }

  UpworkSniperExtension.prototype.createScoreTooltip = function(result, rawData) {
      const tooltip = document.createElement('div');
      tooltip.className = 'sniper-score-tooltip';

      if (result.killSwitches && result.killSwitches.length > 0) {
        tooltip.innerHTML = `
          <div class="tooltip-title">${this.t('killed')}</div>
          <div class="tooltip-meta kill">${this.t('reasons')}</div>
          <ul class="tooltip-kill-list">
            ${result.killSwitches.map((k) => `<li>${k}</li>`).join('')}
          </ul>
        `;
        return tooltip;
      }

      const breakdown = this.buildComponentBreakdown(result, rawData || {});

      const metaLine = `${this.t('base')}: ${result.baseScore} | ${this.t('bonus')}: +${result.totals.bonuses} | ${this.t('penalty')}: ${result.totals.penalties}`;

      tooltip.innerHTML = `
        <div class="tooltip-title">${this.t('scoreDetail')}</div>
        <div class="tooltip-meta">${metaLine}</div>
        <div class="tooltip-grid">
          ${breakdown
          .map(
            (item) => `
                <div class="tooltip-item ${item.tone}">
                  <span class="dot"></span>
                  <span class="label">${item.label}</span>
                  <span class="value">${item.grade}</span>
                </div>
                ${item.reason ? `<div class="tooltip-reason">${item.reason}</div>` : ''}
              `
          )
          .join('')}
        </div>
      `;

      return tooltip;
    }

    UpworkSniperExtension.prototype.buildComponentBreakdown = function(result, rawData) {
      const componentGrade = (score) => {
        if (score >= 97) return 'A+';
        if (score >= 93) return 'A';
        if (score >= 90) return 'A-';
        if (score >= 87) return 'B+';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        return 'F';
      };

      const safeData = rawData || {};
      const hires = safeData.totalHires ?? 0;
      const jobs = safeData.jobsPosted ?? 0;
      const hireRatePct =
        safeData.hireRatePct !== undefined
          ? safeData.hireRatePct
          : jobs > 0
            ? Math.round((hires / jobs) * 100)
            : 0;

      const avgPrice =
        hires > 0
          ? safeData.totalSpent / hires
          : safeData.totalSpent === 0 && jobs < 3 && safeData.jobBudget
            ? safeData.jobBudget
            : 0;

      const hoursSinceViewed =
        safeData.lastViewed instanceof Date && !Number.isNaN(safeData.lastViewed.getTime())
          ? Math.round((Date.now() - safeData.lastViewed.getTime()) / 3_600_000)
          : null;

      const labels = {
        hireRate: this.t('hireRate'),
        spend: this.t('spend'),
        rating: this.t('rating'),
        activity: this.t('activity'),
        proposals: this.t('proposals'),
        payment: this.t('payment'),
        jobs: this.t('jobsPosted'),
      };

      const getTone = (score) => (score >= 85 ? 'good' : score >= 60 ? 'warn' : 'bad');

      const reasons = {
        hireRate:
          result.componentScores.hireRate === 0
            ? jobs > 0
              ? `Hire rate ${Math.max(hireRatePct, 0)}% con ${hires}/${jobs} hires`
              : this.t('noHiresHistory')
            : '',
        spend:
          result.componentScores.spend === 0
            ? safeData.totalSpent > 0
              ? `$${Math.round(avgPrice)} por contrataci\u00f3n (bajo)`
              : this.t('noSpendHistory')
            : '',
        rating:
          result.componentScores.rating === 0
            ? safeData.rating
              ? this.t('ratingBelow')
                .replace('{rating}', safeData.rating)
                .replace('{reviews}', safeData.reviewsCount || 0)
              : this.t('noRatingBelow')
            : '',
        activity:
          result.componentScores.activity === 0
            ? hoursSinceViewed !== null
              ? this.t('seenHoursAgo').replace('{hours}', hoursSinceViewed)
              : this.t('noLastViewed')
            : '',
        proposals:
          result.componentScores.proposals === 0
            ? safeData.proposalCount
              ? this.t('highCompetition').replace('{count}', safeData.proposalCount)
              : this.t('noProposals')
            : '',
        payment:
          result.componentScores.payment === 0 ? this.t('paymentUnverified') : '',
        jobs: '',
      };

      return Object.entries(result.componentScores).map(([key, score]) => ({
        label: labels[key] || key,
        score,
        tone: getTone(score),
        reason: reasons[key],
        grade: componentGrade(score),
      }));
    
    }
  UpworkSniperExtension.prototype.createBadge = function(badgeName, rawData = null) {
      const config = this.getBadgeConfig(badgeName, rawData);
      const badgeEl = document.createElement('span');
      badgeEl.className = `sniper-badge ${config.type}`;
      if (badgeName === 'Niche Avg/hr') {
        badgeEl.classList.add('sniper-badge-avg');
      }

      if (config.iconSvg) {
        badgeEl.innerHTML = config.iconSvg;
      } else {
        badgeEl.textContent = config.icon || '';
      }

      // Tooltip HTML con jerarqu\u00eda (t\u00edtulo + descripci\u00f3n)
      const tooltipEl = document.createElement('div');
      tooltipEl.className = 'sniper-tooltip';
      const titleEl = document.createElement('div');
      titleEl.className = 'sniper-tooltip-title';
      titleEl.textContent = config.tooltipTitle || badgeName;
      const descEl = document.createElement('div');
      descEl.className = 'sniper-tooltip-desc';
      descEl.textContent = config.description;
      tooltipEl.appendChild(titleEl);
      tooltipEl.appendChild(descEl);
      badgeEl.appendChild(tooltipEl);

      return badgeEl;
    
    }
})();
