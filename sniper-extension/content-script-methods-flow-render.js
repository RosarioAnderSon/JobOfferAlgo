(() => {
  'use strict';
  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logVerbose = logs.logVerbose || (() => {});
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.buildJobMismatchReason = function(jobId, activeJobId) {
    const normalizedJobId =
      typeof this.normalizeJobIdForCompare === 'function' ? this.normalizeJobIdForCompare(jobId) : String(jobId || '');
    const normalizedActiveJobId =
      typeof this.normalizeJobIdForCompare === 'function'
        ? this.normalizeJobIdForCompare(activeJobId)
        : String(activeJobId || '');
    const variantsJobId =
      typeof this.getComparableJobIdVariants === 'function'
        ? Array.from(this.getComparableJobIdVariants(jobId)).join(',')
        : normalizedJobId;
    const variantsActiveJobId =
      typeof this.getComparableJobIdVariants === 'function'
        ? Array.from(this.getComparableJobIdVariants(activeJobId)).join(',')
        : normalizedActiveJobId;
    return `rawJobId=${jobId}|rawActiveJobId=${activeJobId}|normalizedJobId=${normalizedJobId}|normalizedActiveJobId=${normalizedActiveJobId}|variantsJobId=${variantsJobId}|variantsActiveJobId=${variantsActiveJobId}`;
  };

  UpworkSniperExtension.prototype.evaluateAndRender = function(jobId, data) {
    if (typeof this.flow === 'function') this.flow('evaluate-start', { jobId });
    log('FASE 2', `Evaluando job ${jobId}`);
    if (typeof evaluateSniper !== 'function') {
      logError('FASE 2', 'evaluateSniper() no esta disponible');
      return;
    }
    const stagnantDays = this.getStagnantDays(jobId);
    if (stagnantDays > 0) log('FASE 2', `Job ${jobId} detectado estancado por ${stagnantDays} dias`);
    const enrichedData = { ...data, stagnantDays };
    const weights = typeof this.getScoreWeights === 'function' ? this.getScoreWeights() : null;
    const result = evaluateSniper(enrichedData, weights);
    logVerbose('FASE 2', `Resultado job ${jobId}`, result);
    this.setCachedResult(jobId, result, data);
    if (typeof this.flow === 'function') this.flow('cache-write', { jobId, reason: `score=${result.finalScore}` });
    this.updateMissingSkillsFinalScore(jobId, result.finalScore);
    const rendered = this.renderUI(result, data, jobId);
    if (typeof this.flow === 'function') {
      this.flow('evaluate-end', { jobId, reason: rendered ? 'rendered' : 'render-skipped' });
    }
    if (rendered) logSuccess(`Renderizado completado para job ${jobId}`);
    else log('FASE 2', `Render omitido para job ${jobId}`);
  };

  UpworkSniperExtension.prototype.renderUI = function(result, rawData, jobId) {
    if (typeof this.flow === 'function') this.flow('render-start', { jobId });
    if (!jobId) {
      logError('FASE 2', 'renderUI() sin jobId');
      return false;
    }
    const activeModalJobId = typeof this.getOpenModalJobId === 'function' ? this.getOpenModalJobId() : null;
    if (activeModalJobId && (!this.isSameJobId || !this.isSameJobId(activeModalJobId, jobId))) {
      if (typeof this.flow === 'function') {
        this.flow('render-cancel-modal-mismatch', {
          jobId,
          reason: this.buildJobMismatchReason(jobId, activeModalJobId),
        });
      }
      logVerbose('FASE 2', `Render cancelado para ${jobId}; modal activo ${activeModalJobId}`);
      return false;
    }
    if (typeof this.hasOverlayRuntimeReady === 'function' && !this.hasOverlayRuntimeReady()) {
      logError('FASE 2', 'Overlay runtime no esta listo para renderUI()');
      return false;
    }
    const jobCard = this.findJobCardById(jobId);
    if (!jobCard) {
      if (typeof this.flow === 'function') this.flow('card-not-found', { jobId, reason: 'findJobCardById-null' });
      logError('FASE 2', `No se encontro la job card para inyectar overlay (job ${jobId})`);
      return false;
    }

    const outerCard = typeof this.resolveOuterCard === 'function' ? this.resolveOuterCard(jobCard) : jobCard;
    const now = Date.now();
    if (!this.overlayRenderDebounceByJob) this.overlayRenderDebounceByJob = {};
    const lastRenderAt = Number(this.overlayRenderDebounceByJob[jobId] || 0);
    const existingOverlayNow = this.findOverlayForJob(outerCard, jobId);
    if (existingOverlayNow && now - lastRenderAt < 3000) {
      this.cleanupOverlays(outerCard, jobId);
      logVerbose('FASE 2', `Render evitado por debounce (${jobId})`);
      return true;
    }

    this.removeOrphanOverlays();
    this.cleanupOverlays(jobCard, jobId);
    if (outerCard !== jobCard) this.cleanupOverlays(outerCard, jobId);
    this.removeOverlaysForJob(outerCard, jobId, 'render-ui-replace');
    this.injectOverlay(jobCard, result, rawData, jobId);
    if (typeof this.flow === 'function') this.flow('overlay-injected', { jobId, reason: 'render-ui' });
    this.overlayRenderDebounceByJob[jobId] = now;
    Object.keys(this.overlayRenderDebounceByJob)
      .sort((a, b) => this.overlayRenderDebounceByJob[b] - this.overlayRenderDebounceByJob[a])
      .slice(120)
      .forEach((oldJobId) => delete this.overlayRenderDebounceByJob[oldJobId]);
    logSuccess(`Overlay inyectado en la job card para ${jobId}`);
    return true;
  };

  UpworkSniperExtension.prototype.findJobCardById = function(jobId) {
    if (!jobId || typeof this.getCardJobId !== 'function' || typeof this.getFeedJobLinks !== 'function') return null;
    const candidateCards =
      typeof this.getFeedJobCards === 'function'
        ? this.getFeedJobCards(document)
        : Array.from(document.querySelectorAll('section.air3-card-section, article.job-tile, [data-test="job-tile"]'));
    const isSame = (left, right) =>
      typeof this.isSameJobId === 'function'
        ? this.isSameJobId(left, right)
        : String(left || '').trim() === String(right || '').trim();
    const byResolvedId = candidateCards.find((card) => isSame(this.getCardJobId(card), jobId));
    if (byResolvedId) {
      if (typeof this.flow === 'function') this.flow('card-found', { jobId, reason: 'resolved-id' });
      return byResolvedId;
    }
    const byLink = candidateCards.find((card) =>
      this.getFeedJobLinks(card).some((link) =>
        isSame(this.extractJobIdFromHref(link.getAttribute('href') || link.href || ''), jobId)
      )
    );
    if (byLink) {
      if (typeof this.flow === 'function') this.flow('card-found', { jobId, reason: 'link-fallback' });
      return byLink;
    }
    if (typeof this.flow === 'function') {
      this.flow('card-miss', { jobId, reason: `candidates=${candidateCards.length}` });
    }
    return null;
  };
})();
