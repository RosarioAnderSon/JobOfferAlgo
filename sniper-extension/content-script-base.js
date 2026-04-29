(() => {
  'use strict';

  // ============================================
  // ANDERSON'S SNIPER EXTENSION - SPA Ready
  // Detecta navegacion en Upwork sin recargar pagina
  // ============================================

  const PREFIX = '[Sniper]';
  const DEBUG = true;

  const colorMap = {
    INIT: '#9C27B0',
    ROUTE: '#FF9800',
    DETAIL: '#2196F3',
    'FASE 2': '#4CAF50',
  };

  const log = (phase, message, data = null) => {
    if (!DEBUG) return;
    const color = colorMap[phase] || '#666';
    console.log(`%c${PREFIX} ${phase}:`, `color: ${color}; font-weight: bold`, message, data || '');
  };

  const logSuccess = (message) => {
    if (!DEBUG) return;
    console.log(`%c${PREFIX} OK`, 'color: #66BB6A; font-weight: bold', message);
  };

  const logError = (phase, message, error = null) => {
    console.error(`%c${PREFIX} ERR ${phase}:`, 'color: #F44336; font-weight: bold', message, error || '');
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
      this.language = localStorage.getItem(this.languageKey) === 'es' ? 'es' : 'en';
      this.cacheMaxEntries = 200;
      this.cacheMaxAgeMs = 12 * 60 * 60 * 1000; // 12 horas
      log('INIT', "Anderson's Sniper Extension activated");
      log('INIT', 'content-script injected (load check)');
      this.init();
    }

    init() {
      this.watchUrlChanges();
      this.checkCurrentPage();
      // Pintar overlays desde cache en el feed aunque no abramos el modal
      setInterval(() => this.applyCachedOverlaysToFeed(), 1500);
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
        },
        es: {
          killed: 'Eliminado',
          reasons: 'Motivos:',
          scoreDetail: 'Detalle del score',
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
        },
      };
      return (dict[lang] && dict[lang][key]) || key;
    }

    setLanguage(lang) {
      this.language = lang === 'es' ? 'es' : 'en';
      localStorage.setItem(this.languageKey, this.language);
      this.refreshOverlaysFromCache();
    }

    watchUrlChanges() {
      log('INIT', 'Observando cambios de URL para SPA navigation');

      // popstate para navegacion del historial
      window.addEventListener('popstate', () => this.onUrlChange());

      // polling como respaldo
      setInterval(() => {
        if (window.location.href !== this.lastUrl) {
          this.lastUrl = window.location.href;
          this.onUrlChange();
        }
      }, 500);

      // interceptar pushState / replaceState
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        const res = originalPushState.apply(history, args);
        this.onUrlChange();
        return res;
      };

      history.replaceState = (...args) => {
        const res = originalReplaceState.apply(history, args);
        this.onUrlChange();
        return res;
      };
    }

    onUrlChange() {
      const url = window.location.href;
      log('ROUTE', `Cambio de URL detectado -> ${url}`);
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

      const jobLink = modal.querySelector('a[href*="/details/~"], a[href*="~"]');
      const href = jobLink?.getAttribute('href') || '';
      const match = href.match(/~([A-Za-z0-9]+)/);
      return match ? match[1] : null;
    }

    isFreelancerProfilePage() {
      return /\/freelancers\/~[A-Za-z0-9]+/i.test(window.location.pathname || '');
    }
  }

  window.UpworkSniperExtension = UpworkSniperExtension;
  window.SniperLog = { log, logSuccess, logError };
})();
