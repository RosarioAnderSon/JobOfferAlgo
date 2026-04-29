(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.extractHourlyRateFromText = function(text) {
      const source = String(text || '');
      if (!source) return null;
      const rangeMatch = source.match(/\$([\d.,]+)\s*-\s*\$?\s*([\d.,]+)\s*\/\s*hr/i);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1].replace(/,/g, ''));
        const max = parseFloat(rangeMatch[2].replace(/,/g, ''));
        if (!Number.isNaN(min) && !Number.isNaN(max) && min > 0 && max > 0) {
          return (min + max) / 2;
        }
      }
      const singleMatch = source.match(/\$([\d.,]+)\s*\/\s*hr/i);
      if (singleMatch) {
        const value = parseFloat(singleMatch[1].replace(/,/g, ''));
        return Number.isNaN(value) || value <= 0 ? null : value;
      }
      return null;
    }

  UpworkSniperExtension.prototype.isSupportNiche = function(requiredSkills, title, descriptionText) {
      const keywords = [
        'customer service',
        'customer support',
        'support specialist',
        'support',
        'help desk',
        'chat support',
        'email support',
        'phone support',
        'ticketing',
      ];
      const haystack = [
        ...(Array.isArray(requiredSkills) ? requiredSkills : []),
        title || '',
        descriptionText || '',
      ]
        .join(' ')
        .toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    }

  UpworkSniperExtension.prototype.getSupportBenchmarkFromFeed = function() {
      const isInsideModal = (el) =>
        el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');
      const cards = Array.from(
        document.querySelectorAll('section.air3-card-section, article.job-tile, [data-test="job-tile"]')
      ).filter((card) => !isInsideModal(card));
      const rates = [];
      cards.forEach((card) => {
        const cardText = (card.innerText || card.textContent || '').toLowerCase();
        if (!this.isSupportNiche([], cardText, '')) return;
        const rate = this.extractHourlyRateFromText(cardText);
        if (rate !== null) rates.push(rate);
      });
      if (rates.length < 3) return null;
      const avg = rates.reduce((acc, value) => acc + value, 0) / rates.length;
      return {
        avg,
        sampleSize: rates.length,
      };
    }

  UpworkSniperExtension.prototype.computeSupportAvgBadge = function(jobData) {
      if (!this.isSupportNiche(jobData.requiredSkills, jobData.jobTitle, jobData.descriptionText)) {
        return null;
      }
      const benchmark = this.getSupportBenchmarkFromFeed();
      const jobRate = this.extractHourlyRateFromText(
        [jobData.descriptionText || '', jobData.scopeText || '', jobData.activityText || ''].join(' ')
      );
      if (!benchmark || jobRate === null) {
        return {
          status: 'unavailable',
          benchmark: benchmark?.avg || null,
          sampleSize: benchmark?.sampleSize || 0,
          jobRate,
        };
      }
      const ratio = (jobRate - benchmark.avg) / benchmark.avg;
      const status = ratio > 0.1 ? 'above' : ratio < -0.1 ? 'below' : 'on';
      return {
        status,
        benchmark: benchmark.avg,
        sampleSize: benchmark.sampleSize,
        jobRate,
      };
    }

  UpworkSniperExtension.prototype.loadMissingSkillsCounters = function() {
      try {
        const raw = localStorage.getItem(this.missingSkillsCounterKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        logError('DETAIL', 'No se pudo leer contadores de skills faltantes', error);
        return {};
      }
    }

  UpworkSniperExtension.prototype.saveMissingSkillsCounters = function(counters) {
      try {
        localStorage.setItem(this.missingSkillsCounterKey, JSON.stringify(counters || {}));
      } catch (error) {
        logError('DETAIL', 'No se pudo guardar contadores de skills faltantes', error);
      }
    }

  UpworkSniperExtension.prototype.loadMissingSkillsSeenJobs = function() {
      try {
        const raw = localStorage.getItem(this.missingSkillsSeenJobsKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        logError('DETAIL', 'No se pudo leer jobs ya contados para skills', error);
        return {};
      }
    }

  UpworkSniperExtension.prototype.saveMissingSkillsSeenJobs = function(jobsMap) {
      try {
        localStorage.setItem(this.missingSkillsSeenJobsKey, JSON.stringify(jobsMap || {}));
      } catch (error) {
        logError('DETAIL', 'No se pudo guardar jobs ya contados para skills', error);
      }
    }

  UpworkSniperExtension.prototype.resetSkillsTracking = function() {
      localStorage.removeItem(this.missingSkillsCounterKey);
      localStorage.removeItem(this.missingSkillsSeenJobsKey);
      localStorage.removeItem(this.profileSkillsKey);
      this.renderGlobalMissingSkillsSidebar();
    }

  UpworkSniperExtension.prototype.renderGlobalMissingSkillsSidebar = function() {
      const existing = document.getElementById('sniper-global-missing-skills');
      if (existing) existing.remove();

      const panel = document.createElement('aside');
      panel.id = 'sniper-global-missing-skills';
      panel.className = 'sniper-global-missing-skills';

      const title = document.createElement('div');
      title.className = 'sniper-left-panel-title';
      title.textContent = this.t('skillsMissingTitle');
      panel.appendChild(title);

      const counters = this.loadMissingSkillsCounters();
      const entries = Object.entries(counters)
        .filter(([, count]) => Number(count) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 20);

      if (!entries.length) {
        const msg = document.createElement('div');
        msg.className = 'sniper-left-panel-msg';
        msg.textContent = this.t('skillsMissingNone');
        panel.appendChild(msg);
      } else {
        const list = document.createElement('ul');
        list.className = 'sniper-left-panel-list';
        entries.forEach(([skill, count]) => {
          const li = document.createElement('li');
          li.textContent = `${this.toDisplaySkillLabel(skill)} x${count}`;
          list.appendChild(li);
        });
        panel.appendChild(list);
      }

      document.body.appendChild(panel);
    }

  UpworkSniperExtension.prototype.computeSkillsMatch = function(requiredSkills, jobId) {
      const required = this.dedupeSkills(requiredSkills || []);
      const profileCache = this.loadProfileSkillsCache();
      const profileSkills = this.dedupeSkills(profileCache.skills || []);
      if (!required.length) {
        return {
          profileSkillsLoaded: profileSkills.length > 0,
          profileSkills,
          requiredSkills: [],
          matchedSkills: [],
          missingSkills: [],
        };
      }
      if (!profileSkills.length) {
        return {
          profileSkillsLoaded: false,
          profileSkills: [],
          requiredSkills: required,
          matchedSkills: [],
          missingSkills: required,
        };
      }

      const profileSet = new Set(profileSkills.map((skill) => this.normalizeSkillLabel(skill)));
      const matched = [];
      const missing = [];
      required.forEach((skill) => {
        const normalized = this.normalizeSkillLabel(skill);
        if (profileSet.has(normalized)) matched.push(skill);
        else missing.push(skill);
      });

      if (jobId && missing.length) {
        const seenJobs = this.loadMissingSkillsSeenJobs();
        if (!seenJobs[jobId]) {
          const counters = this.loadMissingSkillsCounters();
          missing.forEach((skill) => {
            const key = this.normalizeSkillLabel(skill);
            counters[key] = (counters[key] || 0) + 1;
          });
          seenJobs[jobId] = Date.now();
          this.saveMissingSkillsCounters(counters);
          this.saveMissingSkillsSeenJobs(seenJobs);
          this.renderGlobalMissingSkillsSidebar();
        }
      }

      return {
        profileSkillsLoaded: true,
        profileSkills,
        requiredSkills: required,
        matchedSkills: matched,
        missingSkills: missing,
      };
    }
})();

