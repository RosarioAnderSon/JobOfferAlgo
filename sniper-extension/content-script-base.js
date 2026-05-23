(() => {
  'use strict';
  // ============================================
  // ANDERSON'S SNIPER EXTENSION - SPA Ready
  // Detecta navegacion en Upwork sin recargar pagina
  // ============================================
  const PREFIX = '[Sniper]';
  const DEBUG = true;
  const LOG_LEVEL_KEY = 'sniper-log-level-v1';
  const FLOW_CONSOLE_KEY = 'sniper-flow-console-v1';
  const BADGE_DIAG_KEY = 'sniper-diag-badges-v1';
  const ERROR_LOG_KEY = 'sniper-error-log-v1';
  const FLOW_LOG_KEY = 'sniper-flow-log-v1';
  const PERSIST_LOGS_KEY = 'sniper-persist-logs-v1';
  const ERROR_LOG_MAX = 120;
  const FLOW_LOG_MAX = 300;
  let memoryErrorLogBuffer = [];
  let memoryFlowLogBuffer = [];
  const LEGACY_VERBOSE = localStorage.getItem('sniper-debug-verbose-v1') === '1';
  const LOG_LEVEL = (() => {
    const raw = String(localStorage.getItem(LOG_LEVEL_KEY) || '').trim().toLowerCase();
    if (raw === 'verbose' || LEGACY_VERBOSE) return 'verbose';
    if (raw === 'error') return 'error';
    return 'off';
  })();
  const DEBUG_VERBOSE = LOG_LEVEL === 'verbose';
  const DEBUG_ERROR = LOG_LEVEL === 'error' || LOG_LEVEL === 'verbose';
  const colorMap = {
    INIT: '#9C27B0',
    ROUTE: '#FF9800',
    DETAIL: '#2196F3',
    'FASE 2': '#4CAF50',
  };
  const normalizeError = (error) => {
    if (!error) return null;
    if (error instanceof Error) {
      return {
        name: error.name || 'Error',
        message: error.message || '',
        stack: error.stack || '',
      };
    }
    return {
      name: typeof error,
      message: String(error),
      stack: '',
    };
  };
  const readErrorLogBuffer = () => {
    if (localStorage.getItem(PERSIST_LOGS_KEY) !== '1') {
      return memoryErrorLogBuffer.slice();
    }
    try {
      const raw = localStorage.getItem(ERROR_LOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  };
  const writeErrorLogBuffer = (entries) => {
    if (localStorage.getItem(PERSIST_LOGS_KEY) !== '1') {
      memoryErrorLogBuffer = Array.isArray(entries) ? entries.slice() : [];
      return;
    }
    try {
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(entries));
    } catch (_error) {
      // No-op: no debemos romper runtime por logger.
    }
  };
  const appendErrorLog = (phase, message, error = null) => {
    const normalized = normalizeError(error);
    const currentJobId = window.__sniperCurrentJobId || null;
    const entry = {
      ts: new Date().toISOString(),
      phase: String(phase || 'UNKNOWN'),
      message: String(message || ''),
      jobId: normalized?.jobId || null,
      currentJobId,
      href: window.location.href,
      error: normalized,
    };
    const next = readErrorLogBuffer();
    next.push(entry);
    if (next.length > ERROR_LOG_MAX) {
      next.splice(0, next.length - ERROR_LOG_MAX);
    }
    writeErrorLogBuffer(next);
    return entry;
  };
  const readFlowLogBuffer = () => {
    if (localStorage.getItem(PERSIST_LOGS_KEY) !== '1') {
      return memoryFlowLogBuffer.slice();
    }
    try {
      const raw = localStorage.getItem(FLOW_LOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  };
  const writeFlowLogBuffer = (entries) => {
    if (localStorage.getItem(PERSIST_LOGS_KEY) !== '1') {
      memoryFlowLogBuffer = Array.isArray(entries) ? entries.slice() : [];
      return;
    }
    try {
      localStorage.setItem(FLOW_LOG_KEY, JSON.stringify(entries));
    } catch (_error) {
      // No-op
    }
  };
  const isFlowConsoleEnabled = () => {
    const flowConsoleEnabled = localStorage.getItem(FLOW_CONSOLE_KEY) === '1';
    const runtimeLogLevel = String(localStorage.getItem(LOG_LEVEL_KEY) || '').trim().toLowerCase();
    return flowConsoleEnabled || runtimeLogLevel === 'verbose' || LEGACY_VERBOSE;
  };
  const appendFlowLog = (phase, payload = {}) => {
    const event = {
      ts: new Date().toISOString(),
      phase: String(phase || 'unknown'),
      jobId: payload.jobId || null,
      currentJobId:
        Object.prototype.hasOwnProperty.call(payload, 'currentJobId')
          ? payload.currentJobId
          : window.__sniperCurrentJobId || null,
      reason: payload.reason || '',
      sessionId: Number(payload.sessionId || 0) || 0,
      url: window.location.href,
    };
    const next = readFlowLogBuffer();
    next.push(event);
    if (next.length > FLOW_LOG_MAX) {
      next.splice(0, next.length - FLOW_LOG_MAX);
    }
    writeFlowLogBuffer(next);
    if (DEBUG && isFlowConsoleEnabled()) {
      console.log(`[Sniper] FLOW: ${event.phase}`, {
        jobId: event.jobId,
        currentJobId: event.currentJobId,
        reason: event.reason,
        sessionId: event.sessionId,
        url: event.url,
      });
    }
    return event;
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
    appendErrorLog(phase, message, error);
    if (!DEBUG || !DEBUG_ERROR) return;
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
      this.detailWatcherSessionId = 0;
      this.detailWatcherIntervalId = null;
      this.language = localStorage.getItem(this.languageKey) === 'es' ? 'es' : 'en';
      this.cacheMaxEntries = 200;
      this.cacheMaxAgeMs = 12 * 60 * 60 * 1000; // 12 horas
      window.__sniperCurrentJobId = this.currentJobId;
      this.flow('init', { reason: 'constructor' });
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
    normalizeJobIdForCompare(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (/^\d+$/.test(raw)) {
        const stripped = raw.replace(/^0+/, '');
        return stripped || '0';
      }
      return raw;
    }
    getComparableJobIdVariants(value) {
      const raw = String(value || '').trim();
      const variants = new Set();
      if (!raw) return variants;
      variants.add(raw);
      const normalized = this.normalizeJobIdForCompare(raw);
      if (normalized) variants.add(normalized);
      if (/^\d+$/.test(raw)) {
        // Upwork en algunos flujos expone el mismo opening UID con prefijo "02".
        if (raw.length >= 18 && raw.startsWith('02')) {
          const without02 = raw.slice(2);
          const normalizedWithout02 = this.normalizeJobIdForCompare(without02);
          if (without02) variants.add(without02);
          if (normalizedWithout02) variants.add(normalizedWithout02);
        }
      }
      return variants;
    }
    isSameJobId(a, b) {
      const leftVariants = this.getComparableJobIdVariants(a);
      const rightVariants = this.getComparableJobIdVariants(b);
      if (leftVariants.size === 0 || rightVariants.size === 0) return false;
      for (const candidate of leftVariants) {
        if (rightVariants.has(candidate)) return true;
      }
      return false;
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
        activity: { weight: 10, thresholds: { fresh: 1, recent: 3 } },
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
    isBadgeDiagEnabled() {
      return localStorage.getItem(this.badgeDiagFlagKey || BADGE_DIAG_KEY) === '1';
    }
    diagBadge(message, data = null) {
      logDiag('BADGES', message, data);
    }
    flow(phase, payload = {}) {
      return appendFlowLog(phase, payload);
    }
    getErrorLogs() {
      return readErrorLogBuffer();
    }
    clearErrorLogs() {
      writeErrorLogBuffer([]);
    }
    exportErrorLogs() {
      return JSON.stringify(readErrorLogBuffer());
    }
    getFlowLogs() {
      return readFlowLogBuffer();
    }
    clearFlowLogs() {
      writeFlowLogBuffer([]);
    }
    exportFlowLogs() {
      return JSON.stringify(readFlowLogBuffer());
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
  window.SniperErrorLog = {
    getErrors: () => readErrorLogBuffer(),
    clearErrors: () => writeErrorLogBuffer([]),
    exportErrors: () => JSON.stringify(readErrorLogBuffer()),
  };
  window.SniperFlowLog = {
    getEvents: () => readFlowLogBuffer(),
    clearEvents: () => writeFlowLogBuffer([]),
    exportEvents: () => JSON.stringify(readFlowLogBuffer()),
  };
})();
