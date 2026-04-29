(() => {
  'use strict';

  // ============================================
  // ANDERSON'S SNIPER EXTENSION - SPA Ready
  // Detecta navegaciÃ³n en Upwork sin recargar pÃ¡gina
  // ============================================

  const PREFIX = '[ðŸŽ¯ Sniper]';
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
    console.log(
      `%c${PREFIX} ${phase}:`,
      `color: ${color}; font-weight: bold`,
      message,
      data || ''
    );
  };

  const logSuccess = (message) => {
    if (!DEBUG) return;
    console.log(`%c${PREFIX} âœ…`, 'color: #66BB6A; font-weight: bold', message);
  };

  const logError = (phase, message, error = null) => {
    console.error(`%c${PREFIX} âŒ ${phase}:`, 'color: #F44336; font-weight: bold', message, error || '');
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
      // Pintar overlays desde cachÃ© en el feed aunque no abramos el modal
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
          possibleNamesDetected: 'Detected names: {names}',
          supportAvgBadge: 'Support Avg/hr',
          supportAvgAbove: 'Above benchmark',
          supportAvgOn: 'On benchmark',
          supportAvgBelow: 'Below benchmark',
          supportAvgUnavailable: 'Benchmark unavailable',
          skillsMatchBadge: 'Skills match',
          skillsNeedProfile: 'Open your freelancer profile to load skills, then reopen the job.',
          skillsMissingTitle: 'Missing skills',
          skillsMissingNone: 'No missing skills',
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
          noSpendHistory: 'Sin gasto historico',
          ratingBelow: 'Rating {rating}/5 (<4.0) con {reviews} reviews',
          noRatingBelow: 'Sin rating o rating <4.0',
          seenHoursAgo: 'Visto hace {hours}h',
          noLastViewed: 'Sin "last viewed" visible (asumido frio)',
          highCompetition: '{count}+ propuestas (competencia alta)',
          noProposals: 'Propuestas no disponibles (asumidas altas)',
          paymentUnverified: 'Payment no verificado',
          settings: 'Ajustes',
          feedback: 'Enviar feedback a',
          possibleNames: 'Posibles nombres del cliente',
          possibleNamesNoMatch: "Detectado desde el historial reciente del cliente",
          possibleNamesDetected: 'Nombres detectados: {names}',
          supportAvgBadge: 'Support Avg/hr',
          supportAvgAbove: 'Por encima del benchmark',
          supportAvgOn: 'En el benchmark',
          supportAvgBelow: 'Por debajo del benchmark',
          supportAvgUnavailable: 'Benchmark no disponible',
          skillsMatchBadge: 'Match de skills',
          skillsNeedProfile: 'Abre tu perfil freelancer para cargar skills y luego vuelve a abrir el job.',
          skillsMissingTitle: 'Skills faltantes',
          skillsMissingNone: 'No faltan skills',
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

      // popstate para navegaciÃ³n del historial
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

      if (detailMatch) {
        const jobId = detailMatch[1];
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

    isFreelancerProfilePage() {
      return /\/freelancers\/~[A-Za-z0-9]+/i.test(window.location.pathname || '');
    }

    normalizeSkillLabel(value) {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    toDisplaySkillLabel(value) {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    dedupeSkills(skills) {
      const seen = new Set();
      const out = [];
      (skills || []).forEach((skill) => {
        const display = this.toDisplaySkillLabel(skill);
        if (!display) return;
        const normalized = this.normalizeSkillLabel(display);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        out.push(display);
      });
      return out;
    }

    extractSkillsFromElement(root) {
      if (!root) return [];
      const candidateNodes = Array.from(
        root.querySelectorAll(
          '[data-test="token-container"] .air3-token, [data-test="token-container"] [role="button"], [data-test="token-container"] button, [data-test="token-container"] span, .skills-list .badge, .skills-list [role="button"], .skills-list button, .air3-token-container .air3-token, .air3-token-container button'
        )
      );
      const blocked = new Set([
        'skip skills',
        'previous skills. update list',
        'next skills. update list',
        'skills',
        'must have skills:',
        'required skills',
      ]);
      const extracted = candidateNodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => {
          if (!text) return false;
          const normalized = text.toLowerCase();
          if (blocked.has(normalized)) return false;
          if (normalized.includes('skip skills')) return false;
          if (normalized.includes('update list')) return false;
          if (text.length < 2 || text.length > 48) return false;
          return true;
        });
      return this.dedupeSkills(extracted);
    }

    extractJobRequiredSkills(scope) {
      return this.extractSkillsFromElement(scope || document);
    }

    extractFreelancerProfileSkills() {
      return this.extractSkillsFromElement(document);
    }

    loadProfileSkillsCache() {
      try {
        const raw = localStorage.getItem(this.profileSkillsKey);
        if (!raw) return { skills: [], updatedAt: 0, sourceUrl: null };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { skills: [], updatedAt: 0, sourceUrl: null };
        const skills = Array.isArray(parsed.skills) ? this.dedupeSkills(parsed.skills) : [];
        return {
          skills,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
          sourceUrl: parsed.sourceUrl || null,
        };
      } catch (error) {
        logError('DETAIL', 'No se pudo leer cache de skills de perfil', error);
        return { skills: [], updatedAt: 0, sourceUrl: null };
      }
    }

    saveProfileSkillsCache(skills, sourceUrl) {
      try {
        const payload = {
          skills: this.dedupeSkills(skills),
          updatedAt: Date.now(),
          sourceUrl: sourceUrl || window.location.href,
        };
        localStorage.setItem(this.profileSkillsKey, JSON.stringify(payload));
      } catch (error) {
        logError('DETAIL', 'No se pudo guardar cache de skills de perfil', error);
      }
    }

    captureFreelancerProfileSkills() {
      const skills = this.extractFreelancerProfileSkills();
      if (!skills.length) {
        log('DETAIL', 'No se detectaron skills en perfil freelancer');
        return;
      }
      this.saveProfileSkillsCache(skills, window.location.href);
      log('DETAIL', `Skills de perfil guardados: ${skills.length}`);
    }

    waitForJobContent(jobId) {
      log('DETAIL', `Esperando a que cargue el contenido del job ${jobId}...`);

      let attempts = 0;
      const maxAttempts = 30; // 15s (mÃ¡s tiempo para React hydration)

      const checkInterval = setInterval(() => {
        attempts++;

        // ðŸ” Buscar SIEMPRE dentro del modal/panel de detalle del job
        const jobModal = document.querySelector(
          '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
        );

        if (!jobModal) {
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            logError('DETAIL', `Timeout esperando modal del job ${jobId} (${attempts * 500}ms)`);
          } else {
            log('DETAIL', `Intento ${attempts}/${maxAttempts}: Modal del job aÃºn no existe`);
          }
          return;
        }

        const clientInfo = jobModal.querySelector(
          '[data-test="client-info"], .client-info, aside.sidebar, .cfe-ui-job-about-client'
        );
        const jobDescription = jobModal.querySelector(
          '[data-test="Description"], .job-description, .description'
        );

        // ðŸ”¥ VALIDACIÃ“N: contenido real del sidebar del cliente
        const sidebarText = clientInfo?.innerText || clientInfo?.textContent || '';
        const sidebarTextLower = sidebarText.toLowerCase();
        const hasRealContent = ['member since', 'payment verified', 'payment method verified', 'jobs posted', 'total spent', 'hire rate'].some(
          (token) => sidebarTextLower.includes(token)
        );

        const modalText = jobModal.textContent || '';
        const modalTextLower = modalText.toLowerCase();
        const hasClientSection =
          modalTextLower.includes('about the client') || modalTextLower.includes('member since');

        log(
          'DETAIL',
          `Intento ${attempts}/${maxAttempts}: modal=${!!jobModal}, clientInfo=${!!clientInfo}, desc=${!!jobDescription}, realContent=${hasRealContent}, hasClientSection=${hasClientSection}`
        );

        if (clientInfo && jobDescription && (hasRealContent || hasClientSection)) {
          clearInterval(checkInterval);
          logSuccess('Sidebar del cliente listo; procediendo a evaluar');
          log('DETAIL', `âœ“ Contenido cargado despuÃ©s de ${attempts * 500}ms`);
          this.processJobDetail(jobId);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          logError(
            'DETAIL',
            `Timeout esperando contenido del job ${jobId} (${attempts * 500}ms). ` +
            `clientInfo: ${!!clientInfo}, jobDescription: ${!!jobDescription}, realContent: ${hasRealContent}, hasClientSection: ${hasClientSection}`
          );

          // Fallback: si el modal existe y hay elementos, intenta procesar
          if (jobModal && clientInfo && jobDescription) {
            log('DETAIL', 'Intentando procesar con contenido parcial...');
            this.processJobDetail(jobId);
          }
        }
      }, 500);
    }

    processJobDetail(jobId) {
      log('DETAIL', `Procesando job ${jobId}`);
      try {
        const extractedData = this.extractJobData();
        log('DETAIL', `Datos extraÃ­dos (job ${jobId})`, extractedData);
        this.evaluateAndRender(jobId, extractedData);
      } catch (error) {
        logError('DETAIL', `Error procesando job ${jobId}`, error);
      }
    }

    getJobScope() {
      // Prioriza el modal/panel de detalle del job para evitar ruido del resto de la pÃ¡gina (perfil, feed, etc.)
      const modal = document.querySelector(
        '[role="dialog"].air3-slider-job-details, .job-details-content, .air3-slider-job-details'
      );
      if (modal) return modal;

      // Fallback: contenedor principal o el body completo
      const detail = document.querySelector('.job-details, main');
      return detail || document.body;
    }

    extractHourlyRateFromText(text) {
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
    }

    isSupportNiche(requiredSkills, title, descriptionText) {
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
    }

    getSupportBenchmarkFromFeed() {
      const isInsideModal = (el) =>
        el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');
      const cards = Array.from(
        document.querySelectorAll('section.air3-card-section, article.job-tile, [data-test="job-tile"]')
      ).filter((card) => !isInsideModal(card));
      const rates = [];
      cards.forEach((card) => {
        const cardText = (card.innerText || card.textContent || '').toLowerCase();
        if (!this.isSupportNiche([], cardText, '')) return;
        const rate = this.extractHourlyRateFromText(cardText);
        if (rate !== null) rates.push(rate);
      });
      if (rates.length < 3) return null;
      const avg = rates.reduce((acc, value) => acc + value, 0) / rates.length;
      return {
        avg,
        sampleSize: rates.length,
      };
    }

    computeSupportAvgBadge(jobData) {
      if (!this.isSupportNiche(jobData.requiredSkills, jobData.jobTitle, jobData.descriptionText)) {
        return null;
      }
      const benchmark = this.getSupportBenchmarkFromFeed();
      const jobRate = this.extractHourlyRateFromText(
        [jobData.descriptionText || '', jobData.scopeText || '', jobData.activityText || ''].join(' ')
      );
      if (!benchmark || jobRate === null) {
        return {
          status: 'unavailable',
          benchmark: benchmark?.avg || null,
          sampleSize: benchmark?.sampleSize || 0,
          jobRate,
        };
      }
      const ratio = (jobRate - benchmark.avg) / benchmark.avg;
      const status = ratio > 0.1 ? 'above' : ratio < -0.1 ? 'below' : 'on';
      return {
        status,
        benchmark: benchmark.avg,
        sampleSize: benchmark.sampleSize,
        jobRate,
      };
    }

    loadMissingSkillsCounters() {
      try {
        const raw = localStorage.getItem(this.missingSkillsCounterKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        logError('DETAIL', 'No se pudo leer contadores de skills faltantes', error);
        return {};
      }
    }

    saveMissingSkillsCounters(counters) {
      try {
        localStorage.setItem(this.missingSkillsCounterKey, JSON.stringify(counters || {}));
      } catch (error) {
        logError('DETAIL', 'No se pudo guardar contadores de skills faltantes', error);
      }
    }

    loadMissingSkillsSeenJobs() {
      try {
        const raw = localStorage.getItem(this.missingSkillsSeenJobsKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        logError('DETAIL', 'No se pudo leer jobs ya contados para skills', error);
        return {};
      }
    }

    saveMissingSkillsSeenJobs(jobsMap) {
      try {
        localStorage.setItem(this.missingSkillsSeenJobsKey, JSON.stringify(jobsMap || {}));
      } catch (error) {
        logError('DETAIL', 'No se pudo guardar jobs ya contados para skills', error);
      }
    }

    resetSkillsTracking() {
      localStorage.removeItem(this.missingSkillsCounterKey);
      localStorage.removeItem(this.missingSkillsSeenJobsKey);
      localStorage.removeItem(this.profileSkillsKey);
    }

    computeSkillsMatch(requiredSkills, jobId) {
      const required = this.dedupeSkills(requiredSkills || []);
      const profileCache = this.loadProfileSkillsCache();
      const profileSkills = this.dedupeSkills(profileCache.skills || []);
      if (!required.length) {
        return {
          profileSkillsLoaded: profileSkills.length > 0,
          profileSkills,
          requiredSkills: [],
          matchedSkills: [],
          missingSkills: [],
        };
      }
      if (!profileSkills.length) {
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

      if (jobId && missing.length) {
        const seenJobs = this.loadMissingSkillsSeenJobs();
        if (!seenJobs[jobId]) {
          const counters = this.loadMissingSkillsCounters();
          missing.forEach((skill) => {
            const key = this.normalizeSkillLabel(skill);
            counters[key] = (counters[key] || 0) + 1;
          });
          seenJobs[jobId] = Date.now();
          this.saveMissingSkillsCounters(counters);
          this.saveMissingSkillsSeenJobs(seenJobs);
        }
      }

      return {
        profileSkillsLoaded: true,
        profileSkills,
        requiredSkills: required,
        matchedSkills: matched,
        missingSkills: missing,
      };
    }

    // =========================
    // FASE 1: EXTRACCIÃ“N
    // =========================
    extractJobData() {
      const scope = this.getJobScope(); // Modal/panel del job

      // ðŸ” Buscar el sidebar del cliente DENTRO del modal
      const sidebar = scope.querySelector(
        'aside.sidebar, .cfe-ui-job-about-client, [data-test="client-info"], .client-info'
      );

      // Si no hay sidebar explÃ­cito, intenta con la secciÃ³n "About the client"
      const aboutClientSection = Array.from(scope.querySelectorAll('h4, h3, h2')).find(
        (h) => h.textContent?.trim() === 'About the client'
      )?.nextElementSibling;

      const effectiveSidebar = sidebar || aboutClientSection || scope;

      // ðŸ”¥ Fallback: innerText respeta CSS visibility, textContent no
      // Si Upwork oculta/muestra elementos con CSS, textContent puede capturar mÃ¡s
      const sidebarText = effectiveSidebar?.innerText || effectiveSidebar?.textContent || '';

      // ðŸ”¥ LOG CRÃTICO para debugging
      log('DETAIL', `â”€â”€â”€â”€â”€â”€â”€ EXTRACCIÃ“N DE DATOS â”€â”€â”€â”€â”€â”€â”€`);
      log('DETAIL', `Scope selector: ${scope === document.body ? 'body' : scope.className || scope.tagName}`);
      log('DETAIL', `Sidebar found: ${!!sidebar} (${sidebar?.className || sidebar?.tagName || 'N/A'})`);
      log('DETAIL', `About client section: ${!!aboutClientSection}`);
      log('DETAIL', `Effective sidebar text length: ${sidebarText.length} chars`);
      log('DETAIL', `Effective sidebar first 400 chars: "${sidebarText.substring(0, 400).replace(/\\s+/g, ' ')}"`);

      const activityHeader = Array.from(scope.querySelectorAll('h5, h4')).find((el) =>
        el?.textContent?.includes('Activity on this job')
      );
      const activitySection =
        activityHeader?.parentElement || activityHeader?.closest('section') || effectiveSidebar?.parentElement || scope;
      const activityText = activitySection?.innerText || activitySection?.textContent || '';

      log('DETAIL', `Activity section found: ${!!activityHeader}`);
      log('DETAIL', `Activity text length: ${activityText.length} chars`);

      const descEl = scope.querySelector('[data-test="Description"], .job-description, .description');
      const descText = descEl?.innerText || descEl?.textContent || '';
      const titleEl = scope.querySelector('[data-test="job-title"], h1, .job-title');
      const titleText = titleEl?.innerText || titleEl?.textContent || '';
      const scopeText = scope.innerText || scope.textContent || document.body.innerText || '';
      const requiredSkills = this.extractJobRequiredSkills(scope);
      const extractors = window.SniperExtractors;
      if (!extractors) {
        throw new Error('SniperExtractors is not available');
      }
      const clientRatingText = extractors.getClientRatingText(scope, effectiveSidebar);

      log('DETAIL', `Description length: ${descText.length} chars`);
      log('DETAIL', `Total scope text length: ${scopeText.length} chars`);
      log('DETAIL', `â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€`);

      const extractedData = {
        jobId: this.currentJobId || null,
        memberSince: extractors.extractMemberSince(sidebarText || scopeText),
        jobsPosted: extractors.extractJobsPosted(sidebarText || scopeText),
        paymentVerified:
          sidebarText.includes('Payment verified') ||
          sidebarText.includes('Payment method verified') ||
          scopeText.includes('Payment verified'),
        totalSpent: extractors.extractSpent(sidebarText || scopeText),
        totalHires: extractors.extractHires(sidebarText || scopeText),
        hireRatePct: extractors.extractHireRate(sidebarText || scopeText),
        rating: extractors.extractRating(sidebarText || scopeText, clientRatingText),
        reviewsCount: extractors.extractReviews(sidebarText || scopeText, clientRatingText),
        hasLowRecentReview: extractors.extractHasLowRecentReview(sidebarText || scopeText),
        proposalCount: extractors.extractProposals(activityText || scopeText),
        lastViewed: extractors.extractLastViewed(activityText || scopeText),
        invitesSent: extractors.extractInvites(activityText || scopeText),
        unansweredInvites: extractors.extractUnansweredInvites(activityText || scopeText),
        interviewing: extractors.extractInterviewing(activityText || scopeText),
        jobTitle: titleText.trim() || undefined,
        descriptionText: descText,
        scopeText,
        activityText,
        requiredSkills,
        descriptionLength: descText.trim().length,
        clientCountry: extractors.extractCountry(sidebarText || scopeText),
        postedAt: extractors.extractPostedTime(scopeText),
        avgHourlyPaid: extractors.extractAvgHourly(sidebarText || scopeText),
        hasOffPlatformContact: extractors.extractOffPlatformContact(descText || scopeText),
        hasExternalPaymentRequest: extractors.extractExternalPaymentRisk(descText || scopeText),
        hasFreeWorkRequest: extractors.extractFreeWorkRequest(descText || scopeText),
        isTooGoodToBeTrue: extractors.extractTooGoodToBeTrue(descText || scopeText, sidebarText || scopeText),
        possibleClientNames: extractors.extractPossibleClientNames(scope),
        hasScopeMonster: extractors.extractScopeMonster(descText || scopeText),
        hasFreeConsultant: extractors.extractFreeConsultant(descText || scopeText),
        hasSilentHistory: extractors.extractSilentHistory(sidebarText || scopeText),
        hasBudgetMismatch: extractors.extractBudgetMismatch(scopeText, descText || scopeText),
        hasClearBrief: extractors.extractClearBrief(descText || scopeText),
        hasMilestoneFriendly: extractors.extractMilestoneFriendly(descText || scopeText),
        hasProfessionalTone: extractors.extractProfessionalTone(descText || scopeText),
        experienceLevel: extractors.extractExperienceLevel(scopeText),
        hasJobNoLongerAvailable: /job is no longer available/i.test(scopeText),
      };

      extractedData.supportAvgBadge = this.computeSupportAvgBadge(extractedData);
      extractedData.skillsMatch = this.computeSkillsMatch(requiredSkills, extractedData.jobId);

      // ðŸ”¥ LOG de valores extraÃ­dos para debugging
      log('DETAIL', `ðŸŽ¯ Valores extraÃ­dos:`);
      log('DETAIL', `  - jobsPosted: ${extractedData.jobsPosted}`);
      log('DETAIL', `  - totalHires: ${extractedData.totalHires}`);
      log('DETAIL', `  - totalSpent: $${extractedData.totalSpent}`);
      log('DETAIL', `  - hireRatePct: ${extractedData.hireRatePct}%`);
      log('DETAIL', `  - paymentVerified: ${extractedData.paymentVerified}`);
      log('DETAIL', `  - rating: ${extractedData.rating}`);
      log('DETAIL', `  - memberSince: ${extractedData.memberSince?.toDateString?.() || 'N/A'}`);
      log('DETAIL', `  - requiredSkills: ${requiredSkills.length}`);

      return extractedData;
    }


    // =========================
    // FASE 2: EVALUACIÃ“N / UI
    // =========================
    evaluateAndRender(jobId, data) {
      log('FASE 2', `Evaluando job ${jobId}`);

      if (typeof evaluateSniper !== 'function') {
        logError('FASE 2', 'evaluateSniper() no estÃ¡ disponible');
        return;
      }

      // Calcular dÃ­as de estancamiento basado en historial del cache
      const stagnantDays = this.getStagnantDays(jobId);
      if (stagnantDays > 0) {
        log('FASE 2', `Job ${jobId} detectado estancado por ${stagnantDays} dÃ­as`);
      }

      // AÃ±adir stagnantDays a los datos para el evaluador
      const enrichedData = { ...data, stagnantDays };

      const result = evaluateSniper(enrichedData);
      log('FASE 2', `Resultado job ${jobId}`, result);

      // Cachear para persistir tras refresh/navegaciÃ³n (con rawData para tracking histÃ³rico)
      this.setCachedResult(jobId, result, data);

      this.renderUI(result, data);
      logSuccess(`Renderizado completado para job ${jobId}`);
    }

    renderUI(result, rawData) {
      // Buscar la job card correspondiente en el feed (no dentro del modal/details)
      const jobCard = this.findJobCardById(this.currentJobId);

      if (jobCard) {
        this.removeOrphanOverlays();
        // Limpiar overlays de otros jobs (cards recicladas en el feed)
        this.cleanupOverlays(jobCard, this.currentJobId);

        // Remover solo el overlay de ESTE job (no de otros jobs en la misma card si hubiera)
        const existingOverlay = jobCard.querySelector(`.sniper-overlay[data-job-id="${this.currentJobId}"]`);
        if (existingOverlay) existingOverlay.remove();

        // TambiÃ©n remover overlay sin job-id (legacy) solo si no hay otro overlay con job-id diferente
        const legacyOverlay = jobCard.querySelector('.sniper-overlay:not([data-job-id])');
        if (legacyOverlay) legacyOverlay.remove();

        this.injectOverlay(jobCard, result, rawData, this.currentJobId);
        logSuccess(`Overlay inyectado en la job card para ${this.currentJobId}`);
      } else {
        logError('FASE 2', `No se encontrÃ³ la job card para inyectar overlay (job ${this.currentJobId})`);
      }
    }

    findJobCardById(jobId) {
      if (!jobId) return null;

      // Excluir todo lo que estÃ© dentro del modal de detalles
      const isInsideModal = (el) => el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');

      // 1) Buscar cards que contengan un link con el jobId
      const candidateCards = Array.from(
        document.querySelectorAll('section.air3-card-section, article.job-tile, [data-test="job-tile"]')
      ).filter((card) => !isInsideModal(card));

      const byLink = candidateCards.find((card) =>
        card.querySelector(`a[href*="/details/~${jobId}"], a[href*="~${jobId}"]`)
      );
      if (byLink) return byLink;

      // 2) Buscar link global al jobId fuera del modal y subir al contenedor
      const jobLinks = Array.from(document.querySelectorAll(`a[href*="/details/~${jobId}"], a[href*="~${jobId}"]`))
        .filter((a) => !isInsideModal(a));
      for (const link of jobLinks) {
        const card = link.closest('section.air3-card-section, article.job-tile, [data-test="job-tile"]');
        if (card && !isInsideModal(card)) return card;
      }

      // Si no hay coincidencia explÃ­cita, no forzar overlay en otra card
      return null;
    }

    cleanupOverlays(card, targetJobId = null) {
      if (!card) return;

      // Elimina overlays heredados o de otros jobs si la card fue reutilizada
      const overlays = Array.from(card.querySelectorAll('.sniper-overlay'));
      overlays.forEach((overlay) => {
        const overlayJobId = overlay.getAttribute('data-job-id');
        const isLegacy = !overlayJobId;
        const isDifferentJob = targetJobId && overlayJobId && overlayJobId !== targetJobId;
        if (isLegacy || isDifferentJob) {
          overlay.remove();
        }
      });

      const panels = Array.from(card.querySelectorAll('.sniper-left-panel'));
      panels.forEach((panel) => {
        const panelJobId = panel.getAttribute('data-job-id');
        const isLegacy = !panelJobId;
        const isDifferentJob = targetJobId && panelJobId && panelJobId !== targetJobId;
        if (isLegacy || isDifferentJob) {
          panel.remove();
        }
      });
    }

    removeOrphanOverlays() {
      const isInsideModal = (el) =>
        el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');

      const overlays = Array.from(document.querySelectorAll('.sniper-overlay'));
      overlays.forEach((overlay) => {
        const card = overlay.closest('section.air3-card-section, article.job-tile, [data-test="job-tile"]');
        if (!card || isInsideModal(card)) {
          overlay.remove();
          return;
        }

        const overlayJobId = overlay.getAttribute('data-job-id');
        if (!overlayJobId) {
          overlay.remove();
          return;
        }

        const linkForJob = card.querySelector(
          `a[href*="/details/~${overlayJobId}"], a[href*="~${overlayJobId}"]`
        );

        if (!linkForJob) {
          overlay.remove();
        }
      });

      const panels = Array.from(document.querySelectorAll('.sniper-left-panel'));
      panels.forEach((panel) => {
        const card = panel.closest('section.air3-card-section, article.job-tile, [data-test="job-tile"]');
        if (!card || isInsideModal(card)) {
          panel.remove();
          return;
        }

        const panelJobId = panel.getAttribute('data-job-id');
        if (!panelJobId) {
          panel.remove();
          return;
        }

        const linkForJob = card.querySelector(
          `a[href*="/details/~${panelJobId}"], a[href*="~${panelJobId}"]`
        );

        if (!linkForJob) {
          panel.remove();
        }
      });
    }

    injectOverlay(card, result, rawData, jobId = null) {
      // Crear el overlay container
      const overlay = document.createElement('div');
      overlay.className = 'sniper-overlay';

      // Agregar identificador del job para evitar sobreescrituras
      if (jobId) {
        overlay.setAttribute('data-job-id', jobId);
      }

      // Crear badges (solo Ã­conos)
      const badgesContainer = document.createElement('div');
      badgesContainer.className = 'sniper-badges';

      const displayBadges = [...(result.badges || [])];
      if (rawData?.supportAvgBadge) displayBadges.push('Support Avg/hr');
      if (rawData?.skillsMatch) displayBadges.push('Skills match');

      displayBadges.forEach((badge) => {
        const badgeEl = this.createBadge(badge, rawData);
        badgesContainer.appendChild(badgeEl);
      });

      // Crear score badge
      const scoreEl = this.createScoreBadge(result, rawData);
      const settingsEl = this.createSettingsButton();

      // Agregar al overlay: badges, score y settings
      overlay.appendChild(badgesContainer);
      overlay.appendChild(scoreEl);
      overlay.appendChild(settingsEl);

      const existingLeftPanel = card.querySelector(`.sniper-left-panel[data-job-id="${jobId}"]`);
      if (existingLeftPanel) existingLeftPanel.remove();
      const leftPanel = this.createMissingSkillsPanel(rawData, jobId);
      if (leftPanel) card.appendChild(leftPanel);

      // Inyectar en la card
      card.style.position = 'relative';
      card.appendChild(overlay);
    }

    createMissingSkillsPanel(rawData, jobId = null) {
      const skillsMatch = rawData?.skillsMatch;
      if (!skillsMatch) return null;

      const panel = document.createElement('div');
      panel.className = 'sniper-left-panel';
      if (jobId) panel.setAttribute('data-job-id', jobId);

      const title = document.createElement('div');
      title.className = 'sniper-left-panel-title';
      title.textContent = this.t('skillsMissingTitle');
      panel.appendChild(title);

      if (!skillsMatch.profileSkillsLoaded) {
        const msg = document.createElement('div');
        msg.className = 'sniper-left-panel-msg';
        msg.textContent = this.t('skillsNeedProfile');
        panel.appendChild(msg);
        return panel;
      }

      const missing = Array.isArray(skillsMatch.missingSkills) ? skillsMatch.missingSkills : [];
      if (!missing.length) {
        const msg = document.createElement('div');
        msg.className = 'sniper-left-panel-msg';
        msg.textContent = this.t('skillsMissingNone');
        panel.appendChild(msg);
        return panel;
      }

      const counters = this.loadMissingSkillsCounters();
      const list = document.createElement('ul');
      list.className = 'sniper-left-panel-list';
      missing.forEach((skill) => {
        const li = document.createElement('li');
        const key = this.normalizeSkillLabel(skill);
        const count = counters[key] || 0;
        li.textContent = `${skill} x${count}`;
        list.appendChild(li);
      });
      panel.appendChild(list);
      return panel;
    }

    createSettingsButton() {
      const wrap = document.createElement('div');
      wrap.className = 'sniper-settings-wrap';
      const feedbackEmail = 'anderrosariotav@gmail.com';

      const btn = document.createElement('button');
      btn.className = 'sniper-settings-btn';
      btn.type = 'button';
      btn.title = this.t('settings');
      btn.textContent = '\u2699';
      wrap.appendChild(btn);

      const panel = document.createElement('div');
      panel.className = 'sniper-settings-panel';
      panel.innerHTML = `
        <div class="sniper-settings-label">${this.t('language')}</div>
        <div class="sniper-settings-lang-row">
          <button type="button" class="sniper-lang-btn" data-lang="en">EN</button>
          <button type="button" class="sniper-lang-btn" data-lang="es">ES</button>
        </div>
        <div class="sniper-settings-feedback">${this.t('feedback')} <a href="#" class="sniper-feedback-email" data-email="${feedbackEmail}" title="${this.t('copyEmail')}">${feedbackEmail}</a></div>
        <button type="button" class="sniper-reset-skills-btn">${this.t('resetSkills')}</button>
        <div class="sniper-settings-copy-status" aria-live="polite"></div>
      `;
      wrap.appendChild(panel);

      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        panel.classList.toggle('open');
      });

      panel.querySelectorAll('.sniper-lang-btn').forEach((el) => {
        const lang = el.getAttribute('data-lang');
        if (lang === this.language) el.classList.add('active');
        el.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.setLanguage(lang);
        });
      });

      const feedbackLink = panel.querySelector('.sniper-feedback-email');
      const copyStatus = panel.querySelector('.sniper-settings-copy-status');
      if (feedbackLink && copyStatus) {
        feedbackLink.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const email = feedbackLink.getAttribute('data-email') || feedbackEmail;
          const copied = await this.copyTextToClipboard(email);
          copyStatus.textContent = copied ? this.t('emailCopied') : this.t('emailCopyFailed');
          copyStatus.classList.toggle('is-error', !copied);
          setTimeout(() => {
            if (copyStatus.textContent === this.t('emailCopied') || copyStatus.textContent === this.t('emailCopyFailed')) {
              copyStatus.textContent = '';
              copyStatus.classList.remove('is-error');
            }
          }, 1800);
        });
      }

      const resetBtn = panel.querySelector('.sniper-reset-skills-btn');
      if (resetBtn && copyStatus) {
        resetBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.resetSkillsTracking();
          copyStatus.textContent = this.t('resetDone');
          copyStatus.classList.remove('is-error');
          this.refreshOverlaysFromCache();
        });
      }

      document.addEventListener(
        'click',
        (event) => {
          if (!panel.classList.contains('open')) return;
          const target = event.target;
          if (target instanceof Node && wrap.contains(target)) return;
          panel.classList.remove('open');
        },
        { capture: true }
      );
      panel.addEventListener('click', (ev) => ev.stopPropagation());

      return wrap;
    }

    async copyTextToClipboard(text) {
      const value = String(text || '').trim();
      if (!value) return false;

      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
          return true;
        }
      } catch (error) {
        logError('DETAIL', 'Clipboard API failed, trying fallback', error);
      }

      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();

      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        logError('DETAIL', 'execCommand copy failed', error);
      }

      textarea.remove();
      return copied;
    }

    refreshOverlaysFromCache() {
      const overlays = Array.from(document.querySelectorAll('.sniper-overlay'));
      overlays.forEach((overlay) => overlay.remove());
      this.applyCachedOverlaysToFeed();
    }

    // =========================
    // CACHE LOCAL
    // =========================
    pruneCache(cache) {
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

    loadCache() {
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

    saveCache(cache) {
      try {
        localStorage.setItem(this.cacheKey, JSON.stringify(cache));
      } catch (e) {
        logError('CACHE', 'No se pudo guardar cache', e);
      }
    }

    setCachedResult(jobId, result, rawData = null) {
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

    getCachedResult(jobId) {
      const cache = this.loadCache();
      return cache[jobId]?.result || null;
    }

    /**
     * Calcula cuÃ¡ntos dÃ­as han pasado desde la Ãºltima vez que las mÃ©tricas cambiaron.
     * Retorna 0 si no hay historial suficiente o si hubo cambios recientes.
     */
    getStagnantDays(jobId) {
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

    applyCachedOverlaysToFeed() {
      this.removeOrphanOverlays();
      const cache = this.loadCache();
      const entries = Object.entries(cache);
      if (entries.length === 0) return;

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
    }

    createScoreBadge(result, rawData) {
      const scoreEl = document.createElement('div');
      const gradeClass = result.grade.replace('+', 'plus').replace('-', 'minus');
      scoreEl.className = `sniper-score grade-${gradeClass} has-tooltip`;

      scoreEl.innerHTML = `
        <span class="score-value">${result.finalScore}</span>
        <span class="score-grade">${result.grade}</span>
      `;

      const tooltip = this.createScoreTooltip(result, rawData);
      scoreEl.appendChild(tooltip);

      return scoreEl;
    }

    createScoreTooltip(result, rawData) {
      const tooltip = document.createElement('div');
      tooltip.className = 'sniper-score-tooltip';

      if (result.killSwitches && result.killSwitches.length > 0) {
        tooltip.innerHTML = `
          <div class="tooltip-title">${this.t('killed')}</div>
          <div class="tooltip-meta kill">${this.t('reasons')}</div>
          <ul class="tooltip-kill-list">
            ${result.killSwitches.map((k) => `<li>${k}</li>`).join('')}
          </ul>
        `;
        return tooltip;
      }

      const breakdown = this.buildComponentBreakdown(result, rawData || {});

      const metaLine = `${this.t('base')}: ${result.baseScore} | ${this.t('bonus')}: +${result.totals.bonuses} | ${this.t('penalty')}: ${result.totals.penalties}`;

      tooltip.innerHTML = `
        <div class="tooltip-title">${this.t('scoreDetail')}</div>
        <div class="tooltip-meta">${metaLine}</div>
        <div class="tooltip-grid">
          ${breakdown
          .map(
            (item) => `
                <div class="tooltip-item ${item.tone}">
                  <span class="dot"></span>
                  <span class="label">${item.label}</span>
                  <span class="value">${item.grade}</span>
                </div>
                ${item.reason ? `<div class="tooltip-reason">${item.reason}</div>` : ''}
              `
          )
          .join('')}
        </div>
      `;

      return tooltip;
    }

    buildComponentBreakdown(result, rawData) {
      const componentGrade = (score) => {
        if (score >= 97) return 'A+';
        if (score >= 93) return 'A';
        if (score >= 90) return 'A-';
        if (score >= 87) return 'B+';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        return 'F';
      };

      const safeData = rawData || {};
      const hires = safeData.totalHires ?? 0;
      const jobs = safeData.jobsPosted ?? 0;
      const hireRatePct =
        safeData.hireRatePct !== undefined
          ? safeData.hireRatePct
          : jobs > 0
            ? Math.round((hires / jobs) * 100)
            : 0;

      const avgPrice =
        hires > 0
          ? safeData.totalSpent / hires
          : safeData.totalSpent === 0 && jobs < 3 && safeData.jobBudget
            ? safeData.jobBudget
            : 0;

      const hoursSinceViewed =
        safeData.lastViewed instanceof Date && !Number.isNaN(safeData.lastViewed.getTime())
          ? Math.round((Date.now() - safeData.lastViewed.getTime()) / 3_600_000)
          : null;

      const labels = {
        hireRate: this.t('hireRate'),
        spend: this.t('spend'),
        rating: this.t('rating'),
        activity: this.t('activity'),
        proposals: this.t('proposals'),
        payment: this.t('payment'),
        jobs: this.t('jobsPosted'),
      };

      const getTone = (score) => (score >= 85 ? 'good' : score >= 60 ? 'warn' : 'bad');

      const reasons = {
        hireRate:
          result.componentScores.hireRate === 0
            ? jobs > 0
              ? `Hire rate ${Math.max(hireRatePct, 0)}% con ${hires}/${jobs} hires`
              : this.t('noHiresHistory')
            : '',
        spend:
          result.componentScores.spend === 0
            ? safeData.totalSpent > 0
              ? `$${Math.round(avgPrice)} por contrataciÃ³n (bajo)`
              : this.t('noSpendHistory')
            : '',
        rating:
          result.componentScores.rating === 0
            ? safeData.rating
              ? this.t('ratingBelow')
                .replace('{rating}', safeData.rating)
                .replace('{reviews}', safeData.reviewsCount || 0)
              : this.t('noRatingBelow')
            : '',
        activity:
          result.componentScores.activity === 0
            ? hoursSinceViewed !== null
              ? this.t('seenHoursAgo').replace('{hours}', hoursSinceViewed)
              : this.t('noLastViewed')
            : '',
        proposals:
          result.componentScores.proposals === 0
            ? safeData.proposalCount
              ? this.t('highCompetition').replace('{count}', safeData.proposalCount)
              : this.t('noProposals')
            : '',
        payment:
          result.componentScores.payment === 0 ? this.t('paymentUnverified') : '',
        jobs: '',
      };

      return Object.entries(result.componentScores).map(([key, score]) => ({
        label: labels[key] || key,
        score,
        tone: getTone(score),
        reason: reasons[key],
        grade: componentGrade(score),
      }));
    }

    createBadge(badgeName, rawData = null) {
      const config = this.getBadgeConfig(badgeName, rawData);
      const badgeEl = document.createElement('span');
      badgeEl.className = `sniper-badge ${config.type}`;

      if (config.iconSvg) {
        badgeEl.innerHTML = config.iconSvg;
      } else {
        badgeEl.textContent = config.icon || '';
      }

      // Tooltip HTML con jerarquÃ­a (tÃ­tulo + descripciÃ³n)
      const tooltipEl = document.createElement('div');
      tooltipEl.className = 'sniper-tooltip';
      const titleEl = document.createElement('div');
      titleEl.className = 'sniper-tooltip-title';
      titleEl.textContent = config.tooltipTitle || badgeName;
      const descEl = document.createElement('div');
      descEl.className = 'sniper-tooltip-desc';
      descEl.textContent = config.description;
      tooltipEl.appendChild(titleEl);
      tooltipEl.appendChild(descEl);
      badgeEl.appendChild(tooltipEl);

      return badgeEl;
    }

    getBadgeConfig(badge, rawData = null) {
      const configs = {
        'Gold standard': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gsGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD700"/><stop offset="50%" stop-color="#FFC107"/><stop offset="100%" stop-color="#FF8F00"/></linearGradient><linearGradient id="gsRibbon" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1E88E5"/><stop offset="100%" stop-color="#1565C0"/></linearGradient></defs><path d="M8 3L9 13" stroke="url(#gsRibbon)" stroke-width="2" stroke-linecap="round"/><path d="M16 3L15 13" stroke="url(#gsRibbon)" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="6" fill="url(#gsGoldGrad)" opacity="0.3"/><circle cx="12" cy="16" r="5.5" fill="url(#gsGoldGrad)"/><circle cx="12" cy="16" r="4" fill="#FFF9C4" opacity="0.4"/><path d="M12 13L12.8 15.2L15.2 15.5L13.5 17L14 19.5L12 18.2L10 19.5L10.5 17L8.8 15.5L11.2 15.2L12 13Z" fill="#B7791F"/><path d="M12 10L12.5 11.5L14 12L12.5 12.5L12 14L11.5 12.5L10 12L11.5 11.5L12 10Z" fill="#FFE082"/></svg>`,
          type: 'good',
          description: 'Top Globables, hire rate 70%+, gasto por encima de $10k y rating 4.8+',
        },
        'Whale client': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="whBody" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#4FC3F7"/><stop offset="100%" stop-color="#0288D1"/></linearGradient><linearGradient id="whCoin" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFD54F"/><stop offset="100%" stop-color="#F9A825"/></linearGradient></defs><path d="M3 12.5c0-2.2 1.8-4 4-4h6.5c1.7 0 3.2 1.1 3.7 2.7l.3 1c.2.7.8 1.2 1.6 1.2.5 0 .9-.4.9-.9 0-.5-.3-.8-.8-.8-.4 0-.7.3-.8.7" stroke="#01579B" stroke-width="1.2" stroke-linecap="round"/><path d="M3 12.8c0 2.7 2.2 4.9 4.9 4.9H12c1.8 0 3.5-.7 4.7-2l.8-.9" fill="url(#whBody)"/><path d="M8 14c.6.4 1.2.6 2 .6.8 0 1.4-.2 2-.6" stroke="#E1F5FE" stroke-width="1.1" stroke-linecap="round"/><circle cx="8" cy="12.4" r="0.75" fill="#004D73"/><path d="M14.5 9.5c-.2-.5-.5-1-.5-1.6C14 6.9 15 6 16 6c1.2 0 2 .9 2 2 0 .6-.3 1.1-.5 1.6" stroke="#01579B" stroke-width="1.1" stroke-linecap="round"/><circle cx="17.2" cy="14.2" r="3.2" fill="url(#whCoin)" stroke="#F57F17" stroke-width="1.1"/><path d="M17.2 12.4c-.8 0-1.4.5-1.4 1.2 0 .7.6 1 1.4 1 .8 0 1.4.3 1.4 1 0 .7-.6 1.2-1.4 1.2-.7 0-1.2-.3-1.4-.8" stroke="#6D4C41" stroke-width="1" stroke-linecap="round"/><path d="M17.2 11.8v1" stroke="#6D4C41" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'good',
          description: 'Presupuesto fuerte, gastó más de $10k total o $1k por hire',
        },
        Sociable: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="socHand" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0F2F1"/><stop offset="100%" stop-color="#B2DFDB"/></linearGradient><linearGradient id="socHeart" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFCDD2"/><stop offset="100%" stop-color="#E57373"/></linearGradient></defs><path d="M6 9.5c0-1.1.9-2 2-2h2.5c.7 0 1.3.4 1.6 1l.4.8c.2.4.6.7 1.1.7h1.3c.6 0 1.1.5 1.1 1.1 0 .6-.5 1.1-1.1 1.1H9.8c-.5 0-.9.2-1.3.5l-.6.6c-.6.6-1.7.6-2.3 0-.4-.4-.6-.9-.6-1.4V9.5Z" fill="url(#socHand)" stroke="#4E342E" stroke-width="1.1" stroke-linecap="round"/><path d="M17.6 6.6c-.7 0-1.3.3-1.7.8l-.2.2-.2-.2c-.5-.5-1.1-.8-1.7-.8-.9 0-1.8.5-2.2 1.5-.4 1-.2 2.3.6 3.1l3.5 3.6 3.5-3.6c.8-.8 1-2.1.6-3.1-.4-1-1.3-1.5-2.2-1.5Z" fill="url(#socHeart)" stroke="#C62828" stroke-width="1" stroke-linejoin="round"/></svg>`,
          type: 'good',
          description: 'Habla pero contrata, entrevista 35%+, hire rate 80%+, rating 4.8+',
        },
        'Elite hire rate': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#FFF3E0" stroke="#FB8C00" stroke-width="1.4"/><path d="M12 4.5l2 4.1 4.5.7-3.3 3.2.8 4.5-4-2.1-4 2.1.8-4.5-3.3-3.2 4.5-.7 2-4.1Z" fill="#FFB300" stroke="#F57C00" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
          type: 'good',
          description: 'Hire rate de 90% o más',
        },
        'Fresh off the oven': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="foFlameOuter" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FF6E40" stop-opacity="1"/><stop offset="100%" stop-color="#D84315" stop-opacity="1"/></radialGradient><radialGradient id="foFlameInner" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#FFEB3B" stop-opacity="1"/><stop offset="60%" stop-color="#FF9800" stop-opacity="1"/><stop offset="100%" stop-color="#FF5722" stop-opacity="0.8"/></radialGradient></defs><path d="M12 3C12 3 9 6 8 10C7.5 12 8 14 10 16C10.5 16.5 11.5 17 12 17C12.5 17 13.5 16.5 14 16C16 14 16.5 12 16 10C15 6 12 3 12 3Z" fill="url(#foFlameOuter)"/><path d="M12 7C12 7 10 9 9.5 11C9.2 12 9.5 13.5 11 14.5C11.5 14.8 12 15 12 15C12 15 12.5 14.8 13 14.5C14.5 13.5 14.8 12 14.5 11C14 9 12 7 12 7Z" fill="url(#foFlameInner)"/><ellipse cx="12" cy="11" rx="1.5" ry="2" fill="#FFF9C4" opacity="0.9"/></svg>`,
          type: 'good',
          description: 'Publicado hace menos de 1h, oportunidad fresca',
        },
        'Tier 1 country': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="t1Ocean2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4FC3F7"/><stop offset="100%" stop-color="#0288D1"/></linearGradient><linearGradient id="t1Land2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#A5D6A7"/><stop offset="100%" stop-color="#2E7D32"/></linearGradient><linearGradient id="t1Flag" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFCA28"/><stop offset="100%" stop-color="#F57C00"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#t1Ocean2)" stroke="#01579B" stroke-width="1.1"/><path d="M6.2 9.3c1.4-.9 3.3-1.4 4.9-.9 1 .3 1.8.9 2.5 1.7l-1.4 1.1-1.7-.4-.8 1.3-1.6.2-.7-1.3-1.2-.7Z" fill="url(#t1Land2)"/><path d="M7.1 12.4c-.6.3-1 .9-1 1.6 0 .6.3 1.2.8 1.6 1.1.8 2.4 1.3 3.7 1.4l.4-1.4-1-1.2.6-1.1-1.2-1.1-2.3-.8Z" fill="url(#t1Land2)"/><path d="M13.2 14.4c.5.5 1.3.9 2.1.9.8 0 1.6-.3 2.2-.8" stroke="#E1F5FE" stroke-width="1" stroke-linecap="round"/><path d="M15.8 7.3c-.5 0-.9.4-.9.9 0 1 .9 2.1 2 3.8 1.1-1.7 2-2.8 2-3.8 0-.5-.4-.9-.9-.9s-.9.4-.9.9c0-.5-.4-.9-.9-.9Z" fill="url(#t1Flag)" stroke="#F57C00" stroke-width="0.8" stroke-linecap="round"/><circle cx="16.9" cy="8.1" r="0.55" fill="#6D4C41"/></svg>`,
          type: 'good',
          description: 'País con demanda y buen pago',
          tooltip: 'País con demanda y capital',
        },
        'Window shopper': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wsScope" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ECEFF1"/><stop offset="100%" stop-color="#CFD8DC"/></linearGradient></defs><rect x="4" y="8" width="7" height="10" rx="3.5" fill="url(#wsScope)" stroke="#37474F" stroke-width="1.5"/><rect x="13" y="8" width="7" height="10" rx="3.5" fill="url(#wsScope)" stroke="#37474F" stroke-width="1.5"/><rect x="10" y="11" width="4" height="3" fill="#546E7A" rx="0.5"/><circle cx="7.5" cy="13" r="2.5" fill="#90CAF9" opacity="0.3"/><circle cx="7.5" cy="13" r="1.8" fill="#42A5F5"/><circle cx="16.5" cy="13" r="2.5" fill="#90CAF9" opacity="0.3"/><circle cx="16.5" cy="13" r="1.8" fill="#42A5F5"/><circle cx="7.8" cy="12.5" r="0.6" fill="#E3F2FD"/><circle cx="16.8" cy="12.5" r="0.6" fill="#E3F2FD"/></svg>`,
          type: 'bad',
          description: 'Hire rate menor a 65% con varios posts; mira más de lo que contrata',
        },
        Cheapskate: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="csBody" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFF3E0"/><stop offset="100%" stop-color="#FFE0B2"/></linearGradient></defs><path d="M4 10.5c0-1.1.9-2 2-2h9c1.4 0 2.5 1.1 2.5 2.5v4c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-4.5Z" fill="url(#csBody)" stroke="#F57F17" stroke-width="1.2" stroke-linejoin="round"/><path d="M7.2 9c0-.6.5-1 1-1h6.5c.6 0 1 .4 1 1v.5h-8.5V9Z" fill="#FFCC80" stroke="#F57F17" stroke-width="1.1"/><path d="M5.5 12.5h2.2c.5 0 .9.4.9.9v.2c0 .5-.4.9-.9.9H5.5" stroke="#F57F17" stroke-width="1.1" stroke-linecap="round"/><circle cx="15.8" cy="12.5" r="1.1" fill="#FFF" stroke="#F57F17" stroke-width="1.1"/><path d="M9 15.5c-.3.6-.8 1-1.5 1-.7 0-1.2-.4-1.5-1" stroke="#F57F17" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'Pago menor al promedio menor $100 fixed o $6/hora',
        },
        'Ghost job': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 18c0 1.1-.9 2-2 2v-9c0-4 3-7 7-7s7 3 7 7v9c-1.1 0-2-.9-2-2 0 1.1-.9 2-2 2-.9 0-1.6-.6-1.9-1.4-.3.8-1 1.4-1.9 1.4-1.1 0-2-.9-2-2Z" fill="#ECEFF1" stroke="#607D8B" stroke-width="1.2" stroke-linejoin="round"/><circle cx="10" cy="11" r="1" fill="#263238"/><circle cx="14" cy="11" r="1" fill="#263238"/><path d="M10 14c.5.4 1.1.6 2 .6.9 0 1.5-.2 2-.6" stroke="#455A64" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'No visto en más de 48h; probablemente abandonado',
        },
        'Dead post': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="12" height="15" rx="3" fill="#CFD8DC" stroke="#455A64" stroke-width="1.2"/><rect x="9.5" y="3" width="5" height="3.5" rx="1" fill="#B0BEC5" stroke="#455A64" stroke-width="1.1"/><circle cx="10" cy="11" r="0.9" fill="#263238"/><circle cx="14" cy="11" r="0.9" fill="#263238"/><path d="M10 14.5c.6.4 1.3.6 2 .6.7 0 1.4-.2 2-.6" stroke="#37474F" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '50+ propuestas, 0 entrevistas y +2 días; post muerto',
        },
        'Shortlisting': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="slClip" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF8E1"/><stop offset="100%" stop-color="#FFECB3"/></linearGradient></defs><rect x="5" y="3" width="14" height="18" rx="2" fill="url(#slClip)" stroke="#FFA000" stroke-width="1.2"/><path d="M8 7h8M8 10h8M8 13h5" stroke="#FF8F00" stroke-width="1.2" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="#FFC107" stroke="#FF8F00" stroke-width="1.1"/><path d="M14.5 16l1 1 2-2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          type: 'neutral',
          description: 'Cliente en proceso de shortlisting; hay entrevistas activas pero el post está pausado',
        },
        'Stagnant job': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="stWater" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#E0E0E0"/><stop offset="100%" stop-color="#9E9E9E"/></linearGradient></defs><ellipse cx="12" cy="15" rx="8" ry="4" fill="url(#stWater)" stroke="#616161" stroke-width="1.1"/><path d="M4 15v-4c0-4.4 3.6-8 8-8s8 3.6 8 8v4" stroke="#757575" stroke-width="1.2"/><path d="M8 12h8" stroke="#9E9E9E" stroke-width="1" stroke-dasharray="2 2"/><path d="M9 10h6" stroke="#BDBDBD" stroke-width="0.8" stroke-dasharray="1.5 1.5"/><circle cx="12" cy="7" r="1.5" fill="#BDBDBD"/></svg>`,
          type: 'bad',
          description: 'Sin cambios en las métricas durante 7+ días; el cliente parece haber abandonado',
        },
        'New client': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="16" height="14" rx="3" fill="#E3F2FD" stroke="#1E88E5" stroke-width="1.2"/><text x="12" y="15" text-anchor="middle" fill="#1E88E5" font-size="8" font-family="Inter, Arial" font-weight="700">NEW</text></svg>`,
          type: 'neutral',
          description: 'Cliente nuevo sin historial todavía',
        },
        'Team builder': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="tb2Skin" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE0B2"/><stop offset="100%" stop-color="#FFB74D"/></linearGradient><linearGradient id="tb2Shirt" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#BBDEFB"/><stop offset="100%" stop-color="#64B5F6"/></linearGradient></defs><circle cx="12" cy="7" r="3" fill="url(#tb2Skin)" stroke="#F57C00" stroke-width="1.1"/><path d="M9 13c0-1.7 1.3-3 3-3s3 1.3 3 3v4.5c0 .8-.7 1.5-1.5 1.5h-3c-.8 0-1.5-.7-1.5-1.5V13Z" fill="url(#tb2Shirt)" stroke="#1E88E5" stroke-width="1.1"/><path d="M14.5 12.5c.8-.6 1.8-.5 2.6.1l.6.5c.7.6.8 1.6.2 2.3-.6.7-1.6.8-2.3.2l-.3-.2" fill="url(#tb2Skin)" stroke="#F57C00" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 12.5c-.8-.6-1.8-.5-2.6.1l-.6.5c-.7.6-.8 1.6-.2 2.3.6.7 1.6.8 2.3.2l.3-.2" fill="url(#tb2Skin)" stroke="#F57C00" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.6 9.2c0 .9-.7 1.6-1.6 1.6-.9 0-1.6-.7-1.6-1.6" stroke="#F57C00" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'good',
          description: 'Recontrata, más de 1.5 hires por cada job',
        },
        'Boost it!': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="biBtn2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#48E1FF"/><stop offset="100%" stop-color="#1BA1F2"/></linearGradient><linearGradient id="biFlash2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFDE7"/><stop offset="100%" stop-color="#FFE082"/></linearGradient></defs><rect x="3" y="7" width="18" height="10" rx="5" fill="url(#biBtn2)" stroke="#0D8BD6" stroke-width="1.2"/><path d="M11.6 7.8 9.4 12.6h2l-.7 3.5 3.5-4.4H12.3l1.1-3.9Z" fill="url(#biFlash2)" stroke="#F9A825" stroke-width="0.9" stroke-linejoin="round"/><path d="M7 12h2.2" stroke="#E1F5FE" stroke-width="1.2" stroke-linecap="round"/><path d="M15 12h2.2" stroke="#E1F5FE" stroke-width="1.2" stroke-linecap="round"/><path d="M7 12c-.1-.6.3-1.2.8-1.7" stroke="#B3E5FC" stroke-width="0.9" stroke-linecap="round"/><path d="M17.2 12c.1-.6-.3-1.2-.8-1.7" stroke="#B3E5FC" stroke-width="0.9" stroke-linecap="round"/></svg>`,
          type: 'good',
          description: 'Cliente valioso con alta competencia pero puedes destacar',
        },
        'Toxic client': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3 21 19H3L12 3Z" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.2"/><path d="M12 10.5v3.5" stroke="#D32F2F" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="16.5" r="0.9" fill="#D32F2F"/></svg>`,
          type: 'bad',
          tooltipTitle:
            this.language === 'es'
              ? 'Riesgo por rating/reviews'
              : 'Low Rating or Low-Review Risk',
          description: this.language === 'es'
            ? 'Aplica si rating < 4.0 o si tiene muy pocos reviews (1-2).'
            : 'Applies when rating is below 4.0 or review count is very low (1-2).',
        },
        'Crowded room': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="crHead1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFECB3"/><stop offset="100%" stop-color="#FBC02D"/></linearGradient><linearGradient id="crHead2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE0B2"/><stop offset="100%" stop-color="#FFB74D"/></linearGradient><linearGradient id="crHead3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE082"/><stop offset="100%" stop-color="#FFCA28"/></linearGradient></defs><circle cx="8" cy="11.5" r="3" fill="url(#crHead1)" stroke="#F9A825" stroke-width="1.1"/><circle cx="13.5" cy="10" r="3" fill="url(#crHead2)" stroke="#FB8C00" stroke-width="1.1"/><circle cx="16.5" cy="14" r="3" fill="url(#crHead3)" stroke="#F57C00" stroke-width="1.1"/><path d="M6.5 15.5c-.2.8-.7 1.3-1.5 1.3-.5 0-1-.2-1.3-.6" stroke="#F57F17" stroke-width="1" stroke-linecap="round"/><path d="M12 13c-.2.8-.7 1.3-1.5 1.3-.6 0-1.1-.3-1.4-.7" stroke="#F57F17" stroke-width="1" stroke-linecap="round"/><path d="M15.5 17c-.2.8-.7 1.3-1.5 1.3-.6 0-1.1-.3-1.4-.7" stroke="#F57F17" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'Más de 7 entrevistando; competencia alta',
        },
        Spammer: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="6" width="17" height="12" rx="2" fill="#E3F2FD" stroke="#1E88E5" stroke-width="1.2"/><path d="M4.5 7.5 12 12l7.5-4.5" stroke="#1E88E5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          type: 'bad',
          description: 'Invitaciones mayores a 15',
        },
        SOS: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#FFFFFF">SOS</text></svg>`,
          type: 'neutral',
          description: 'Cliente está desesperado por contratar',
        },
        'Time Waster': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="twGlass" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF3E0"/><stop offset="100%" stop-color="#FFE0B2"/></linearGradient></defs><path d="M8 4.5h8" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M8 19.5h8" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M9 4.5c0 1.8 1 3.1 2.2 4l1.6 1.2c.5.4.5 1.2 0 1.6L11.2 12c-1.3.9-2.2 2.3-2.2 4v1.5" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M15 4.5c0 1.8-1 3.1-2.2 4L11.2 9.7c-.5.4-.5 1.2 0 1.6l1.6 1.2c1.3.9 2.2 2.3 2.2 4v1.5" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M10 9.5h4" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><path d="M10 14.5h4" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><rect x="5" y="9" width="3" height="6" rx="1.2" fill="#FFE082" stroke="#FB8C00" stroke-width="1.1"/><path d="M6.5 10.2v3.6" stroke="#F57C00" stroke-width="0.9" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'Entrevista 40%+ pero hire rate 35-50%; habla mucho, contrata poco',
        },
        Complot: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cpRed" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFCDD2"/><stop offset="100%" stop-color="#E53935"/></linearGradient><linearGradient id="cpBlue" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BBDEFB"/><stop offset="100%" stop-color="#1E88E5"/></linearGradient></defs><path d="M4.2 9.5c0-1 .8-1.8 1.8-1.8h5c1 0 1.8.8 1.8 1.8v5.8c0 1.5-1.8 2.3-3 1.3l-.9-.7c-.45-.4-1.15-.4-1.6 0l-.9.7c-1.2 1-3 .2-3-1.3V9.5Z" fill="url(#cpRed)" stroke="#B71C1C" stroke-width="1.1" stroke-linejoin="round"/><path d="M11.3 6c0-1 .8-1.8 1.8-1.8h5c1 0 1.8.8 1.8 1.8v5.9c0 1.5-1.8 2.3-3 1.3l-.9-.7c-.45-.4-1.15-.4-1.6 0l-.9.7c-1.2 1-3 .2-3-1.3V6Z" fill="url(#cpBlue)" stroke="#0D47A1" stroke-width="1.1" stroke-linejoin="round"/><path d="M7 11.5c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M9.7 11.5c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M6.6 12.7c-.35.4-.45.9-.2 1.3.2.35.55.55.96.55.16 0 .32-.02.47-.07" stroke="#1976D2" stroke-width=".9" stroke-linecap="round"/><path d="M7.4 14.2c.48-.4 1.06-.6 1.95-.6.9 0 1.47.2 1.95.6" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M14 9.3c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/><path d="M16.7 9.3c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/><path d="M14.4 11.6c.55.5 1.25.72 2.1.72.85 0 1.55-.22 2.1-.72" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/><path d="M12.2 7.2c.34.2.66.5.93.9" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M17.4 5.9c.32.1.63.32.94.62" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '20+ propuestas, 1 entrevista y 0 invites: probable favorito oculto',
        },
        Ojo: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#E0E0E0" stop-opacity="0.6"/></radialGradient></defs><ellipse cx="32" cy="32" rx="22" ry="14" fill="url(#eyeGlow)" stroke="#212121" stroke-width="2"/><circle cx="32" cy="32" r="9" fill="#FFFFFF" stroke="#111111" stroke-width="2"/><circle cx="32" cy="32" r="5" fill="#111111"/><circle cx="30" cy="30" r="1.5" fill="#FFFFFF" opacity="0.9"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Señal de feedback débil' : 'Weak Feedback Signal',
          description: this.language === 'es'
            ? 'Señales débiles o inestables en feedback reciente (sin duplicar Toxic por pocos reviews).'
            : 'Weak or unstable recent-feedback signal (without duplicating Toxic for low review count).',
        },
        'Data Harvesting': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dhShield" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFEBEE"/><stop offset="100%" stop-color="#FFCDD2"/></linearGradient></defs><path d="M12 3 6 5.5v5.4c0 3.4 2.5 6.5 6 7.6 3.5-1.1 6-4.2 6-7.6V5.5L12 3Z" fill="url(#dhShield)" stroke="#C62828" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 9.5c0-.8.6-1.5 1.4-1.5h3.2c.8 0 1.4.7 1.4 1.5 0 .6-.3 1.1-.8 1.3l-2.2 1c-.3.1-.5.4-.5.7v.5" stroke="#C62828" stroke-width="1.1" stroke-linecap="round"/><circle cx="12" cy="15.2" r="0.95" fill="#C62828"/><path d="M8.3 7.5c.3-.9 1-1.5 1.9-1.5h3.6c.9 0 1.6.6 1.9 1.5" stroke="#E57373" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '0-1 hires, hire rate <25%, entrevista 35%+ y cuenta <6 meses; posible recolección de datos/estafa',
        },
        'Perpetual Posting': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="3.5" width="12" height="17" rx="3" fill="#FFF3E0" stroke="#FB8C00" stroke-width="1.2"/><path d="M9 7h6" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><path d="M9 9h6" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><path d="M9 13.5 15 17" stroke="#EF6C00" stroke-width="1.3" stroke-linecap="round"/><path d="M15 13.5 9 17" stroke="#EF6C00" stroke-width="1.3" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'Publicado hace más de 7 días; baja urgencia',
        },
        'Serial Poster': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4" width="10" height="16" rx="2" fill="#ECEFF1" stroke="#37474F" stroke-width="1.2"/><rect x="9" y="6.5" width="8" height="13" rx="2" fill="#CFD8DC" stroke="#455A64" stroke-width="1.1"/><path d="M8.5 10h6.5M8.5 13h6.5M8.5 16h6.5" stroke="#546E7A" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '5+ jobs y hire rate <30%; publica mucho, contrata poco',
        },
        'Off-platform request': {
          icon: '\u26D4',
          type: 'bad',
          description: 'Pide mover la conversación fuera de Upwork',
        },
        'External payment risk': {
          icon: '\u26A0\uFE0F',
          type: 'bad',
          description: 'Solicita pagos externos, crypto, gift cards o compra de equipos',
        },
        'Free work request': {
          icon: '\uD83E\uDDEA',
          type: 'bad',
          description: 'Solicita prueba gratuita o trabajo sin pagar',
        },
        'Too good to be true': {
          icon: '\uD83C\uDFA3',
          type: 'bad',
          description: 'Pago inusualmente alto para tarea simple con poco historial',
        },
        'Possible client names': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.8" y="4.2" width="16.4" height="15.6" rx="3" fill="#E8EAF6" stroke="#3949AB" stroke-width="1.2"/><path d="M7.2 9.2h9.6M7.2 12.1h5.1" stroke="#3949AB" stroke-width="1.1" stroke-linecap="round"/><circle cx="14.9" cy="14.8" r="3.3" fill="#C5CAE9" stroke="#3949AB" stroke-width="1.1"/><path d="M16.8 16.7 18.5 18.4" stroke="#303F9F" stroke-width="1.1" stroke-linecap="round"/><path d="M14.9 13.7v2.2M13.8 14.8h2.2" stroke="#303F9F" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'neutral',
          tooltipTitle: this.language === 'es' ? 'Posible nombre del cliente' : 'Possible Client Name',
          description: this.t('possibleNamesNoMatch'),
        },
        'Support Avg/hr': {
          icon: '\uD83D\uDCB5',
          type: 'neutral',
          tooltipTitle: this.t('supportAvgBadge'),
          description: this.t('supportAvgUnavailable'),
        },
        'Skills match': {
          icon: '\uD83E\uDDE9',
          type: 'neutral',
          tooltipTitle: this.t('skillsMatchBadge'),
          description: this.t('skillsNeedProfile'),
        },

        'Scope Monster': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="3" fill="#FFEBEE" stroke="#C62828" stroke-width="1.2"/><path d="M8 8h8M8 11h8M8 14h8" stroke="#D32F2F" stroke-width="1.1" stroke-linecap="round"/><path d="M9 17c1.2-.7 2-.9 3-.9s1.8.2 3 .9" stroke="#B71C1C" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Alcance Difuso' : 'Scope Too Broad',
          description: 'Pide demasiados roles en un solo job; aumenta riesgo de scope creep y retrabajo.',
        },
        'Free Consultant': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4.5" width="16" height="15" rx="3" fill="#FFF8E1" stroke="#F57F17" stroke-width="1.2"/><path d="M8 9h8M8 12h6" stroke="#F9A825" stroke-width="1.1" stroke-linecap="round"/><path d="M12 16.5 10.5 15l-1.7 1.1.6-2-1.6-1.2 2-.1.7-1.9.7 1.9 2 .1-1.6 1.2.6 2L12 16.5Z" fill="#FFB300" stroke="#F57F17" stroke-width="0.9" stroke-linejoin="round"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Consultoría Gratis' : 'Free Consulting Ask',
          description: 'Pide estrategia o diagnóstico completo antes de contratar; riesgo de trabajo no pagado.',
        },
        'Silent History': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="16" height="14" rx="3" fill="#ECEFF1" stroke="#455A64" stroke-width="1.2"/><path d="M8 10h8M8 13h5" stroke="#607D8B" stroke-width="1.1" stroke-linecap="round"/><path d="M15.8 8.8c1.4 0 2.5 1.2 2.5 2.6s-1.1 2.6-2.5 2.6c-1.3 0-2.4-1-2.5-2.3" stroke="#37474F" stroke-width="1.1" stroke-linecap="round"/><path d="M14.2 10.4 17.3 13.3" stroke="#37474F" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Historial Opaco' : 'Low-Trace History',
          description: 'Tiene actividad histórica, pero casi sin feedback visible; reduce confianza en el historial.',
        },
        'Budget Mismatch': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="7" width="16" height="10" rx="3" fill="#FFEBEE" stroke="#C62828" stroke-width="1.2"/><path d="M7 12h10" stroke="#C62828" stroke-width="1.2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="#FFCDD2" stroke="#B71C1C" stroke-width="1"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Presupuesto Desalineado' : 'Budget Mismatch',
          description: 'Pide nivel experto con presupuesto bajo; menor probabilidad de cierre justo.',
        },
        'Clear Brief': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4.5" y="3.8" width="15" height="16.4" rx="2.5" fill="#E8F5E9" stroke="#2E7D32" stroke-width="1.2"/><path d="M8 8h8M8 11h6M8 14h5" stroke="#2E7D32" stroke-width="1.1" stroke-linecap="round"/><circle cx="16.5" cy="16" r="3.2" fill="#A5D6A7" stroke="#2E7D32" stroke-width="1.1"/><path d="M15.2 16.1 16.3 17.2 18 15.4" stroke="#1B5E20" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          type: 'good',
          tooltipTitle: this.language === 'es' ? 'Brief Claro' : 'Clear Brief',
          description: 'Define entregables y fecha objetivo; facilita ejecución y reduce ambigüedad.',
        },
        'Milestone Friendly': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 17.5h16" stroke="#1E88E5" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="17.5" r="2" fill="#BBDEFB" stroke="#1E88E5" stroke-width="1.1"/><circle cx="12" cy="12.5" r="2" fill="#90CAF9" stroke="#1E88E5" stroke-width="1.1"/><circle cx="18" cy="8.5" r="2" fill="#64B5F6" stroke="#1E88E5" stroke-width="1.1"/><path d="M7.5 16.2 10.5 13.8M13.5 11.2 16.5 9.8" stroke="#1565C0" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'good',
          tooltipTitle: this.language === 'es' ? 'Trabajo por Hitos' : 'Milestone Friendly',
          description: 'Acepta fases o pagos por etapa; mejora control de alcance y cobro.',
        },
        'Professional Tone': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4.5" width="14" height="15" rx="3" fill="#E3F2FD" stroke="#1565C0" stroke-width="1.2"/><path d="M9 9.2h6M9 12h6M9 14.8h4" stroke="#1565C0" stroke-width="1.1" stroke-linecap="round"/><path d="M15.4 6.8 17.2 8.6" stroke="#0D47A1" stroke-width="1.1" stroke-linecap="round"/><path d="M17.2 6.8 15.4 8.6" stroke="#0D47A1" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'good',
          tooltipTitle: this.language === 'es' ? 'Comunicación Profesional' : 'Professional Tone',
          description: 'Describe necesidad de forma específica y profesional; suele mejorar colaboración.',
        },      };
      if (badge === 'Possible client names') {
        const names = Array.isArray(rawData?.possibleClientNames)
          ? rawData.possibleClientNames
            .filter((name) => typeof name === 'string' && name.trim().length > 0)
            .slice(0, 5)
          : [];
        if (names.length > 0) {
          configs['Possible client names'].description = this.t('possibleNamesDetected').replace('{names}', names.join(', '));
        }
      }
      if (badge === 'Support Avg/hr') {
        const supportBadge = rawData?.supportAvgBadge || null;
        if (supportBadge?.status === 'above') {
          configs['Support Avg/hr'].description = `${this.t('supportAvgAbove')} (${Math.round(supportBadge.jobRate || 0)}/hr vs ${Math.round(supportBadge.benchmark || 0)}/hr)`;
        } else if (supportBadge?.status === 'on') {
          configs['Support Avg/hr'].description = `${this.t('supportAvgOn')} (${Math.round(supportBadge.jobRate || 0)}/hr vs ${Math.round(supportBadge.benchmark || 0)}/hr)`;
        } else if (supportBadge?.status === 'below') {
          configs['Support Avg/hr'].description = `${this.t('supportAvgBelow')} (${Math.round(supportBadge.jobRate || 0)}/hr vs ${Math.round(supportBadge.benchmark || 0)}/hr)`;
        } else {
          configs['Support Avg/hr'].description = this.t('supportAvgUnavailable');
        }
      }
      if (badge === 'Skills match') {
        const match = rawData?.skillsMatch || null;
        if (!match || !match.profileSkillsLoaded) {
          configs['Skills match'].description = this.t('skillsNeedProfile');
        } else {
          const matched = Array.isArray(match.matchedSkills) ? match.matchedSkills.length : 0;
          const missing = Array.isArray(match.missingSkills) ? match.missingSkills.length : 0;
          configs['Skills match'].description = this.language === 'es'
            ? `Match: ${matched} | Faltan: ${missing}`
            : `Matched: ${matched} | Missing: ${missing}`;
        }
      }
      const selected = configs[badge] || { icon: '\u25B9', type: 'neutral', description: badge };
      if (this.language === 'en') {
        const enDescriptions = {
          'Gold standard': 'Top signal: strong hire rate, >$10k spent and 4.8+ rating',
          'Whale client': 'Strong budget: >$10k total or >$1k per hire',
          Sociable: 'Interviews a lot and hires reliably',
          'Elite hire rate': 'Hire rate is 90% or higher',
          'Fresh off the oven': 'Posted less than 1 hour ago',
          'Tier 1 country': 'Client is from a Tier 1 market',
          'Window shopper': 'Low hire rate with multiple posts',
          Cheapskate: 'Low average pay history',
          'Ghost job': 'Not viewed in 48h and no active interviews',
          'Dead post': 'Old post, high proposals, no interviews',
          Shortlisting: 'Client paused but still interviewing',
          'Stagnant job': 'No metric changes for 7+ days',
          'New client': 'New client with little history',
          'Team builder': 'Often hires multiple freelancers per post',
          'Boost it!': 'Good job but crowded. Boost can help.',
          'Toxic client': 'Low rating or very low review count risk (rating <4.0 or 1-2 reviews)',
          'Crowded room': 'More than 7 interviewing',
          Spammer: 'More than 15 invites sent',
          SOS: 'Urgent hiring signals detected',
          'Time Waster': 'High interview ratio but low conversion',
          Complot: 'High proposals and odd interview/invite pattern',
          Ojo: 'Weak review-history signal (non-toxic path)',
          'Data Harvesting': 'Possible data-harvest or scam pattern',
          'Perpetual Posting': 'Open for over 7 days with low urgency',
          'Serial Poster': 'Many posts, low hire rate',
          'Off-platform request': 'Requests communication outside Upwork',
          'External payment risk': 'Requests external payments or risky methods',
          'Free work request': 'Requests unpaid sample or free work',
          'Too good to be true': 'Very high pay for simple task and weak history',
          'Scope Monster': 'Requests too many disciplines in one job; higher scope-creep risk.',
          'Free Consultant': 'Asks for detailed strategy before hiring; unpaid work risk.',
          'Silent History': 'Shows activity but little visible feedback to validate quality.',
          'Budget Mismatch': 'Expert-level ask with weak budget signals; lower fit quality.',
          'Clear Brief': 'Defines deliverables and timeline; reduces ambiguity.',
          'Milestone Friendly': 'Accepts phased delivery or staged payments; lower execution risk.',
          'Professional Tone': 'Specific and professional request, usually easier to execute well.',
          'Support Avg/hr': 'Support niche hourly position vs feed benchmark (informational).',
          'Skills match': 'Compares required job skills vs your freelancer profile skills.',
        };
        if (enDescriptions[badge]) {
          selected.description = enDescriptions[badge];
        }
      }
      return selected;
    }
  }

  new UpworkSniperExtension();
})();


