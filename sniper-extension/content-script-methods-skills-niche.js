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
    const key = this.selectedNicheKey || this.nicheKey || 'sniper-selected-niche-v1';
    const raw = localStorage.getItem(key);
    return SUPPORTED_NICHES.includes(raw) ? raw : 'customer_service';
  };

  UpworkSniperExtension.prototype.setSelectedNiche = function(value) {
    const normalized = SUPPORTED_NICHES.includes(value) ? value : 'customer_service';
    const key = this.selectedNicheKey || this.nicheKey || 'sniper-selected-niche-v1';
    localStorage.setItem(key, normalized);
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
})();
