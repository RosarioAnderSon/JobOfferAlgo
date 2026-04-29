(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logError = logs.logError || (() => {});

  const SKILLS_THRESHOLD_OPTIONS = [0, 50, 80];
  const MISSING_SKILLS_BY_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const MISSING_SKILLS_BY_JOB_MAX_ENTRIES = 250;
  const MAX_VISIBLE_SKILLS = 12;
  const SUPPORTED_NICHES = ['customer_service', 'customer_support', 'customer_specialist'];

  const normalizeThreshold = (value) => {
    const n = Number(value);
    return SKILLS_THRESHOLD_OPTIONS.includes(n) ? n : 0;
  };

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
  };

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
  };

  UpworkSniperExtension.prototype.getSelectedNiche = function() {
    const raw = localStorage.getItem(this.selectedNicheKey);
    return SUPPORTED_NICHES.includes(raw) ? raw : 'customer_service';
  };

  UpworkSniperExtension.prototype.setSelectedNiche = function(value) {
    const normalized = SUPPORTED_NICHES.includes(value) ? value : 'customer_service';
    localStorage.setItem(this.selectedNicheKey, normalized);
  };

  UpworkSniperExtension.prototype.extractClientHistoryRates = function(scopeText) {
    const source = String(scopeText || '');
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const entries = [];
    for (let i = 0; i < lines.length; i++) {
      const rateMatch = lines[i].match(/@\s*\$([\d.,]+)\s*\/\s*hr/i);
      if (!rateMatch) continue;
      const rate = parseFloat(rateMatch[1].replace(/,/g, ''));
      if (!Number.isFinite(rate) || rate <= 0) continue;

      let title = '';
      for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
        const candidate = lines[j];
        if (
          /^(rating|to freelancer:|no feedback given|billed:|member since|fixed price|hourly|payment verified)/i.test(candidate)
        ) {
          continue;
        }
        if (/@\s*\$[\d.,]+\s*\/\s*hr/i.test(candidate)) continue;
        if (/^\d+(\.\d+)?$/.test(candidate)) continue;
        if (/^\w{3}\s+\d{4}\s*-\s*\w{3}\s+\d{4}$/i.test(candidate)) continue;
        title = candidate;
        break;
      }

      entries.push({
        title,
        rate,
      });
    }

    return entries;
  };

  UpworkSniperExtension.prototype.matchesSelectedNiche = function(title, selectedNiche) {
    const normalized = String(title || '').toLowerCase();
    if (!normalized) return false;

    if (selectedNiche === 'customer_service') {
      return (
        normalized.includes('customer service') ||
        normalized.includes('customer support') ||
        normalized.includes('support') ||
        normalized.includes('help desk') ||
        normalized.includes('chat support') ||
        normalized.includes('email support') ||
        normalized.includes('ticketing')
      );
    }
    if (selectedNiche === 'customer_support') {
      return normalized.includes('customer support') || normalized.includes('support');
    }
    if (selectedNiche === 'customer_specialist') {
      return (
        normalized.includes('customer specialist') ||
        (normalized.includes('specialist') &&
          (normalized.includes('customer') || normalized.includes('support')))
      );
    }
    return false;
  };

  UpworkSniperExtension.prototype.matchesSelectedNicheInJob = function(jobData, selectedNiche) {
    const haystack = [jobData?.jobTitle || '', jobData?.descriptionText || ''].join(' ').toLowerCase();
    return this.matchesSelectedNiche(haystack, selectedNiche);
  };

  UpworkSniperExtension.prototype.computeSupportAvgBadge = function(jobData) {
    const selectedNiche = this.getSelectedNiche();
    const jobMatchesSelectedNiche = this.matchesSelectedNicheInJob(jobData, selectedNiche);
    const historyEntries = this.extractClientHistoryRates(jobData.scopeText || '');
    const matchedEntries = historyEntries.filter((entry) => this.matchesSelectedNiche(entry.title, selectedNiche));
    const benchmarkRates = matchedEntries.map((entry) => entry.rate).filter((rate) => Number.isFinite(rate) && rate > 0);
    const jobRate = this.extractHourlyRateFromText(
      [jobData.descriptionText || '', jobData.scopeText || '', jobData.activityText || ''].join(' ')
    );
    const benchmark =
      benchmarkRates.length > 0
        ? benchmarkRates.reduce((acc, value) => acc + value, 0) / benchmarkRates.length
        : null;
    const matches = matchedEntries
      .filter((entry) => entry.title && Number.isFinite(entry.rate) && entry.rate > 0)
      .slice(0, 5)
      .map((entry) => ({
        title: entry.title,
        rate: entry.rate,
      }));

    log('DETAIL', `Avg/hr selectedNiche=${selectedNiche}`);
    log('DETAIL', `Avg/hr jobMatchesSelectedNiche=${jobMatchesSelectedNiche}`);
    log('DETAIL', `Avg/hr historyEntriesTotal=${historyEntries.length}, historyMatchesWithRate=${benchmarkRates.length}`);
    log('DETAIL', `Avg/hr job rate parsed: ${jobRate === null ? 'null' : jobRate}`);

    if (!matches.length || benchmark === null) {
      const reason = !matches.length ? 'no history matches with rate' : 'no benchmark';
      log('DETAIL', `Avg/hr hidden reason: ${reason}`);
      return null;
    }

    const status = Number.isFinite(jobRate)
      ? (() => {
          const ratio = (jobRate - benchmark) / benchmark;
          return ratio > 0.1 ? 'above' : ratio < -0.1 ? 'below' : 'on';
        })()
      : 'on';
    log(
      'DETAIL',
      `Avg/hr visible: benchmark=${benchmark.toFixed(2)}, samples=${benchmarkRates.length}, hasJobRate=${Number.isFinite(jobRate)}`
    );

    return {
      status,
      benchmark,
      sampleSize: benchmarkRates.length,
      jobRate,
      matches,
    };
  };

  UpworkSniperExtension.prototype.detectNicheLabel = function(requiredSkills, title, descriptionText) {
    const text = [
      ...(Array.isArray(requiredSkills) ? requiredSkills : []),
      title || '',
      descriptionText || '',
    ]
      .join(' ')
      .toLowerCase();

    if (/(support|customer service|help desk|ticketing|chat support|email support)/i.test(text)) {
      return this.language === 'es' ? 'Soporte' : 'Support';
    }
    if (/(designer|figma|ux|ui)/i.test(text)) {
      return this.language === 'es' ? 'Diseño' : 'Design';
    }
    if (/(video|editor|youtube|reels)/i.test(text)) {
      return this.language === 'es' ? 'Video' : 'Video';
    }
    if (/(developer|frontend|backend|react|node|python)/i.test(text)) {
      return this.language === 'es' ? 'Desarrollo' : 'Development';
    }
    return this.language === 'es' ? 'General' : 'General';
  };

  UpworkSniperExtension.prototype.loadMissingSkillsCounters = function() {
    try {
      const raw = localStorage.getItem(this.missingSkillsCounterKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      logError('DETAIL', 'No se pudo leer contadores legacy de skills faltantes', error);
      return {};
    }
  };

  UpworkSniperExtension.prototype.saveMissingSkillsCounters = function(counters) {
    try {
      localStorage.setItem(this.missingSkillsCounterKey, JSON.stringify(counters || {}));
    } catch (error) {
      logError('DETAIL', 'No se pudo guardar contadores legacy de skills faltantes', error);
    }
  };

  UpworkSniperExtension.prototype.pruneMissingSkillsByJob = function(byJob) {
    const now = Date.now();
    const safe = byJob && typeof byJob === 'object' ? byJob : {};
    const entries = Object.entries(safe)
      .map(([jobId, entry]) => {
        const item = entry && typeof entry === 'object' ? entry : {};
        const ts = Number(item.ts);
        return {
          jobId,
          ts: Number.isFinite(ts) ? ts : 0,
          finalScore: Number.isFinite(Number(item.finalScore)) ? Number(item.finalScore) : null,
          missingSkills: this.dedupeSkills(Array.isArray(item.missingSkills) ? item.missingSkills : []),
          matchedSkills: this.dedupeSkills(Array.isArray(item.matchedSkills) ? item.matchedSkills : []),
        };
      })
      .filter((item) => item.jobId && item.ts > 0 && now - item.ts <= MISSING_SKILLS_BY_JOB_TTL_MS);

    entries.sort((a, b) => b.ts - a.ts);
    const capped = entries.slice(0, MISSING_SKILLS_BY_JOB_MAX_ENTRIES);
    const out = {};
    capped.forEach((entry) => {
      out[entry.jobId] = {
        jobId: entry.jobId,
        ts: entry.ts,
        finalScore: entry.finalScore,
        missingSkills: entry.missingSkills,
        matchedSkills: entry.matchedSkills,
      };
    });
    return out;
  };

  UpworkSniperExtension.prototype.loadMissingSkillsByJob = function() {
    try {
      const raw = localStorage.getItem(this.missingSkillsByJobKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const normalized = this.pruneMissingSkillsByJob(parsed && typeof parsed === 'object' ? parsed : {});
      return normalized;
    } catch (error) {
      logError('DETAIL', 'No se pudo leer tracking por job de skills faltantes', error);
      return {};
    }
  };

  UpworkSniperExtension.prototype.saveMissingSkillsByJob = function(byJob) {
    const pruned = this.pruneMissingSkillsByJob(byJob);
    try {
      localStorage.setItem(this.missingSkillsByJobKey, JSON.stringify(pruned));
    } catch (error) {
      try {
        const trimmed = this.pruneMissingSkillsByJob(pruned);
        const entries = Object.entries(trimmed).sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0));
        const half = Math.max(1, Math.floor(entries.length / 2));
        const aggressive = Object.fromEntries(entries.slice(0, half));
        localStorage.setItem(this.missingSkillsByJobKey, JSON.stringify(aggressive));
      } catch (retryError) {
        logError('DETAIL', 'No se pudo guardar tracking por job de skills faltantes', retryError);
      }
    }
  };

  UpworkSniperExtension.prototype.loadTopSkillsSnapshot = function() {
    try {
      const raw = localStorage.getItem(this.missingSkillsTopSnapshotKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  UpworkSniperExtension.prototype.saveTopSkillsSnapshot = function(snapshot) {
    try {
      localStorage.setItem(this.missingSkillsTopSnapshotKey, JSON.stringify(snapshot || {}));
    } catch {
      // noop
    }
  };

  UpworkSniperExtension.prototype.selectStableTopEntries = function(entries, snapshotOrder = []) {
    const prevIndex = new Map((Array.isArray(snapshotOrder) ? snapshotOrder : []).map((skill, idx) => [skill, idx]));
    const sorted = [...entries].sort((a, b) => {
      const countDiff = Number(b[1]) - Number(a[1]);
      if (countDiff !== 0) return countDiff;
      const aPrev = prevIndex.has(a[0]) ? prevIndex.get(a[0]) : Number.MAX_SAFE_INTEGER;
      const bPrev = prevIndex.has(b[0]) ? prevIndex.get(b[0]) : Number.MAX_SAFE_INTEGER;
      if (aPrev !== bPrev) return aPrev - bPrev;
      return String(a[0]).localeCompare(String(b[0]));
    });
    return sorted.slice(0, MAX_VISIBLE_SKILLS);
  };

  UpworkSniperExtension.prototype.getMissingSkillsMinScore = function() {
    try {
      const raw = localStorage.getItem(this.missingSkillsMinScoreKey);
      return normalizeThreshold(raw);
    } catch {
      return 0;
    }
  };

  UpworkSniperExtension.prototype.setMissingSkillsMinScore = function(minScore) {
    const normalized = normalizeThreshold(minScore);
    localStorage.setItem(this.missingSkillsMinScoreKey, String(normalized));
    this.renderGlobalMissingSkillsSidebar();
  };

  UpworkSniperExtension.prototype.getMissingSkillsCollapsed = function() {
    return localStorage.getItem(this.missingSkillsCollapsedKey) === '1';
  };

  UpworkSniperExtension.prototype.toggleMissingSkillsCollapsed = function() {
    const next = !this.getMissingSkillsCollapsed();
    localStorage.setItem(this.missingSkillsCollapsedKey, next ? '1' : '0');
    this.renderGlobalMissingSkillsSidebar();
  };

  UpworkSniperExtension.prototype.upsertMissingSkillsByJob = function(
    jobId,
    missingSkills,
    finalScore = null,
    matchedSkills = []
  ) {
    if (!jobId) return;

    const byJob = this.loadMissingSkillsByJob();
    const existing = byJob[jobId] || {};
    byJob[jobId] = {
      jobId,
      matchedSkills: this.dedupeSkills(Array.isArray(matchedSkills) ? matchedSkills : []),
      missingSkills: this.dedupeSkills(Array.isArray(missingSkills) ? missingSkills : []),
      finalScore: Number.isFinite(finalScore) ? Number(finalScore) : existing.finalScore ?? null,
      ts: Date.now(),
    };

    this.saveMissingSkillsByJob(byJob);
  };

  UpworkSniperExtension.prototype.updateMissingSkillsFinalScore = function(jobId, finalScore) {
    if (!jobId || !Number.isFinite(finalScore)) return;

    const byJob = this.loadMissingSkillsByJob();
    const existing = byJob[jobId] || { jobId, missingSkills: [], ts: Date.now() };
    existing.finalScore = Number(finalScore);
    existing.ts = Date.now();
    byJob[jobId] = existing;
    this.saveMissingSkillsByJob(byJob);
  };

  UpworkSniperExtension.prototype.buildMissingSkillsCounters = function(minScore) {
    const threshold = normalizeThreshold(minScore);
    const byJob = this.loadMissingSkillsByJob();
    const values = Object.values(byJob);

    // Compatibilidad basica: si no hay data nueva y el threshold es 0, usar el contador legacy.
    if (!values.length && threshold === 0) {
      return {
        missing: this.loadMissingSkillsCounters(),
        matched: {},
      };
    }

    const counters = {};
    const matchedCounters = {};
    values.forEach((entry) => {
      if (!entry) return;

      const score = Number(entry.finalScore);
      if (threshold > 0) {
        if (!Number.isFinite(score)) return;
        if (score < threshold) return;
      }

      const missingSkills = Array.isArray(entry.missingSkills) ? entry.missingSkills : [];
      const matchedSkills = Array.isArray(entry.matchedSkills) ? entry.matchedSkills : [];

      missingSkills.forEach((skill) => {
        const key = this.normalizeSkillLabel(skill);
        counters[key] = (counters[key] || 0) + 1;
      });
      matchedSkills.forEach((skill) => {
        const key = this.normalizeSkillLabel(skill);
        matchedCounters[key] = (matchedCounters[key] || 0) + 1;
      });
    });

    return {
      missing: counters,
      matched: matchedCounters,
    };
  };

  UpworkSniperExtension.prototype.resetSkillsTracking = function() {
    localStorage.removeItem(this.missingSkillsCounterKey);
    localStorage.removeItem(this.missingSkillsSeenJobsKey);
    localStorage.removeItem(this.missingSkillsByJobKey);
    localStorage.removeItem(this.missingSkillsTopSnapshotKey);
    localStorage.removeItem(this.profileSkillsKey);
    this.renderGlobalMissingSkillsSidebar();
  };

  UpworkSniperExtension.prototype.renderGlobalMissingSkillsSidebar = function() {
    const existing = document.getElementById('sniper-global-missing-skills');
    if (existing) existing.remove();

    const panel = document.createElement('aside');
    panel.id = 'sniper-global-missing-skills';
    panel.className = 'sniper-global-missing-skills';
    const isCollapsed = this.getMissingSkillsCollapsed();
    if (isCollapsed) panel.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'sniper-left-panel-header';
    const title = document.createElement('div');
    title.className = 'sniper-left-panel-title';
    title.textContent = this.t('skillsMissingTitle');
    header.appendChild(title);
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'sniper-left-panel-collapse-btn';
    collapseBtn.textContent = isCollapsed ? '›' : '‹';
    collapseBtn.title = isCollapsed ? 'Expandir' : 'Compactar';
    collapseBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.toggleMissingSkillsCollapsed();
    });
    header.appendChild(collapseBtn);
    panel.appendChild(header);

    if (isCollapsed) {
      document.body.appendChild(panel);
      return;
    }

    const minScore = this.getMissingSkillsMinScore();

    const filterRow = document.createElement('div');
    filterRow.className = 'sniper-left-panel-filter';
    const filterLabel = document.createElement('span');
    filterLabel.className = 'sniper-left-panel-filter-label';
    filterLabel.textContent = `${this.t('skillsMinScoreLabel')}:`;
    filterRow.appendChild(filterLabel);

    SKILLS_THRESHOLD_OPTIONS.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sniper-left-panel-filter-btn';
      btn.textContent = this.t(`skillsMinScore${option}`);
      btn.dataset.value = String(option);
      if (option === minScore) btn.classList.add('active');
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setMissingSkillsMinScore(option);
      });
      filterRow.appendChild(btn);
    });

    panel.appendChild(filterRow);

    const counterGroups = this.buildMissingSkillsCounters(minScore);
    const missingEntriesRaw = Object.entries(counterGroups.missing || {})
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    const matchedEntriesRaw = Object.entries(counterGroups.matched || {})
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    const topSnapshot = this.loadTopSkillsSnapshot();
    const matchedEntries = this.selectStableTopEntries(matchedEntriesRaw, topSnapshot.have);
    const missingEntries = this.selectStableTopEntries(missingEntriesRaw, topSnapshot.missing);
    this.saveTopSkillsSnapshot({
      have: matchedEntries.map(([skill]) => skill),
      missing: missingEntries.map(([skill]) => skill),
    });

    if (!missingEntries.length && !matchedEntries.length) {
      const msg = document.createElement('div');
      msg.className = 'sniper-left-panel-msg';
      msg.textContent = this.t('skillsMissingNone');
      panel.appendChild(msg);
    } else {
      const renderList = (entries, toneClass, titleText) => {
        const section = document.createElement('div');
        section.className = `sniper-left-panel-section ${toneClass}`;
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'sniper-left-panel-section-title';
        sectionTitle.textContent = titleText;
        section.appendChild(sectionTitle);

        const list = document.createElement('ul');
        list.className = `sniper-left-panel-list ${toneClass}`;
        entries.forEach(([skill, count]) => {
          const li = document.createElement('li');
          li.textContent = `${this.toDisplaySkillLabel(skill)} x${count}`;
          list.appendChild(li);
        });
        section.appendChild(list);
        panel.appendChild(section);
      };

      if (matchedEntries.length) {
        renderList(
          matchedEntries,
          'sniper-skill-have',
          this.language === 'es' ? 'Skills que tienes' : 'Skills you have'
        );
      }
      if (missingEntries.length) {
        renderList(
          missingEntries,
          'sniper-skill-missing',
          this.language === 'es' ? 'Skills faltantes' : 'Missing skills'
        );
      }
    }

    document.body.appendChild(panel);
  };

  UpworkSniperExtension.prototype.computeSkillsMatch = function(requiredSkills, jobId) {
    const required = this.dedupeSkills(requiredSkills || []);
    const profileCache = this.loadProfileSkillsCache();
    const profileSkills = this.dedupeSkills(profileCache.skills || []);

    if (!required.length) {
      this.upsertMissingSkillsByJob(jobId, [], null, []);
      return {
        profileSkillsLoaded: profileSkills.length > 0,
        profileSkills,
        requiredSkills: [],
        matchedSkills: [],
        missingSkills: [],
      };
    }

    if (!profileSkills.length) {
      this.upsertMissingSkillsByJob(jobId, required, null, []);
      this.renderGlobalMissingSkillsSidebar();
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

    this.upsertMissingSkillsByJob(jobId, missing, null, matched);
    this.renderGlobalMissingSkillsSidebar();

    return {
      profileSkillsLoaded: true,
      profileSkills,
      requiredSkills: required,
      matchedSkills: matched,
      missingSkills: missing,
    };
  };
})();
