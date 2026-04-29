(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

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
    }

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
    }

  UpworkSniperExtension.prototype.saveCache = function(cache) {
      try {
        localStorage.setItem(this.cacheKey, JSON.stringify(cache));
      } catch (e) {
        logError('CACHE', 'No se pudo guardar cache', e);
      }
    }

  UpworkSniperExtension.prototype.setCachedResult = function(jobId, result, rawData = null) {
      if (!jobId || !result) return;
      const cache = this.loadCache();
      const now = Date.now();

      // Extraer mÃ©tricas clave para comparaciÃ³n de estancamiento
      const currentMetrics = rawData ? {
        proposalCount: rawData.proposalCount ?? 0,
        interviewing: rawData.interviewing ?? 0,
        invitesSent: rawData.invitesSent ?? 0,
        unansweredInvites: rawData.unansweredInvites ?? 0,
      } : null;

      const existing = cache[jobId];
      let metricsHistory = existing?.metricsHistory || [];

      // AÃ±adir nueva entrada a historial si hay mÃ©tricas
      if (currentMetrics) {
        // Solo aÃ±adir si han pasado al menos 2h desde Ãºltima entrada para no saturar
        const lastEntry = metricsHistory[metricsHistory.length - 1];
        const twoHoursMs = 2 * 60 * 60 * 1000;
        if (!lastEntry || (now - lastEntry.ts) >= twoHoursMs) {
          metricsHistory.push({ ...currentMetrics, ts: now });
        }
        // Mantener solo Ãºltimas 14 entradas (~14 visitas = detecciÃ³n de ~7 dÃ­as)
        if (metricsHistory.length > 14) {
          metricsHistory = metricsHistory.slice(-14);
        }
      }

      cache[jobId] = {
        result,
        rawData,
        ts: now,
        metricsHistory,
      };
      this.pruneCache(cache);
      this.saveCache(cache);
    }

  UpworkSniperExtension.prototype.getCachedResult = function(jobId) {
      const cache = this.loadCache();
      return cache[jobId]?.result || null;
    }

    /**
     * Calcula cuÃ¡ntos dÃ­as han pasado desde la Ãºltima vez que las mÃ©tricas cambiaron.
     * Retorna 0 si no hay historial suficiente o si hubo cambios recientes.
     */

  UpworkSniperExtension.prototype.getStagnantDays = function(jobId) {
      const cache = this.loadCache();
      const entry = cache[jobId];
      if (!entry?.metricsHistory || entry.metricsHistory.length < 2) return 0;

      const history = entry.metricsHistory;
      const latest = history[history.length - 1];

      // Buscar hacia atrÃ¡s hasta encontrar un cambio
      for (let i = history.length - 2; i >= 0; i--) {
        const older = history[i];
        const hasChange =
          older.proposalCount !== latest.proposalCount ||
          older.interviewing !== latest.interviewing ||
          older.invitesSent !== latest.invitesSent ||
          older.unansweredInvites !== latest.unansweredInvites;

        if (hasChange) {
          // Hubo cambio entre esta entrada y la siguiente, calcular dÃ­as desde entonces
          const nextEntry = history[i + 1];
          const daysSinceChange = (Date.now() - nextEntry.ts) / (24 * 60 * 60 * 1000);
          return Math.floor(daysSinceChange);
        }
      }

      // No hubo cambios en todo el historial, calcular desde la primera entrada
      const firstEntry = history[0];
      const daysSinceFirst = (Date.now() - firstEntry.ts) / (24 * 60 * 60 * 1000);
      return Math.floor(daysSinceFirst);
    }

  UpworkSniperExtension.prototype.applyCachedOverlaysToFeed = function() {
      this.removeOrphanOverlays();
      const cache = this.loadCache();
      const entries = Object.entries(cache);
      if (entries.length === 0) {
        this.renderGlobalMissingSkillsSidebar();
        return;
      }

      // Buscar todos los links a jobs en el feed (fuera del modal)
      const isInsideModal = (el) => el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');
      const links = Array.from(
        document.querySelectorAll('a[href*="/details/~"], a[href*="~"]')
      ).filter((a) => !isInsideModal(a));

      links.forEach((link) => {
        const match = link.href.match(/~([A-Za-z0-9]+)/);
        if (!match) return;
        const jobId = match[1];
        const cachedEntry = cache[jobId];
        const cached = cachedEntry?.result;
        if (!cached) return;

        const card = link.closest('section.air3-card-section, article.job-tile, [data-test="job-tile"]');
        if (!card || isInsideModal(card)) return;

        // Limpiar overlays de otros jobs si la card fue reciclada
        this.cleanupOverlays(card, jobId);

        // Verificar si ya existe un overlay para ESTE job especÃ­fico
        const existingOverlay = card.querySelector(`.sniper-overlay[data-job-id="${jobId}"]`);
        if (existingOverlay) return;

        // Si hay un overlay legacy (sin job-id), no lo tocamos para evitar conflictos
        const legacyOverlay = card.querySelector('.sniper-overlay:not([data-job-id])');
        if (legacyOverlay) return;

        this.injectOverlay(card, cached, cachedEntry?.rawData || null, jobId);
      });
      this.renderGlobalMissingSkillsSidebar();
    }

})();
