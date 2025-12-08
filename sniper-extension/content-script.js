(() => {
  'use strict';

  // ============================================
  // ANDERSON'S SNIPER EXTENSION - SPA Ready
  // Detecta navegación en Upwork sin recargar página
  // ============================================

  const PREFIX = '[🎯 Sniper]';
  const DEBUG = false;

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
    console.log(`%c${PREFIX} ✅`, 'color: #66BB6A; font-weight: bold', message);
  };

  const logError = (phase, message, error = null) => {
    console.error(`%c${PREFIX} ❌ ${phase}:`, 'color: #F44336; font-weight: bold', message, error || '');
  };

  class UpworkSniperExtension {
    constructor() {
      this.currentJobId = null;
      this.lastUrl = window.location.href;
      this.cacheKey = 'sniper-cache-v1';
      this.cacheMaxEntries = 200;
      this.cacheMaxAgeMs = 12 * 60 * 60 * 1000; // 12 horas
      log('INIT', "Anderson's Sniper Extension activated");
      log('INIT', 'content-script injected (load check)');
      this.init();
    }

    init() {
      this.watchUrlChanges();
      this.checkCurrentPage();
      // Pintar overlays desde caché en el feed aunque no abramos el modal
      setInterval(() => this.applyCachedOverlaysToFeed(), 1500);
    }

    watchUrlChanges() {
      log('INIT', 'Observando cambios de URL para SPA navigation');

      // popstate para navegación del historial
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
        log('ROUTE', 'No estamos en un job detail');
      }
    }

    waitForJobContent(jobId) {
      log('DETAIL', `Esperando a que cargue el contenido del job ${jobId}...`);

      let attempts = 0;
      const maxAttempts = 30; // 15s (más tiempo para React hydration)

      const checkInterval = setInterval(() => {
        attempts++;

        // 🔍 Buscar SIEMPRE dentro del modal/panel de detalle del job
        const jobModal = document.querySelector(
          '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
        );

        if (!jobModal) {
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            logError('DETAIL', `Timeout esperando modal del job ${jobId} (${attempts * 500}ms)`);
          } else {
            log('DETAIL', `Intento ${attempts}/${maxAttempts}: Modal del job aún no existe`);
          }
          return;
        }

        const clientInfo = jobModal.querySelector(
          '[data-test="client-info"], .client-info, aside.sidebar, .cfe-ui-job-about-client'
        );
        const jobDescription = jobModal.querySelector(
          '[data-test="Description"], .job-description, .description'
        );

        // 🔥 VALIDACIÓN: contenido real del sidebar del cliente
        const sidebarText = clientInfo?.innerText || clientInfo?.textContent || '';
        const hasRealContent =
          sidebarText.includes('Member since') ||
          sidebarText.includes('Payment verified') ||
          sidebarText.includes('Payment method verified') ||
          sidebarText.includes('jobs posted') ||
          sidebarText.includes('total spent') ||
          sidebarText.includes('hire rate');

        const modalText = jobModal.textContent || '';
        const hasClientSection = modalText.includes('About the client') || modalText.includes('Member since');

        log(
          'DETAIL',
          `Intento ${attempts}/${maxAttempts}: modal=${!!jobModal}, clientInfo=${!!clientInfo}, desc=${!!jobDescription}, realContent=${hasRealContent}, hasClientSection=${hasClientSection}`
        );

        if (clientInfo && jobDescription && (hasRealContent || hasClientSection)) {
          clearInterval(checkInterval);
          logSuccess('Sidebar del cliente listo; procediendo a evaluar');
          log('DETAIL', `✓ Contenido cargado después de ${attempts * 500}ms`);
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
        log('DETAIL', `Datos extraídos (job ${jobId})`, extractedData);
        this.evaluateAndRender(jobId, extractedData);
      } catch (error) {
        logError('DETAIL', `Error procesando job ${jobId}`, error);
      }
    }

  getJobScope() {
    // Prioriza el modal/panel de detalle del job para evitar ruido del resto de la página (perfil, feed, etc.)
    const modal = document.querySelector(
      '[role="dialog"].air3-slider-job-details, .job-details-content, .air3-slider-job-details'
    );
    if (modal) return modal;

    // Fallback: contenedor principal o el body completo
    const detail = document.querySelector('.job-details, main');
    return detail || document.body;
  }

    // =========================
    // FASE 1: EXTRACCIÓN
    // =========================
    extractJobData() {
      const scope = this.getJobScope(); // Modal/panel del job

      // 🔍 Buscar el sidebar del cliente DENTRO del modal
      const sidebar = scope.querySelector(
        'aside.sidebar, .cfe-ui-job-about-client, [data-test="client-info"], .client-info'
      );

      // Si no hay sidebar explícito, intenta con la sección "About the client"
      const aboutClientSection = Array.from(scope.querySelectorAll('h4, h3, h2')).find(
        (h) => h.textContent?.trim() === 'About the client'
      )?.nextElementSibling;

      const effectiveSidebar = sidebar || aboutClientSection || scope;

      // 🔥 Fallback: innerText respeta CSS visibility, textContent no
      // Si Upwork oculta/muestra elementos con CSS, textContent puede capturar más
      const sidebarText = effectiveSidebar?.innerText || effectiveSidebar?.textContent || '';

      // 🔥 LOG CRÍTICO para debugging
      log('DETAIL', `─────── EXTRACCIÓN DE DATOS ───────`);
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
      const scopeText = scope.innerText || scope.textContent || document.body.innerText || '';

      log('DETAIL', `Description length: ${descText.length} chars`);
      log('DETAIL', `Total scope text length: ${scopeText.length} chars`);
      log('DETAIL', `────────────────────────────────────`);

      const extractedData = {
        memberSince: this.extractMemberSince(sidebarText || scopeText),
        jobsPosted: this.extractJobsPosted(sidebarText || scopeText),
        paymentVerified:
          sidebarText.includes('Payment verified') ||
          sidebarText.includes('Payment method verified') ||
          scopeText.includes('Payment verified'),
        totalSpent: this.extractSpent(sidebarText || scopeText),
        totalHires: this.extractHires(sidebarText || scopeText),
        hireRatePct: this.extractHireRate(sidebarText || scopeText),
        rating: this.extractRating(sidebarText || scopeText),
        reviewsCount: this.extractReviews(sidebarText || scopeText),
        proposalCount: this.extractProposals(activityText || scopeText),
        lastViewed: this.extractLastViewed(activityText || scopeText),
        invitesSent: this.extractInvites(activityText || scopeText),
        unansweredInvites: this.extractUnansweredInvites(activityText || scopeText),
        interviewing: this.extractInterviewing(activityText || scopeText),
        descriptionLength: descText.trim().length,
        clientCountry: this.extractCountry(sidebarText || scopeText),
        postedAt: this.extractPostedTime(scopeText),
        avgHourlyPaid: this.extractAvgHourly(sidebarText || scopeText),
      };

      // 🔥 LOG de valores extraídos para debugging
      log('DETAIL', `🎯 Valores extraídos:`);
      log('DETAIL', `  - jobsPosted: ${extractedData.jobsPosted}`);
      log('DETAIL', `  - totalHires: ${extractedData.totalHires}`);
      log('DETAIL', `  - totalSpent: $${extractedData.totalSpent}`);
      log('DETAIL', `  - hireRatePct: ${extractedData.hireRatePct}%`);
      log('DETAIL', `  - paymentVerified: ${extractedData.paymentVerified}`);
      log('DETAIL', `  - rating: ${extractedData.rating}`);
      log('DETAIL', `  - memberSince: ${extractedData.memberSince?.toDateString?.() || 'N/A'}`);

      return extractedData;
    }

    extractSpent(text) {
      const match = text.match(/\$([\d.,]+)([KkMm]?)\s+total spent/i);
      if (!match) return 0;
      let value = parseFloat(match[1].replace(/,/g, ''));
      const multiplier = match[2]?.toLowerCase();
      if (multiplier === 'k') value *= 1000;
      if (multiplier === 'm') value *= 1_000_000;
      return value;
    }

    extractHires(text) {
      const match = text.match(/(\d+)\s*hires?/i);
      return match ? parseInt(match[1], 10) : 0;
    }

    extractJobsPosted(text) {
      const match = text.match(/(\d+)\s*jobs? posted/i);
      return match ? parseInt(match[1], 10) : 0;
    }

    extractHireRate(text) {
      const match = text.match(/(\d+)%\s*hire rate/i);
      return match ? parseInt(match[1], 10) : 0;
    }

    extractRating(text) {
      // Acepta "4.89 of 21 reviews" o "4.9 of 5"
      const match = text.match(/(\d\.\d+)\s+of\s+(\d+)\s+reviews/i) || text.match(/(\d\.\d+)\s*of\s*5/i);
      return match ? parseFloat(match[1]) : 0;
    }

    extractReviews(text) {
      const match = text.match(/(\d+)\s*reviews?/i);
      return match ? parseInt(match[1], 10) : 0;
    }

    extractProposals(text) {
      const match = text.match(/Proposals:.*?(\d+\s*to\s*\d+|less than \d+|\d+)/is);
      if (!match) return 20;

      const pText = match[1].toLowerCase();
      if (pText.includes('less than')) {
        const num = parseInt(pText.match(/\d+/)?.[0] || '0', 10);
        return Math.max(num - 1, 0);
      }
      if (pText.includes('to')) {
        const nums = pText.match(/\d+/g);
        if (nums && nums.length >= 2) {
          return (parseInt(nums[0], 10) + parseInt(nums[1], 10)) / 2;
        }
      }
      return parseInt(pText.match(/\d+/)?.[0] || '0', 10);
    }

    extractLastViewed(text) {
      const match = text.match(/Last viewed by client:.*?(\d+)\s*(minute|hour|day)s?\s*ago/is);
      if (!match) return null;

      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const now = Date.now();

      if (unit.includes('minute')) return new Date(now - value * 60 * 1000);
      if (unit.includes('hour')) return new Date(now - value * 60 * 60 * 1000);
      if (unit.includes('day')) return new Date(now - value * 24 * 60 * 60 * 1000);
      return null;
    }

    extractInvites(text) {
      const match = text.match(/Invites sent:.*?(\d+)/is);
      return match ? parseInt(match[1], 10) : 0;
    }

    extractInterviewing(text) {
      const match = text.match(/Interviewing:.*?(\d+)/is);
      return match ? parseInt(match[1], 10) : 0;
    }

    extractUnansweredInvites(text) {
      const match = text.match(/Unanswered invites?:\s*([\d]+)/i);
      return match ? parseInt(match[1], 10) : 0;
    }

    extractMemberSince(text) {
      const match = text.match(/Member since\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
      return match ? new Date(match[1]) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    }

    extractCountry(text) {
      const tier1 = [
        'United States',
        'Canada',
        'United Kingdom',
        'Australia',
        'Germany',
        'Switzerland',
        'Sweden',
        'Denmark',
        'Norway',
        'Netherlands',
        'Singapore',
        'New Zealand',
      ];
      return tier1.find((c) => text.includes(c)) || null;
    }

    extractPostedTime(text) {
      const match = text.match(/Posted\s+(\d+)\s+(minute|hour|day|week|month)s?\s+ago/i);
      if (!match) return null;

      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const now = Date.now();

      if (unit.includes('minute')) return new Date(now - value * 60 * 1000);
      if (unit.includes('hour')) return new Date(now - value * 60 * 60 * 1000);
      if (unit.includes('day')) return new Date(now - value * 24 * 60 * 60 * 1000);
      if (unit.includes('week')) return new Date(now - value * 7 * 24 * 60 * 60 * 1000);
      if (unit.includes('month')) return new Date(now - value * 30 * 24 * 60 * 60 * 1000);
      return null;
    }

    extractAvgHourly(text) {
      const match = text.match(/\$([\d.,]+)\s*\/hr\s*avg hourly rate paid/i);
      return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
    }

    // =========================
    // FASE 2: EVALUACIÓN / UI
    // =========================
    evaluateAndRender(jobId, data) {
      log('FASE 2', `Evaluando job ${jobId}`);

      if (typeof evaluateSniper !== 'function') {
        logError('FASE 2', 'evaluateSniper() no está disponible');
        return;
      }

      const result = evaluateSniper(data);
      log('FASE 2', `Resultado job ${jobId}`, result);

      // Cachear para persistir tras refresh/navegación
      this.setCachedResult(jobId, result);

      this.renderUI(result, data);
      logSuccess(`Renderizado completado para job ${jobId}`);
    }

    renderUI(result, rawData) {
      // Buscar la job card correspondiente en el feed (no dentro del modal/details)
      const jobCard = this.findJobCardById(this.currentJobId);
      
      if (jobCard) {
        // Remover solo el overlay de ESTE job (no de otros jobs en la misma card si hubiera)
        const existingOverlay = jobCard.querySelector(`.sniper-overlay[data-job-id="${this.currentJobId}"]`);
        if (existingOverlay) existingOverlay.remove();
        
        // También remover overlay sin job-id (legacy) solo si no hay otro overlay con job-id diferente
        const legacyOverlay = jobCard.querySelector('.sniper-overlay:not([data-job-id])');
        if (legacyOverlay) legacyOverlay.remove();
        
        this.injectOverlay(jobCard, result, rawData, this.currentJobId);
        logSuccess(`Overlay inyectado en la job card para ${this.currentJobId}`);
      } else {
        logError('FASE 2', `No se encontró la job card para inyectar overlay (job ${this.currentJobId})`);
      }
    }

    findJobCardById(jobId) {
      if (!jobId) return null;

      // Excluir todo lo que esté dentro del modal de detalles
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

      // Si no hay coincidencia explícita, no forzar overlay en otra card
      return null;
    }

    injectOverlay(card, result, rawData, jobId = null) {
      // Crear el overlay container
      const overlay = document.createElement('div');
      overlay.className = 'sniper-overlay';
      
      // Agregar identificador del job para evitar sobreescrituras
      if (jobId) {
        overlay.setAttribute('data-job-id', jobId);
      }
      
      // Crear badges (solo íconos)
      const badgesContainer = document.createElement('div');
      badgesContainer.className = 'sniper-badges';
      
      result.badges.forEach((badge) => {
        const badgeEl = this.createBadge(badge);
        badgesContainer.appendChild(badgeEl);
      });
      
      // Crear score badge
      const scoreEl = this.createScoreBadge(result, rawData);
      
      // Agregar al overlay: badges primero, luego score
      overlay.appendChild(badgesContainer);
      overlay.appendChild(scoreEl);
      
      // Inyectar en la card
      card.style.position = 'relative';
      card.appendChild(overlay);
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

    setCachedResult(jobId, result) {
      if (!jobId || !result) return;
      const cache = this.loadCache();
      cache[jobId] = { result, ts: Date.now() };
      this.pruneCache(cache);
      this.saveCache(cache);
    }

    getCachedResult(jobId) {
      const cache = this.loadCache();
      return cache[jobId]?.result || null;
    }

    applyCachedOverlaysToFeed() {
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
        const cached = cache[jobId]?.result;
        if (!cached) return;

        const card = link.closest('section.air3-card-section, article.job-tile, [data-test="job-tile"]');
        if (!card || isInsideModal(card)) return;

        // Verificar si ya existe un overlay para ESTE job específico
        const existingOverlay = card.querySelector(`.sniper-overlay[data-job-id="${jobId}"]`);
        if (existingOverlay) return;

        // Si hay un overlay legacy (sin job-id), no lo tocamos para evitar conflictos
        const legacyOverlay = card.querySelector('.sniper-overlay:not([data-job-id])');
        if (legacyOverlay) return;

        this.injectOverlay(card, cached, null, jobId);
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
          <div class="tooltip-title">Killed</div>
          <div class="tooltip-meta kill">Motivos:</div>
          <ul class="tooltip-kill-list">
            ${result.killSwitches.map((k) => `<li>${k}</li>`).join('')}
          </ul>
        `;
        return tooltip;
      }

      const breakdown = this.buildComponentBreakdown(result, rawData || {});

      const metaLine = `Base: ${result.baseScore} | Bonus: +${result.totals.bonuses} | Penalty: ${result.totals.penalties}`;

      tooltip.innerHTML = `
        <div class="tooltip-title">Detalle del score</div>
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
        hireRate: 'Hire rate',
        spend: 'Spend',
        rating: 'Rating',
        activity: 'Activity',
        proposals: 'Proposals',
        payment: 'Payment',
        jobs: 'Jobs posted',
      };

      const getTone = (score) => (score >= 85 ? 'good' : score >= 60 ? 'warn' : 'bad');

      const reasons = {
        hireRate:
          result.componentScores.hireRate === 0
            ? jobs > 0
              ? `Hire rate ${Math.max(hireRatePct, 0)}% con ${hires}/${jobs} hires`
              : 'Sin historial de hires'
            : '',
        spend:
          result.componentScores.spend === 0
            ? safeData.totalSpent > 0
              ? `$${Math.round(avgPrice)} por contratación (bajo)`
              : 'Sin gasto histórico'
            : '',
        rating:
          result.componentScores.rating === 0
            ? safeData.rating
              ? `Rating ${safeData.rating}/5 con ${safeData.reviewsCount || 0} reviews`
              : 'Sin rating / reviews'
            : '',
        activity:
          result.componentScores.activity === 0
            ? hoursSinceViewed !== null
              ? `Visto hace ${hoursSinceViewed}h`
              : 'Sin "last viewed" visible (asumido frío)'
            : '',
        proposals:
          result.componentScores.proposals === 0
            ? safeData.proposalCount
              ? `${safeData.proposalCount}+ propuestas (competencia alta)`
              : 'Propuestas no disponibles (asumidas altas)'
            : '',
        payment:
          result.componentScores.payment === 0 ? 'Payment no verificado' : '',
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

    createBadge(badgeName) {
      const config = this.getBadgeConfig(badgeName);
      const badgeEl = document.createElement('span');
      badgeEl.className = `sniper-badge ${config.type}`;

      if (config.iconSvg) {
        badgeEl.innerHTML = config.iconSvg;
      } else {
        badgeEl.textContent = config.icon || '';
      }

      // Tooltip HTML con jerarquía (título + descripción)
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

    getBadgeConfig(badge) {
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
          description: 'Pago menor al promedio menor $100 fixed o $15/hora',
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
          description: 'Rating menor a 4.5, posible riesgo de mala experiencia y/o baja califación',
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
      };
      return configs[badge] || { icon: '🔹', type: 'neutral', description: badge };
    }
  }

  new UpworkSniperExtension();
})();
