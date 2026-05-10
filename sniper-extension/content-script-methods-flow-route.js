(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logVerbose = logs.logVerbose || (() => {});
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.waitForJobContent = function(jobId) {
    log('DETAIL', `Esperando a que cargue el contenido del job ${jobId}...`);

    let attempts = 0;
    const maxAttempts = 30; // 15s, tiempo extra para hydration

    const checkInterval = setInterval(() => {
      attempts++;

      const jobModal = document.querySelector(
        '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
      );

      if (!jobModal) {
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          logError('DETAIL', `Timeout esperando modal del job ${jobId} (${attempts * 500}ms)`);
        } else {
          logVerbose('DETAIL', `Intento ${attempts}/${maxAttempts}: Modal del job aun no existe`);
        }
        return;
      }

      const clientInfo = jobModal.querySelector(
        '[data-test="client-info"], .client-info, aside.sidebar, .cfe-ui-job-about-client'
      );
      const jobDescription = jobModal.querySelector('[data-test="Description"], .job-description, .description');

      const sidebarText = clientInfo?.innerText || clientInfo?.textContent || '';
      const sidebarTextLower = sidebarText.toLowerCase();
      const hasRealContent = [
        'member since',
        'payment verified',
        'payment method verified',
        'jobs posted',
        'total spent',
        'hire rate',
      ].some((token) => sidebarTextLower.includes(token));

      const modalText = jobModal.textContent || '';
      const modalTextLower = modalText.toLowerCase();
      const hasClientSection =
        modalTextLower.includes('about the client') || modalTextLower.includes('member since');

      logVerbose(
        'DETAIL',
        `Intento ${attempts}/${maxAttempts}: modal=${!!jobModal}, clientInfo=${!!clientInfo}, desc=${!!jobDescription}, realContent=${hasRealContent}, hasClientSection=${hasClientSection}`
      );

      if (clientInfo && jobDescription && (hasRealContent || hasClientSection)) {
        clearInterval(checkInterval);
        logSuccess('Sidebar del cliente listo; procediendo a evaluar');
        log('DETAIL', `Contenido cargado despues de ${attempts * 500}ms`);
        this.processJobDetail(jobId);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        logError(
          'DETAIL',
          `Timeout esperando contenido del job ${jobId} (${attempts * 500}ms). ` +
            `clientInfo: ${!!clientInfo}, jobDescription: ${!!jobDescription}, realContent: ${hasRealContent}, hasClientSection: ${hasClientSection}`
        );

        if (jobModal && clientInfo && jobDescription) {
          logVerbose('DETAIL', 'Intentando procesar con contenido parcial...');
          this.processJobDetail(jobId);
        }
      }
    }, 500);
  };

  UpworkSniperExtension.prototype.processJobDetail = function(jobId) {
    log('DETAIL', `Procesando job ${jobId}`);
    try {
      const extractedData = this.extractJobData();
      logVerbose('DETAIL', `Datos extraidos (job ${jobId})`, extractedData);
      this.evaluateAndRender(jobId, extractedData);
    } catch (error) {
      logError('DETAIL', `Error procesando job ${jobId}`, error);
    }
  };

  UpworkSniperExtension.prototype.getJobScope = function() {
    const modal = document.querySelector(
      '[role="dialog"].air3-slider-job-details, .job-details-content, .air3-slider-job-details'
    );
    if (modal) return modal;

    const detail = document.querySelector('.job-details, main');
    return detail || document.body;
  };

  UpworkSniperExtension.prototype.extractJobData = function() {
    const scope = this.getJobScope();

    const sidebar = scope.querySelector(
      'aside.sidebar, .cfe-ui-job-about-client, [data-test="client-info"], .client-info'
    );

    const aboutClientSection = Array.from(scope.querySelectorAll('h4, h3, h2')).find(
      (h) => h.textContent?.trim() === 'About the client'
    )?.nextElementSibling;

    const effectiveSidebar = sidebar || aboutClientSection || scope;
    const sidebarText = effectiveSidebar?.innerText || effectiveSidebar?.textContent || '';

    logVerbose('DETAIL', '--- EXTRACCION DE DATOS ---');
    logVerbose('DETAIL', `Scope selector: ${scope === document.body ? 'body' : scope.className || scope.tagName}`);
    logVerbose('DETAIL', `Sidebar found: ${!!sidebar} (${sidebar?.className || sidebar?.tagName || 'N/A'})`);
    logVerbose('DETAIL', `About client section: ${!!aboutClientSection}`);
    logVerbose('DETAIL', `Effective sidebar text length: ${sidebarText.length} chars`);
    logVerbose('DETAIL', `Effective sidebar first 400 chars: "${sidebarText.substring(0, 400).replace(/\s+/g, ' ')}"`);

    const activityHeader = Array.from(scope.querySelectorAll('h5, h4')).find((el) =>
      el?.textContent?.includes('Activity on this job')
    );
    const activitySection =
      activityHeader?.parentElement || activityHeader?.closest('section') || effectiveSidebar?.parentElement || scope;
    const activityText = activitySection?.innerText || activitySection?.textContent || '';

    logVerbose('DETAIL', `Activity section found: ${!!activityHeader}`);
    logVerbose('DETAIL', `Activity text length: ${activityText.length} chars`);

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

    logVerbose('DETAIL', `Description length: ${descText.length} chars`);
    logVerbose('DETAIL', `Total scope text length: ${scopeText.length} chars`);
    logVerbose('DETAIL', '------------------------------------');

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
      hasLowEffortTemplate: extractors.extractLowEffortTemplate(titleText, descText),
      experienceLevel: extractors.extractExperienceLevel(scopeText),
      hasJobNoLongerAvailable: /job is no longer available/i.test(scopeText),
    };

    extractedData.jobBudget = extractors.extractFixedBudget(scopeText);
    const accountAgeDays = Math.max(0, (Date.now() - extractedData.memberSince.getTime()) / (24 * 60 * 60 * 1000));
    extractedData.hasHighBudgetNewClientScam =
      !extractedData.paymentVerified &&
      accountAgeDays < 31 &&
      extractedData.jobsPosted <= 1 &&
      extractedData.totalHires === 0 &&
      extractedData.totalSpent === 0 &&
      extractedData.reviewsCount === 0 &&
      Number(extractedData.jobBudget || 0) >= 2000;

    extractedData.supportAvgBadge = this.computeSupportAvgBadge(extractedData);
    extractedData.skillsMatch = this.computeSkillsMatch(requiredSkills, extractedData.jobId);

    logVerbose('DETAIL', 'Valores extraidos:');
    logVerbose('DETAIL', `  - jobsPosted: ${extractedData.jobsPosted}`);
    logVerbose('DETAIL', `  - totalHires: ${extractedData.totalHires}`);
    logVerbose('DETAIL', `  - totalSpent: $${extractedData.totalSpent}`);
    logVerbose('DETAIL', `  - hireRatePct: ${extractedData.hireRatePct}%`);
    logVerbose('DETAIL', `  - paymentVerified: ${extractedData.paymentVerified}`);
    logVerbose('DETAIL', `  - rating: ${extractedData.rating}`);
    logVerbose('DETAIL', `  - memberSince: ${extractedData.memberSince?.toDateString?.() || 'N/A'}`);
    logVerbose('DETAIL', `  - requiredSkills: ${requiredSkills.length}`);

    return extractedData;
  };

  UpworkSniperExtension.prototype.evaluateAndRender = function(jobId, data) {
    log('FASE 2', `Evaluando job ${jobId}`);
    if (typeof evaluateSniper !== 'function') {
      logError('FASE 2', 'evaluateSniper() no esta disponible');
      return;
    }

    const stagnantDays = this.getStagnantDays(jobId);
    if (stagnantDays > 0) {
      log('FASE 2', `Job ${jobId} detectado estancado por ${stagnantDays} dias`);
    }

    const enrichedData = { ...data, stagnantDays };

    const weights = typeof this.getScoreWeights === 'function' ? this.getScoreWeights() : null;
    const result = evaluateSniper(enrichedData, weights);
    logVerbose('FASE 2', `Resultado job ${jobId}`, result);

    this.setCachedResult(jobId, result, data);
    this.updateMissingSkillsFinalScore(jobId, result.finalScore);

    const rendered = this.renderUI(result, data);
    if (rendered) {
      logSuccess(`Renderizado completado para job ${jobId}`);
    } else {
      log('FASE 2', `Render omitido para job ${jobId}`);
    }
  };

  UpworkSniperExtension.prototype.renderUI = function(result, rawData) {
    if (typeof this.hasOverlayRuntimeReady === 'function' && !this.hasOverlayRuntimeReady()) {
      logError('FASE 2', 'Overlay runtime no esta listo para renderUI()');
      return false;
    }

    const jobCard = this.findJobCardById(this.currentJobId);

    if (jobCard) {
      const now = Date.now();
      if (!this.overlayRenderDebounceByJob) this.overlayRenderDebounceByJob = {};
      const lastRenderAt = Number(this.overlayRenderDebounceByJob[this.currentJobId] || 0);
      const existingOverlayNow = jobCard.querySelector(`.sniper-overlay[data-job-id="${this.currentJobId}"]`);
      if (existingOverlayNow && now - lastRenderAt < 3000) {
        logVerbose('FASE 2', `Render evitado por debounce (${this.currentJobId})`);
        return true;
      }

      this.removeOrphanOverlays();
      this.cleanupOverlays(jobCard, this.currentJobId);

      const existingOverlay = jobCard.querySelector(`.sniper-overlay[data-job-id="${this.currentJobId}"]`);
      if (existingOverlay) existingOverlay.remove();

      const legacyOverlay = jobCard.querySelector('.sniper-overlay:not([data-job-id])');
      if (legacyOverlay) legacyOverlay.remove();

      this.injectOverlay(jobCard, result, rawData, this.currentJobId);
      this.overlayRenderDebounceByJob[this.currentJobId] = now;
      const debounceKeys = Object.keys(this.overlayRenderDebounceByJob);
      if (debounceKeys.length > 120) {
        debounceKeys
          .sort((a, b) => this.overlayRenderDebounceByJob[b] - this.overlayRenderDebounceByJob[a])
          .slice(80)
          .forEach((jobId) => delete this.overlayRenderDebounceByJob[jobId]);
      }
      logSuccess(`Overlay inyectado en la job card para ${this.currentJobId}`);
      return true;
    } else {
      logError('FASE 2', `No se encontro la job card para inyectar overlay (job ${this.currentJobId})`);
      return false;
    }
  };

  UpworkSniperExtension.prototype.findJobCardById = function(jobId) {
    if (!jobId) return null;
    if (typeof this.getCardJobId !== 'function' || typeof this.getFeedJobLinks !== 'function') {
      return null;
    }

    const candidateCards =
      typeof this.getFeedJobCards === 'function'
        ? this.getFeedJobCards(document)
        : Array.from(document.querySelectorAll('section.air3-card-section, article.job-tile, [data-test="job-tile"]'));

    const byResolvedId = candidateCards.find((card) => this.getCardJobId(card) === jobId);
    if (byResolvedId) return byResolvedId;

    const byLink = candidateCards.find((card) =>
      this.getFeedJobLinks(card).some((link) => this.extractJobIdFromHref(link.getAttribute('href') || link.href || '') === jobId)
    );
    if (byLink) return byLink;

    return null;
  };
})();
