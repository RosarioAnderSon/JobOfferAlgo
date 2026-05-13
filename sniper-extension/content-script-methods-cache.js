(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

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

  UpworkSniperExtension.prototype.pruneCache = function(cache) {
    const now = Date.now();
    let changed = false;

    Object.keys(cache).forEach((id) => {
      const ts = cache[id]?.ts;
      if (!ts || now - ts > this.cacheMaxAgeMs) {
        delete cache[id];
        changed = true;
      }
    });

    const ids = Object.keys(cache);
    if (ids.length > this.cacheMaxEntries) {
      ids
        .sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0))
        .slice(0, ids.length - this.cacheMaxEntries)
        .forEach((id) => {
          delete cache[id];
          changed = true;
        });
    }

    return changed;
  };

  UpworkSniperExtension.prototype.loadCache = function() {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const cache = parsed && typeof parsed === 'object' ? parsed : {};
      const changed = this.pruneCache(cache);
      if (changed) this.saveCache(cache);
      return cache;
    } catch (e) {
      logError('CACHE', 'No se pudo leer cache', e);
      return {};
    }
  };

  UpworkSniperExtension.prototype.saveCache = function(cache) {
    const isQuotaError = (error) =>
      !!error &&
      (error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.code === 1014 ||
        /quota/i.test(String(error.message || '')));

    const compactForStorage = (source) => {
      const compacted = {};
      Object.keys(source || {}).forEach((jobId) => {
        const entry = source[jobId];
        if (!entry || typeof entry !== 'object') return;
        compacted[jobId] = {
          result: entry.result || null,
          // Reducir tamaño: conservar solo metrica historica y quitar payload grande.
          rawData: null,
          ts: entry.ts || Date.now(),
          badgeSchemaVersion: Number(entry.badgeSchemaVersion) || this.getBadgeSchemaVersion(),
          metricsHistory: Array.isArray(entry.metricsHistory) ? entry.metricsHistory.slice(-8) : [],
        };
      });
      return compacted;
    };

    const trimOldestEntries = (source, keepCount) => {
      const next = { ...(source || {}) };
      const ids = Object.keys(next).sort((a, b) => (next[b]?.ts || 0) - (next[a]?.ts || 0));
      ids.slice(keepCount).forEach((id) => delete next[id]);
      return next;
    };

    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch (e) {
      if (!isQuotaError(e)) {
        logError('CACHE', 'No se pudo guardar cache', e);
        return;
      }

      // Fallback 1: compactar payload para guardar lo esencial.
      try {
        const compacted = compactForStorage(cache);
        localStorage.setItem(this.cacheKey, JSON.stringify(compacted));
        return;
      } catch (compactError) {
        if (!isQuotaError(compactError)) {
          logError('CACHE', 'No se pudo guardar cache compactado', compactError);
          return;
        }
      }

      // Fallback 2: poda agresiva de entradas antiguas y reintento.
      try {
        const ids = Object.keys(cache || {});
        const keepCount = Math.max(20, Math.floor(ids.length / 2));
        const trimmed = trimOldestEntries(compactForStorage(cache), keepCount);
        localStorage.setItem(this.cacheKey, JSON.stringify(trimmed));
      } catch (finalError) {
        logError('CACHE', 'No se pudo guardar cache tras compactar/podar', finalError);
      }
    }
  };

  UpworkSniperExtension.prototype.setCachedResult = function(jobId, result, rawData = null) {
    if (!jobId || !result) return;

    const cache = this.loadCache();
    const now = Date.now();

    // Extraer metricas clave para comparacion de estancamiento.
    const currentMetrics = rawData
      ? {
          proposalCount: rawData.proposalCount ?? 0,
          interviewing: rawData.interviewing ?? 0,
          invitesSent: rawData.invitesSent ?? 0,
          unansweredInvites: rawData.unansweredInvites ?? 0,
        }
      : null;

    const existing = cache[jobId];
    let metricsHistory = existing?.metricsHistory || [];

    // Anadir entrada al historial solo cada 2h para no saturar.
    if (currentMetrics) {
      const lastEntry = metricsHistory[metricsHistory.length - 1];
      const twoHoursMs = 2 * 60 * 60 * 1000;
      if (!lastEntry || now - lastEntry.ts >= twoHoursMs) {
        metricsHistory.push({ ...currentMetrics, ts: now });
      }
      if (metricsHistory.length > 14) {
        metricsHistory = metricsHistory.slice(-14);
      }
    }

    cache[jobId] = {
      result,
      rawData,
      ts: now,
      badgeSchemaVersion: this.getBadgeSchemaVersion(),
      metricsHistory,
    };
    if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
      const badgeList = Array.isArray(result.badges) ? result.badges : [];
      this.diagBadge(`cache-write jobId=${jobId} badgeCount=${badgeList.length} stale=false`, badgeList);
    }

    this.pruneCache(cache);
    this.saveCache(cache);
  };

  UpworkSniperExtension.prototype.getCachedResult = function(jobId) {
    const cache = this.loadCache();
    return cache[jobId]?.result || null;
  };

  // Calcula cuantos dias han pasado desde la ultima vez que las metricas cambiaron.
  UpworkSniperExtension.prototype.getStagnantDays = function(jobId) {
    const cache = this.loadCache();
    const entry = cache[jobId];
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
    if (this.overlayFeedPassInProgress) {
      return { mutated: false, skipped: 'locked' };
    }
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
        const hasSniperUi = !!document.querySelector('.sniper-overlay, .sniper-left-panel, .sniper-global-missing-skills');
        if (!hasSniperUi) {
          return { mutated: false, cards: 0, skipped: 'empty-cache-no-ui' };
        }
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

        const cachedEntry = cache[jobId];
        const stale = this.isCacheEntryBadgeSchemaStale(cachedEntry);
        const cached = cachedEntry?.result;
        if (!cached) return;
        if (stale) {
          const staleOverlay = card.querySelector(`.sniper-overlay[data-job-id="${jobId}"]`);
          if (staleOverlay) staleOverlay.remove();
          const stalePanel = card.querySelector(`.sniper-left-panel[data-job-id="${jobId}"]`);
          if (stalePanel) stalePanel.remove();
          if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
            const staleBadges = Array.isArray(cached.badges) ? cached.badges : [];
            this.diagBadge(`cache-read jobId=${jobId} stale=true badgeCount=${staleBadges.length}`, staleBadges);
          }
          return;
        }

        // Check both inner card and resolved outer card for existing overlays
        const outerCard = typeof this.resolveOuterCard === 'function' ? this.resolveOuterCard(card) : card;
        const existingOverlayForCard = outerCard.querySelector('.sniper-overlay[data-job-id]');
        if (existingOverlayForCard) {
          const existingJobId = existingOverlayForCard.getAttribute('data-job-id');
          if (existingJobId === jobId) {
            return;
          }
        }

        this.cleanupOverlays(card, jobId);
        if (outerCard !== card) this.cleanupOverlays(outerCard, jobId);

        const existingOverlay = outerCard.querySelector(`.sniper-overlay[data-job-id="${jobId}"]`);
        if (existingOverlay) return;

        const legacyOverlay = outerCard.querySelector('.sniper-overlay:not([data-job-id])');
        if (legacyOverlay) return;

        this.injectOverlay(card, cached, cachedEntry?.rawData || null, jobId);
        if (typeof this.diagBadge === 'function' && this.isBadgeDiagEnabled()) {
          const renderedBadges = Array.isArray(cached.badges) ? cached.badges : [];
          this.diagBadge(`cache-read jobId=${jobId} stale=false badgeCount=${renderedBadges.length}`, renderedBadges);
        }
        mutated = true;
        mutatedCount += 1;
      });

      this.renderGlobalMissingSkillsSidebar();
      if (mutatedCount > 0) {
        logSuccess(`Overlay inyectado desde cache: ${mutatedCount}`);
      }
      return { mutated, cards: cards.length, mutatedCount, truncated };
    } catch (error) {
      logError('CACHE', 'Fallo en applyCachedOverlaysToFeed()', error);
      return { mutated: false, error: true };
    } finally {
      this.overlayFeedPassInProgress = false;
    }
  };
})();
