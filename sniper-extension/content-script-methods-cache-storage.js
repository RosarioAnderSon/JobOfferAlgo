(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;

  const DEFAULT_CACHE_RETENTION_FLOOR = 20;
  const hasOwn = (source, key) => Object.prototype.hasOwnProperty.call(source, key);
  const asCacheObject = (source) =>
    source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const getEntryTs = (entry) => {
    const parsed = Number(entry?.ts);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  UpworkSniperExtension.prototype.getBadgeSchemaVersion = function() {
    const parsed = Number(this.badgeSchemaVersion);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  };

  UpworkSniperExtension.prototype.isCacheEntryBadgeSchemaStale = function(entry) {
    if (!entry || typeof entry !== 'object') return true;
    const current = this.getBadgeSchemaVersion();
    const entryVersion = Number(entry.badgeSchemaVersion);
    if (!Number.isFinite(entryVersion)) return true;
    return Math.floor(entryVersion) < current;
  };

  UpworkSniperExtension.prototype.getCacheRetentionFloor = function() {
    const parsed = Number(this.cacheRetentionFloor);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : DEFAULT_CACHE_RETENTION_FLOOR;
  };

  UpworkSniperExtension.prototype.getCacheMaxEntries = function() {
    const floor = this.getCacheRetentionFloor();
    const parsed = Number(this.cacheMaxEntries);
    return Number.isFinite(parsed) && parsed > 0 ? Math.max(floor, Math.floor(parsed)) : floor;
  };

  UpworkSniperExtension.prototype.getCacheJobIdCandidates = function(jobId) {
    const raw = String(jobId || '').trim();
    const candidates = new Set();
    if (!raw) return [];

    candidates.add(raw);

    if (typeof this.getComparableJobIdVariants === 'function') {
      this.getComparableJobIdVariants(raw).forEach((variant) => {
        const normalized = String(variant || '').trim();
        if (normalized) candidates.add(normalized);
      });
    }

    if (typeof this.toCanonicalJobId === 'function') {
      const canonical = String(this.toCanonicalJobId(raw) || '').trim();
      if (canonical) candidates.add(canonical);
    } else if (typeof this.normalizeJobIdForCompare === 'function') {
      const normalized = String(this.normalizeJobIdForCompare(raw) || '').trim();
      if (normalized) candidates.add(normalized);
    }

    return Array.from(candidates);
  };

  UpworkSniperExtension.prototype.getCacheKeyForJobId = function(jobId) {
    const raw = String(jobId || '').trim();
    if (!raw) return '';

    if (typeof this.toCanonicalJobId === 'function') {
      const canonical = String(this.toCanonicalJobId(raw) || '').trim();
      if (canonical) return canonical;
    }

    if (typeof this.normalizeJobIdForCompare === 'function') {
      const normalized = String(this.normalizeJobIdForCompare(raw) || '').trim();
      if (normalized) return normalized;
    }

    return raw;
  };

  UpworkSniperExtension.prototype.resolveCachedEntryForJobId = function(jobId, cache) {
    const source = asCacheObject(cache);
    const candidates = this.getCacheJobIdCandidates(jobId);
    if (candidates.length === 0) return null;

    const candidateSet = new Set(candidates);
    const matches = [];

    candidates.forEach((candidate) => {
      if (hasOwn(source, candidate)) {
        matches.push({ key: candidate, entry: source[candidate] });
      }
    });

    Object.keys(source).forEach((key) => {
      if (candidateSet.has(key)) return;
      const isSame =
        typeof this.isSameJobId === 'function'
          ? this.isSameJobId(key, jobId)
          : candidateSet.has(String(key || '').trim());
      if (isSame) matches.push({ key, entry: source[key] });
    });

    if (matches.length === 0) return null;
    matches.sort((a, b) => getEntryTs(b.entry) - getEntryTs(a.entry));
    return matches[0];
  };

  UpworkSniperExtension.prototype.removeCacheAliasesForJobId = function(jobId, cache, keepKey) {
    const source = asCacheObject(cache);
    const targetKey = String(keepKey || '').trim();
    if (!jobId || !targetKey) return false;

    let changed = false;
    Object.keys(source).forEach((key) => {
      if (key === targetKey) return;
      const isSame =
        typeof this.isSameJobId === 'function'
          ? this.isSameJobId(key, jobId) || this.isSameJobId(key, targetKey)
          : this.getCacheJobIdCandidates(jobId).includes(key);
      if (!isSame) return;
      delete source[key];
      changed = true;
    });
    return changed;
  };

  UpworkSniperExtension.prototype.getCacheIdsNewestFirst = function(cache) {
    const source = asCacheObject(cache);
    return Object.keys(source).sort((a, b) => {
      const diff = getEntryTs(source[b]) - getEntryTs(source[a]);
      return diff || a.localeCompare(b);
    });
  };

  UpworkSniperExtension.prototype.trimCacheToNewestEntries = function(cache, keepCount) {
    const source = asCacheObject(cache);
    const next = { ...source };
    const count = Math.max(this.getCacheRetentionFloor(), Math.floor(Number(keepCount) || 0));
    this.getCacheIdsNewestFirst(next)
      .slice(count)
      .forEach((id) => delete next[id]);
    return next;
  };

  UpworkSniperExtension.prototype.compactCacheForStorage = function(source) {
    const cache = asCacheObject(source);
    const compacted = {};
    Object.keys(cache).forEach((jobId) => {
      const entry = cache[jobId];
      if (!entry || typeof entry !== 'object') return;
      const cacheKey = this.getCacheKeyForJobId(jobId) || jobId;
      const current = compacted[cacheKey];
      if (current && getEntryTs(current) > getEntryTs(entry)) return;
      compacted[cacheKey] = {
        result: entry.result || null,
        rawData: null,
        ts: entry.ts || Date.now(),
        badgeSchemaVersion: Number(entry.badgeSchemaVersion) || this.getBadgeSchemaVersion(),
        metricsHistory: Array.isArray(entry.metricsHistory) ? entry.metricsHistory.slice(-8) : [],
      };
    });
    return compacted;
  };

  UpworkSniperExtension.prototype.isCacheQuotaError = function(error) {
    return !!(
      error &&
      (error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.code === 1014 ||
        /quota/i.test(String(error.message || '')))
    );
  };

  UpworkSniperExtension.prototype.pruneCache = function(cache) {
    const source = asCacheObject(cache);
    const now = Date.now();
    const retained = new Set(this.getCacheIdsNewestFirst(source).slice(0, this.getCacheRetentionFloor()));
    let changed = false;

    Object.keys(source).forEach((id) => {
      const ts = getEntryTs(source[id]);
      if ((!ts || now - ts > this.cacheMaxAgeMs) && !retained.has(id)) {
        delete source[id];
        changed = true;
      }
    });

    const ids = this.getCacheIdsNewestFirst(source);
    const maxEntries = this.getCacheMaxEntries();
    if (ids.length > maxEntries) {
      ids.slice(maxEntries).forEach((id) => {
        delete source[id];
        changed = true;
      });
    }

    return changed;
  };
})();
