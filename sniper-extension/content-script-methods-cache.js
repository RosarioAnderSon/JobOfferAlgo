(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.loadCache = function() {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      const changed = this.pruneCache(cache);
      if (changed) this.saveCache(cache);
      return cache;
    } catch (e) {
      logError('CACHE', 'No se pudo leer cache', e);
      return {};
    }
  };

  UpworkSniperExtension.prototype.saveCache = function(cache) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch (e) {
      if (!this.isCacheQuotaError(e)) {
        logError('CACHE', 'No se pudo guardar cache', e);
        return;
      }

      try {
        const compacted = this.compactCacheForStorage(cache);
        localStorage.setItem(this.cacheKey, JSON.stringify(compacted));
        return;
      } catch (compactError) {
        if (!this.isCacheQuotaError(compactError)) {
          logError('CACHE', 'No se pudo guardar cache compactado', compactError);
          return;
        }
      }

      try {
        const ids = Object.keys(cache || {});
        const keepCount = Math.max(this.getCacheRetentionFloor(), Math.floor(ids.length / 2));
        const trimmed = this.trimCacheToNewestEntries(this.compactCacheForStorage(cache), keepCount);
        localStorage.setItem(this.cacheKey, JSON.stringify(trimmed));
      } catch (finalError) {
        logError('CACHE', 'No se pudo guardar cache tras compactar/podar', finalError);
      }
    }
  };

  UpworkSniperExtension.prototype.setCachedResult = function(jobId, result, rawData = null) {
    if (!jobId || !result) return;
    if (typeof this.flow === 'function') {
      this.flow('cache-write', { jobId, reason: `score=${result.finalScore}` });
    }

    const cache = this.loadCache();
    const cacheKey = this.getCacheKeyForJobId(jobId) || jobId;
    const now = Date.now();
    const currentMetrics = rawData
      ? {
          proposalCount: rawData.proposalCount ?? 0,
          interviewing: rawData.interviewing ?? 0,
          invitesSent: rawData.invitesSent ?? 0,
          unansweredInvites: rawData.unansweredInvites ?? 0,
        }
      : null;
    const existing = this.resolveCachedEntryForJobId(jobId, cache)?.entry;
    let metricsHistory = Array.isArray(existing?.metricsHistory) ? existing.metricsHistory : [];

    if (currentMetrics) {
      const lastEntry = metricsHistory[metricsHistory.length - 1];
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (!lastEntry || now - lastEntry.ts >= twoHoursMs) {
        metricsHistory.push({ ...currentMetrics, ts: now });
      }
      if (metricsHistory.length > 14) metricsHistory = metricsHistory.slice(-14);
    }

    cache[cacheKey] = {
      result,
      rawData,
      ts: now,
      badgeSchemaVersion: this.getBadgeSchemaVersion(),
      metricsHistory,
    };
    this.removeCacheAliasesForJobId(jobId, cache, cacheKey);

    if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
      const badgeList = Array.isArray(result.badges) ? result.badges : [];
      this.diagBadge(`cache-write jobId=${jobId} badgeCount=${badgeList.length} stale=false`, badgeList);
    }
    this.pruneCache(cache);
    this.saveCache(cache);
  };

  UpworkSniperExtension.prototype.getCachedResult = function(jobId) {
    const cache = this.loadCache();
    return this.resolveCachedEntryForJobId(jobId, cache)?.entry?.result || null;
  };

  UpworkSniperExtension.prototype.getStagnantDays = function(jobId) {
    const cache = this.loadCache();
    const entry = this.resolveCachedEntryForJobId(jobId, cache)?.entry;
    if (!entry?.metricsHistory || entry.metricsHistory.length < 2) return 0;

    const history = entry.metricsHistory;
    const latest = history[history.length - 1];
    for (let i = history.length - 2; i >= 0; i--) {
      const older = history[i];
      const hasChange =
        older.proposalCount !== latest.proposalCount ||
        older.interviewing !== latest.interviewing ||
        older.invitesSent !== latest.invitesSent ||
        older.unansweredInvites !== latest.unansweredInvites;
      if (hasChange) {
        const nextEntry = history[i + 1];
        const daysSinceChange = (Date.now() - nextEntry.ts) / (24 * 60 * 60 * 1000);
        return Math.floor(daysSinceChange);
      }
    }

    const firstEntry = history[0];
    const daysSinceFirst = (Date.now() - firstEntry.ts) / (24 * 60 * 60 * 1000);
    return Math.floor(daysSinceFirst);
  };

  UpworkSniperExtension.prototype.applyCachedOverlaysToFeed = function() {
    if (typeof this.flow === 'function') {
      this.flow('feed-pass-start', { reason: 'applyCachedOverlaysToFeed' });
    }
    if (this.overlayFeedPassInProgress) return { mutated: false, skipped: 'locked' };

    this.overlayFeedPassInProgress = true;
    let mutated = false;
    let mutatedCount = 0;
    let truncated = false;

    try {
      if (typeof this.hasOverlayRuntimeReady === 'function' && !this.hasOverlayRuntimeReady()) {
        return { mutated: false, skipped: 'missing-methods' };
      }

      this.overlayFeedTickCount = (this.overlayFeedTickCount || 0) + 1;
      const cleanupEvery = Number(this.overlayOrphanCleanupEveryTicks) > 0 ? Number(this.overlayOrphanCleanupEveryTicks) : 6;
      const shouldCleanupOrphans =
        this.overlayOrphanCleanupNeeded || this.overlayFeedTickCount % cleanupEvery === 0;
      if (shouldCleanupOrphans) {
        this.removeOrphanOverlays();
        this.overlayOrphanCleanupNeeded = false;
      }

      const cache = this.loadCache();
      if (Object.keys(cache).length === 0) {
        if (typeof this.flow === 'function') this.flow('cache-miss', { reason: 'empty-cache' });
        const hasSniperUi = !!document.querySelector('.sniper-overlay, .sniper-left-panel, .sniper-global-missing-skills');
        if (!hasSniperUi) return { mutated: false, cards: 0, skipped: 'empty-cache-no-ui' };
        this.renderGlobalMissingSkillsSidebar();
        return { mutated: false, cards: 0 };
      }

      const cards =
        typeof this.getFeedJobCards === 'function'
          ? this.getFeedJobCards(document)
          : Array.from(document.querySelectorAll('section.air3-card-section, article.job-tile, [data-test="job-tile"]'));
      const budgetRaw = Number(this.overlayMutationBudgetPerTick);
      const mutationBudget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.floor(budgetRaw) : 4;

      cards.forEach((card) => {
        if (mutatedCount >= mutationBudget) {
          truncated = true;
          return;
        }

        const jobId = this.getCardJobId(card);
        if (!jobId) return;

        const cachedMatch = this.resolveCachedEntryForJobId(jobId, cache);
        const cachedEntry = cachedMatch?.entry;
        const stale = this.isCacheEntryBadgeSchemaStale(cachedEntry);
        const cached = cachedEntry?.result;
        if (!cached) {
          if (typeof this.flow === 'function') {
            this.flow('cache-miss', { jobId, reason: 'entry-without-result' });
          }
          return;
        }

        const outerCard = typeof this.resolveOuterCard === 'function' ? this.resolveOuterCard(card) : card;

        if (typeof this.flow === 'function') {
          const reason = stale ? 'stale' : cachedMatch?.key === jobId ? 'fresh' : 'fresh-variant';
          this.flow('cache-hit', { jobId, reason });
        }
        if (stale) {
          if (typeof this.removeOverlaysForJob === 'function') {
            this.removeOverlaysForJob(outerCard, jobId, 'cache-stale-job-ui');
          }
          if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
            const staleBadges = Array.isArray(cached.badges) ? cached.badges : [];
            this.diagBadge(`cache-read jobId=${jobId} stale=true badgeCount=${staleBadges.length}`, staleBadges);
          }
          return;
        }

        const existingOverlayForCard =
          typeof this.findOverlayForJob === 'function'
            ? this.findOverlayForJob(outerCard, jobId)
            : outerCard.querySelector('.sniper-overlay[data-job-id]');
        if (existingOverlayForCard) {
          const existingJobId = existingOverlayForCard.getAttribute('data-job-id');
          const isSameExistingJob =
            typeof this.isSameJobId === 'function'
              ? this.isSameJobId(existingJobId, jobId)
              : String(existingJobId || '').trim() === String(jobId || '').trim();
          if (isSameExistingJob) {
            this.cleanupOverlays(outerCard, jobId);
            if (typeof this.flow === 'function') {
              this.flow('overlay-retained-check', {
                rawOverlayJobId: existingJobId || null,
                rawResolvedCardJobId: jobId || null,
                normalizedOverlayJobId:
                  typeof this.normalizeJobIdForCompare === 'function'
                    ? this.normalizeJobIdForCompare(existingJobId)
                    : existingJobId || null,
                normalizedResolvedCardJobId:
                  typeof this.normalizeJobIdForCompare === 'function'
                    ? this.normalizeJobIdForCompare(jobId)
                    : jobId || null,
                variantsOverlay:
                  typeof this.getComparableJobIdVariants === 'function'
                    ? Array.from(this.getComparableJobIdVariants(existingJobId))
                    : existingJobId
                      ? [String(existingJobId)]
                      : [],
                variantsResolved:
                  typeof this.getComparableJobIdVariants === 'function'
                    ? Array.from(this.getComparableJobIdVariants(jobId))
                    : jobId
                      ? [String(jobId)]
                      : [],
                reason: 'dedupe-existing-overlay',
              });
            }
            return;
          }
        }

        this.cleanupOverlays(card, jobId);
        if (outerCard !== card) this.cleanupOverlays(outerCard, jobId);
        const existingOverlay =
          typeof this.findOverlayForJob === 'function'
            ? this.findOverlayForJob(outerCard, jobId)
            : outerCard.querySelector(`.sniper-overlay[data-job-id="${jobId}"]`);
        if (existingOverlay) return;
        if (typeof this.removeOverlaysForJob === 'function') {
          this.removeOverlaysForJob(outerCard, jobId, 'cache-inject-cleanup');
        }

        this.injectOverlay(card, cached, cachedEntry?.rawData || null, jobId);
        if (typeof this.flow === 'function') this.flow('inject-from-cache', { jobId, reason: 'feed-pass' });
        if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
          const renderedBadges = Array.isArray(cached.badges) ? cached.badges : [];
          this.diagBadge(`cache-read jobId=${jobId} stale=false badgeCount=${renderedBadges.length}`, renderedBadges);
        }
        mutated = true;
        mutatedCount += 1;
      });

      this.renderGlobalMissingSkillsSidebar();
      if (mutatedCount > 0) logSuccess(`Overlay inyectado desde cache: ${mutatedCount}`);
      return { mutated, cards: cards.length, mutatedCount, truncated };
    } catch (error) {
      logError('CACHE', 'Fallo en applyCachedOverlaysToFeed()', error);
      return { mutated: false, error: true };
    } finally {
      this.overlayFeedPassInProgress = false;
      if (typeof this.flow === 'function') this.flow('feed-pass-end', { reason: 'complete' });
    }
  };
})();
