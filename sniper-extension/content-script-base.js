(() => {
  'use strict';

  // ============================================
  // ANDERSON'S SNIPER EXTENSION - SPA Ready
  // Detecta navegacion en Upwork sin recargar pagina
  // ============================================

  const PREFIX = '[Sniper]';
  const DEBUG = true;
  const LOG_LEVEL_KEY = 'sniper-log-level-v1';
  const BADGE_DIAG_KEY = 'sniper-diag-badges-v1';
  const LEGACY_VERBOSE = localStorage.getItem('sniper-debug-verbose-v1') === '1';
  const LOG_LEVEL = (() => {
    const raw = String(localStorage.getItem(LOG_LEVEL_KEY) || '').trim().toLowerCase();
    if (raw === 'verbose' || LEGACY_VERBOSE) return 'verbose';
    return 'minimal';
  })();
  const DEBUG_VERBOSE = LOG_LEVEL === 'verbose';

  const colorMap = {
    INIT: '#9C27B0',
    ROUTE: '#FF9800',
    DETAIL: '#2196F3',
    'FASE 2': '#4CAF50',
  };

  const shouldEmitMinimalLog = (phase, message) => {
    const text = String(message || '');
    if (phase === 'ROUTE') {
      return text.startsWith('Cambio de URL detectado') || text === 'No estamos en un job detail';
    }
    if (phase === 'DETAIL') {
      return text.startsWith('Detectado job detail:');
    }
    return false;
  };

  const log = (phase, message, data = null) => {
    if (!DEBUG) return;
    if (!DEBUG_VERBOSE && !shouldEmitMinimalLog(phase, message)) return;
    const color = colorMap[phase] || '#666';
    console.log(`%c${PREFIX} ${phase}:`, `color: ${color}; font-weight: bold`, message, data || '');
  };

  const logSuccess = (message) => {
    if (!DEBUG) return;
    if (!DEBUG_VERBOSE && !String(message || '').startsWith('Overlay inyectado')) return;
    console.log(`%c${PREFIX} OK`, 'color: #66BB6A; font-weight: bold', message);
  };

  const logError = (phase, message, error = null) => {
    console.error(`%c${PREFIX} ERR ${phase}:`, 'color: #F44336; font-weight: bold', message, error || '');
  };

  const logVerbose = (phase, message, data = null) => {
    if (!DEBUG || !DEBUG_VERBOSE) return;
    const color = colorMap[phase] || '#666';
    console.log(`%c${PREFIX} ${phase}:`, `color: ${color}; font-weight: bold`, message, data || '');
  };

  const isBadgeDiagEnabled = () => localStorage.getItem(BADGE_DIAG_KEY) === '1';
  const logDiag = (phase, message, data = null) => {
    if (!DEBUG || !isBadgeDiagEnabled()) return;
    const color = '#607D8B';
    console.log(`%c${PREFIX} DIAG ${phase}:`, `color: ${color}; font-weight: bold`, message, data || '');
  };

  class UpworkSniperExtension {
    constructor() {
      this.currentJobId = null;
      this.lastUrl = window.location.href;
      this.cacheKey = 'sniper-cache-v1';
      this.languageKey = 'sniper-language-v1';
      this.profileSkillsKey = 'sniper-profile-skills-v1';
      this.missingSkillsCounterKey = 'sniper-missing-skills-counter-v1';
      this.missingSkillsSeenJobsKey = 'sniper-missing-skills-seen-jobs-v1';
      this.missingSkillsByJobKey = 'sniper-missing-skills-by-job-v1';
      this.missingSkillsMinScoreKey = 'sniper-missing-skills-min-score-v1';
      this.missingSkillsCollapsedKey = 'sniper-missing-skills-collapsed-v1';
      this.missingSkillsTopSnapshotKey = 'sniper-missing-skills-top-v1';
      this.selectedNicheKey = 'sniper-selected-niche-v1';
      this.nicheKey = 'sniper-niche-pref';
      this.weightsKey = 'sniper-score-weights-v2';
      this.weightsSeenVersionKey = 'sniper-weights-seen-version-v1';
      this.badgeSchemaVersion = 2;
      this.badgeDiagFlagKey = BADGE_DIAG_KEY;
      this.overlaySchedulerTimeoutId = null;
      this.overlaySchedulerInFlight = false;
      this.overlayIdleStreak = 0;
      this.overlayWarmupTicks = 5;
      this.overlayMethodsWarnedMissing = false;
      this.overlayRuntimeStatus = 'boot';
      this.lastOverlayActivityReason = '';
      this.lastOverlayActivityAt = 0;
      this.lastUrlChangeHandledUrl = window.location.href;
      this.lastUrlChangeHandledAt = 0;
      this.lastModalDetailProbeAt = 0;
      this.lastModalDetailProbeSignature = '';
      this.overlayOrphanCleanupNeeded = true;
      this.overlayOrphanCleanupEveryTicks = 6;
      this.overlayMutationBudgetPerTick = 4;
      this.language = localStorage.getItem(this.languageKey) === 'es' ? 'es' : 'en';
      this.cacheMaxEntries = 200;
      this.cacheMaxAgeMs = 12 * 60 * 60 * 1000; // 12 horas
      log('INIT', "Anderson's Sniper Extension activated");
      log('INIT', 'content-script injected (load check)');
      this.init();
    }

    init() {
      this.watchUrlChanges();
      this.watchDetailModalChanges();
      this.checkCurrentPage();
      this.startOverlayRefreshScheduler();
      document.addEventListener('visibilitychange', () => {
        this.markOverlayActivity('visibility-change');
      });
    }

    getOverlayMethodNames() {
      return [
        'applyCachedOverlaysToFeed',
        'getCardJobId',
        'removeOrphanOverlays',
        'cleanupOverlays',
        'getFeedJobLinks',
        'extractJobIdFromHref',
      ];
    }

    hasOverlayRuntimeReady() {
      const overlayModuleLoaded = window.__sniperOverlayLoaded === true;
      if (!overlayModuleLoaded) {
        if (this.overlayRuntimeStatus !== 'overlay-script-not-loaded') {
          logError('OVERLAY', 'Modulo de overlay no cargo. Posible parse error en content-script-methods-flow-overlay.js');
        }
        this.overlayRuntimeStatus = 'overlay-script-not-loaded';
        this.overlayMethodsWarnedMissing = false;
        return false;
      }

      const missing = this.getOverlayMethodNames().filter((name) => typeof this[name] !== 'function');
      if (missing.length > 0) {
        const missingStatus = `methods-missing:${missing.join(',')}`;
        if (this.overlayRuntimeStatus !== missingStatus) {
          logError('OVERLAY', `Modulo overlay cargado, pero faltan metodos: ${missing.join(', ')}`);
        }
        this.overlayRuntimeStatus = missingStatus;
        this.overlayMethodsWarnedMissing = true;
        return false;
      }
      this.overlayMethodsWarnedMissing = false;
      this.overlayRuntimeStatus = 'ready';
      return true;
    }

    markOverlayActivity(reason = 'activity') {
      const now = Date.now();
      const isDuplicateActivity =
        reason === this.lastOverlayActivityReason && now - this.lastOverlayActivityAt < 700;
      if (isDuplicateActivity) {
        return;
      }
      this.lastOverlayActivityReason = reason;
      this.lastOverlayActivityAt = now;
      this.overlayIdleStreak = 0;
      this.overlayWarmupTicks = Math.max(this.overlayWarmupTicks, 4);
      log('ROUTE', `Overlay scheduler reset (${reason})`);
      if (reason === 'url-change' || reason === 'job-detail-open') {
        this.overlayOrphanCleanupNeeded = true;
      }
      if (this.overlaySchedulerTimeoutId) {
        clearTimeout(this.overlaySchedulerTimeoutId);
        this.overlaySchedulerTimeoutId = null;
      }
      this.scheduleOverlayRefresh(220);
    }

    startOverlayRefreshScheduler() {
      if (this.overlaySchedulerTimeoutId) clearTimeout(this.overlaySchedulerTimeoutId);
      this.scheduleOverlayRefresh(250);
    }

    scheduleOverlayRefresh(delayMs) {
      const baseDelay = Number.isFinite(delayMs) ? Math.max(200, delayMs) : 1500;
      this.overlaySchedulerTimeoutId = setTimeout(() => this.runOverlayRefreshTick(), baseDelay);
    }

    getNextOverlayDelay(mutated = false) {
      const jitter = Math.floor(Math.random() * 220);

      if (document.hidden) {
        return 8000 + jitter;
      }

      if (mutated) {
        this.overlayWarmupTicks = Math.max(this.overlayWarmupTicks, 2);
      }

      if (this.overlayWarmupTicks > 0) {
        this.overlayWarmupTicks -= 1;
        return 900 + jitter;
      }

      if (this.overlayIdleStreak >= 35) return 12000 + jitter;
      if (this.overlayIdleStreak >= 20) return 9000 + jitter;
      if (this.overlayIdleStreak >= 12) return 6000 + jitter;
      if (this.overlayIdleStreak >= 7) return 3800 + jitter;
      if (this.overlayIdleStreak >= 3) return 2400 + jitter;
      return 1500 + jitter;
    }

    runOverlayRefreshTick() {
      if (this.overlaySchedulerInFlight) {
        this.scheduleOverlayRefresh(1200);
        return;
      }

      if (document.hidden) {
        this.scheduleOverlayRefresh(this.getNextOverlayDelay(false));
        return;
      }

      if (!this.hasOverlayRuntimeReady()) {
        const retryDelay = this.overlayRuntimeStatus === 'overlay-script-not-loaded' ? 9000 : 4500;
        this.scheduleOverlayRefresh(retryDelay + Math.floor(Math.random() * 350));
        return;
      }

      this.overlaySchedulerInFlight = true;
      let mutated = false;

      try {
        const result = this.applyCachedOverlaysToFeed();
        mutated = !!(result && typeof result === 'object' && (result.mutated || result.truncated));
      } catch (error) {
        logError('OVERLAY', 'Error ejecutando applyCachedOverlaysToFeed()', error);
        mutated = true;
      } finally {
        this.overlaySchedulerInFlight = false;
      }

      this.overlayIdleStreak = mutated ? 0 : this.overlayIdleStreak + 1;
      const nextDelay = this.getNextOverlayDelay(mutated);
      this.scheduleOverlayRefresh(nextDelay);
    }

    t(key) {
      const lang = this.language === 'es' ? 'es' : 'en';
      const dict = {
        en: {
          killed: 'Killed',
          reasons: 'Reasons:',
          scoreDetail: 'Score breakdown',
          base: 'Base',
          bonus: 'Bonus',
          penalty: 'Penalty',
          hireRate: 'Hire rate',
          spend: 'Spend',
          rating: 'Rating',
          activity: 'Activity',
          proposals: 'Proposals',
          payment: 'Payment',
          jobsPosted: 'Jobs posted',
          noHiresHistory: 'No hire history',
          noSpendHistory: 'No spend history',
          ratingBelow: 'Rating {rating}/5 (<4.0) with {reviews} reviews',
          noRatingBelow: 'No rating or rating <4.0',
          seenHoursAgo: 'Seen {hours}h ago',
          noLastViewed: 'No last viewed available (assumed cold)',
          highCompetition: '{count}+ proposals (high competition)',
          noProposals: 'No proposals available (assumed high)',
          paymentUnverified: 'Payment not verified',
          settings: 'Settings',
          feedback: 'Send feedback to',
          possibleNames: 'Possible client names',
          possibleNamesNoMatch: "Detected from Client's recent history",
          possibleNamesDetected: '{names}',
          supportAvgBadge: 'Avg/hr',
          supportAvgAbove: 'Above benchmark',
          supportAvgOn: 'On benchmark',
          supportAvgBelow: 'Below benchmark',
          supportAvgUnavailable: 'Benchmark unavailable',
          niche: 'Niche',
          nicheCustomerService: 'Customer Service',
          nicheCustomerSupport: 'Customer Support',
          nicheCustomerSpecialist: 'Customer Specialist',
          skillsMatchBadge: 'Skills match',
          skillsNeedProfile: 'Open your freelancer profile to load skills, then reopen the job.',
          skillsMissingTitle: 'Missing skills',
          skillsMissingNone: 'No missing skills',
          skillsMinScoreLabel: 'Min score',
          skillsMinScore0: '0+',
          skillsMinScore50: '50+',
          skillsMinScore80: '80+',
          resetSkills: 'Reset skills counters',
          resetDone: 'Skills counters reset',
          copyEmail: 'Copy email',
          emailCopied: 'Email copied',
          emailCopyFailed: 'Could not copy email',
          language: 'Language',
          scoreWeightsTitle: 'Score Weights',
          scoreWeightsInfo:
            'Each weight controls how much that part affects the score.\nHigher weight means more impact.\nIf the total is not 100, it is adjusted automatically.',
          scoreWeightsCurrentTotal: 'Current total weight: {total}',
          saveWeights: 'Save Changes',
          resetWeights: 'Reset',
          weightsSavedDone: 'Changes saved',
          weightsResetDone: 'Weights reset',
        },
        es: {
          killed: 'Eliminado',
          reasons: 'Motivos:',
          scoreDetail: 'Detalle del score',
          base: 'Base',
          bonus: 'Bonus',
          penalty: 'Penalty',
          hireRate: 'Tasa de contrato',
          spend: 'Gasto total',
          rating: 'Calificación',
          activity: 'Actividad',
          proposals: 'Propuestas',
          payment: 'Pago',
          jobsPosted: 'Trabajos pub.',
          noHiresHistory: 'Sin historial de hires',
          noSpendHistory: 'Sin gasto histórico',
          ratingBelow: 'Rating {rating}/5 (<4.0) con {reviews} reviews',
          noRatingBelow: 'Sin rating o rating <4.0',
          seenHoursAgo: 'Visto hace {hours}h',
          noLastViewed: 'Sin "last viewed" visible (asumido frío)',
          highCompetition: '{count}+ propuestas (competencia alta)',
          noProposals: 'Propuestas no disponibles (asumidas altas)',
          paymentUnverified: 'Payment no verificado',
          settings: 'Ajustes',
          feedback: 'Enviar feedback a',
          possibleNames: 'Posibles nombres del cliente',
          possibleNamesNoMatch: 'Detectado desde el historial reciente del cliente',
          possibleNamesDetected: '{names}',
          supportAvgBadge: 'Avg/hr',
          supportAvgAbove: 'Por encima del benchmark',
          supportAvgOn: 'En el benchmark',
          supportAvgBelow: 'Por debajo del benchmark',
          supportAvgUnavailable: 'Benchmark no disponible',
          niche: 'Niche',
          nicheCustomerService: 'Customer Service',
          nicheCustomerSupport: 'Customer Support',
          nicheCustomerSpecialist: 'Customer Specialist',
          skillsMatchBadge: 'Match de skills',
          skillsNeedProfile: 'Abre tu perfil freelancer para cargar skills y luego vuelve a abrir el job.',
          skillsMissingTitle: 'Skills faltantes',
          skillsMissingNone: 'No faltan skills',
          skillsMinScoreLabel: 'Score mínimo',
          skillsMinScore0: '0+',
          skillsMinScore50: '50+',
          skillsMinScore80: '80+',
          resetSkills: 'Reset contadores de skills',
          resetDone: 'Contadores de skills reiniciados',
          copyEmail: 'Copiar correo',
          emailCopied: 'Correo copiado',
          emailCopyFailed: 'No se pudo copiar el correo',
          language: 'Idioma',
          scoreWeightsTitle: 'Valores del Algoritmo',
          scoreWeightsInfo:
            'Cada peso define cuanto influye esa parte en el score.\nMas peso significa mas impacto.\nSi el total no es 100, se ajusta automaticamente.',
          scoreWeightsCurrentTotal: 'Peso total actual: {total}',
          saveWeights: 'Guardar',
          resetWeights: 'Restaurar',
          weightsSavedDone: 'Cambios guardados',
          weightsResetDone: 'Pesos restaurados',
        },
      };
      return (dict[lang] && dict[lang][key]) || key;
    }

    setLanguage(lang) {
      this.language = lang === 'es' ? 'es' : 'en';
      localStorage.setItem(this.languageKey, this.language);
      this.refreshOverlaysFromCache();
    }

    getDefaultWeights() {
      return {
        hireRate: { weight: 30, thresholds: { A: 90, B: 70, C: 50 } },
        spend: { weight: 25, thresholds: { A: 1000, B: 500, C: 200 } },
        rating: { weight: 15, thresholds: { A: 4.8, min: 4.0 } },
        activity: { weight: 10, thresholds: { fresh: 12, recent: 24 } },
        proposals: { weight: 10, thresholds: { A: 5, B: 10, C: 15 } },
        payment: { weight: 5, thresholds: {} },
        jobs: { weight: 5, thresholds: { A: 10, B: 1 } },
      };
    }

    getScoreWeights() {
      try {
        const stored = localStorage.getItem(this.weightsKey);
        if (stored) return JSON.parse(stored);

        // Migration from v1
        const rawV1 = localStorage.getItem('sniper-score-weights-v1');
        if (rawV1) {
           const v1 = JSON.parse(rawV1);
           const v2 = this.getDefaultWeights();
           Object.keys(v1).forEach(k => {
             if(v2[k] && typeof v1[k] === 'number') {
               v2[k].weight = v1[k];
             }
           });
           this.setScoreWeights(v2, true);
           return v2;
        }
      } catch (e) {
        logError('SETTINGS', 'Error loading score weights', e);
      }
      return this.getDefaultWeights();
    }

    setScoreWeights(weights, skipRefresh = false) {
      localStorage.setItem(this.weightsKey, JSON.stringify(weights));
      if (!skipRefresh) this.refreshOverlaysFromCache();
    }

    resetScoreWeights() {
      localStorage.removeItem(this.weightsKey);
      this.refreshOverlaysFromCache();
    }

    hasSeenWeightsUpdate() {
      const currentVersion = chrome.runtime.getManifest().version;
      const seenVersion = localStorage.getItem(this.weightsSeenVersionKey);
      return seenVersion === currentVersion;
    }

    markWeightsUpdateSeen() {
      const currentVersion = chrome.runtime.getManifest().version;
      localStorage.setItem(this.weightsSeenVersionKey, currentVersion);
    }

    watchUrlChanges() {
      log('INIT', 'Observando cambios de URL para SPA navigation');

      // popstate para navegacion del historial
      window.addEventListener('popstate', () => this.onUrlChange('popstate'));

      // interceptar pushState / replaceState
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        const res = originalPushState.apply(history, args);
        this.onUrlChange('pushState');
        return res;
      };

      history.replaceState = (...args) => {
        const res = originalReplaceState.apply(history, args);
        this.onUrlChange('replaceState');
        return res;
      };
    }

    watchDetailModalChanges() {
      if (this.modalDetailObserver) return;
      const observerTarget = document.body || document.documentElement;
      if (!observerTarget) return;

      this.modalDetailObserver = new MutationObserver(() => {
        const modal = document.querySelector(
          '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
        );
        if (!modal) return;

        const now = Date.now();
        const modalSignature =
          modal.getAttribute('data-opening-uid') ||
          modal.getAttribute('data-ev-opening_uid') ||
          modal.getAttribute('data-job-id') ||
          '';
        const signature = `${window.location.href}|${modalSignature}`;
        if (signature === this.lastModalDetailProbeSignature && now - this.lastModalDetailProbeAt < 900) {
          return;
        }
        this.lastModalDetailProbeSignature = signature;
        this.lastModalDetailProbeAt = now;
        this.checkCurrentPage();
      });

      this.modalDetailObserver.observe(observerTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-opening-uid', 'data-ev-opening_uid', 'data-job-id'],
      });
    }

    onUrlChange(trigger = 'unknown') {
      const url = window.location.href;
      const now = Date.now();
      if (url === this.lastUrlChangeHandledUrl && now - this.lastUrlChangeHandledAt < 900) {
        logVerbose('ROUTE', `Cambio de URL duplicado ignorado (${trigger}) -> ${url}`);
        return;
      }
      this.lastUrlChangeHandledUrl = url;
      this.lastUrlChangeHandledAt = now;
      this.lastUrl = url;
      log('ROUTE', `Cambio de URL detectado -> ${url}`);
      this.markOverlayActivity('url-change');
      this.checkCurrentPage();
    }

    checkCurrentPage() {
      const url = window.location.href;
      const detailMatch = url.match(/\/details\/~([A-Za-z0-9]+)/);
      const modalJobId = this.getOpenModalJobId();
      const jobId = detailMatch?.[1] || modalJobId;

      if (jobId) {
        if (jobId === this.currentJobId) {
          log('DETAIL', `Job ${jobId} ya procesado, saltando`);
          return;
        }

        this.currentJobId = jobId;
        log('DETAIL', `Detectado job detail: ${jobId}`);
        this.markOverlayActivity('job-detail-open');
        this.waitForJobContent(jobId);
      } else {
        this.currentJobId = null;
        if (this.isFreelancerProfilePage()) {
          log('ROUTE', 'Freelancer profile detectado, extrayendo skills de perfil');
          this.captureFreelancerProfileSkills();
          return;
        }
        log('ROUTE', 'No estamos en un job detail');
      }
    }

    getOpenModalJobId() {
      const modal = document.querySelector(
        '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
      );
      if (!modal) return null;

      const parseJobIdCandidate = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const fromHref = raw.match(/~([A-Za-z0-9]+)/);
        if (fromHref) return fromHref[1];
        if (/^[A-Za-z0-9]{18,}$/.test(raw) && (raw.startsWith('0') || /^\d{18,}$/.test(raw))) {
          return raw;
        }
        return null;
      };

      const modalAndNestedNodes = [
        modal,
        ...Array.from(modal.querySelectorAll('[data-opening-uid], [data-ev-opening_uid], [data-job-id]')),
      ];
      for (const node of modalAndNestedNodes) {
        if (!(node instanceof Element)) continue;
        const attrCandidate =
          node.getAttribute('data-opening-uid') ||
          node.getAttribute('data-ev-opening_uid') ||
          node.getAttribute('data-job-id');
        const parsed = parseJobIdCandidate(attrCandidate);
        if (parsed) return parsed;
      }

      const jobLink = modal.querySelector('a[href*="/details/~"], a[href*="~"]');
      const href = jobLink?.getAttribute('href') || jobLink?.href || '';
      return parseJobIdCandidate(href);
    }

    isBadgeDiagEnabled() {
      return localStorage.getItem(this.badgeDiagFlagKey || BADGE_DIAG_KEY) === '1';
    }

    diagBadge(message, data = null) {
      logDiag('BADGES', message, data);
    }

    isFreelancerProfilePage() {
      return /\/freelancers\/~[A-Za-z0-9]+/i.test(window.location.pathname || '');
    }
  }

  window.UpworkSniperExtension = UpworkSniperExtension;
  window.SniperLog = {
    log,
    logSuccess,
    logError,
    logVerbose,
    logDiag,
    isVerbose: DEBUG_VERBOSE,
    logLevel: LOG_LEVEL,
    isBadgeDiagEnabled,
  };
})();
