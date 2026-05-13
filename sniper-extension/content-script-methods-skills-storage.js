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
})();
