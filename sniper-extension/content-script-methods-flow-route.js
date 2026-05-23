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
    if (this.detailWatcherIntervalId) {
      clearInterval(this.detailWatcherIntervalId);
      this.detailWatcherIntervalId = null;
      if (typeof this.flow === 'function') {
        this.flow('watcher-cancel-session', { jobId, reason: 'new-watcher-start' });
      }
    }
    this.detailWatcherSessionId = Number(this.detailWatcherSessionId || 0) + 1;
    const sessionId = this.detailWatcherSessionId;
    if (typeof this.flow === 'function') {
      this.flow('watcher-start', { jobId, sessionId, reason: 'wait-for-content' });
    }
    log('DETAIL', `Esperando a que cargue el contenido del job ${jobId}...`);
    let attempts = 0;
    const maxAttempts = 30;
    const checkInterval = setInterval(() => {
      if (sessionId !== this.detailWatcherSessionId) {
        clearInterval(checkInterval);
        if (this.detailWatcherIntervalId === checkInterval) this.detailWatcherIntervalId = null;
        if (typeof this.flow === 'function') {
          this.flow('watcher-cancel-session', { jobId, sessionId, reason: 'session-mismatch' });
        }
        return;
      }
      const activeModalJobId =
        typeof this.getOpenModalJobId === 'function' ? this.getOpenModalJobId() : null;
      if (activeModalJobId && (!this.isSameJobId || !this.isSameJobId(activeModalJobId, jobId))) {
        clearInterval(checkInterval);
        if (this.detailWatcherIntervalId === checkInterval) this.detailWatcherIntervalId = null;
        if (typeof this.flow === 'function') {
          this.flow('watcher-cancel-modal-mismatch', {
            jobId,
            sessionId,
            reason: this.buildJobMismatchReason(jobId, activeModalJobId),
          });
        }
        logVerbose('DETAIL', `Cancelando watcher de ${jobId}; modal activo ahora es ${activeModalJobId}`);
        return;
      }

      attempts += 1;
      const jobModal = document.querySelector(
        '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
      );
      if (!jobModal) {
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          if (this.detailWatcherIntervalId === checkInterval) this.detailWatcherIntervalId = null;
          if (typeof this.flow === 'function') {
            this.flow('watcher-timeout', { jobId, sessionId, reason: 'modal-missing' });
          }
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
      const modalTextLower = (jobModal.textContent || '').toLowerCase();
      const hasClientSection =
        modalTextLower.includes('about the client') || modalTextLower.includes('member since');
      logVerbose(
        'DETAIL',
        `Intento ${attempts}/${maxAttempts}: modal=${!!jobModal}, clientInfo=${!!clientInfo}, desc=${!!jobDescription}, realContent=${hasRealContent}, hasClientSection=${hasClientSection}`
      );
      if (clientInfo && jobDescription && (hasRealContent || hasClientSection)) {
        clearInterval(checkInterval);
        if (this.detailWatcherIntervalId === checkInterval) this.detailWatcherIntervalId = null;
        if (typeof this.flow === 'function') {
          this.flow('watcher-ready', { jobId, sessionId, reason: `attempt=${attempts}` });
        }
        logSuccess('Sidebar del cliente listo; procediendo a evaluar');
        log('DETAIL', `Contenido cargado despues de ${attempts * 500}ms`);
        this.processJobDetail(jobId);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        if (this.detailWatcherIntervalId === checkInterval) this.detailWatcherIntervalId = null;
        if (typeof this.flow === 'function') {
          this.flow('watcher-timeout', { jobId, sessionId, reason: 'content-not-ready' });
        }
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
    this.detailWatcherIntervalId = checkInterval;
  };

  UpworkSniperExtension.prototype.processJobDetail = function(jobId) {
    if (typeof this.flow === 'function') this.flow('extract-start', { jobId });
    log('DETAIL', `Procesando job ${jobId}`);
    const activeModalJobId = typeof this.getOpenModalJobId === 'function' ? this.getOpenModalJobId() : null;
    if (activeModalJobId && (!this.isSameJobId || !this.isSameJobId(activeModalJobId, jobId))) {
      if (typeof this.flow === 'function') {
        this.flow('extract-cancel-modal-mismatch', {
          jobId,
          reason: this.buildJobMismatchReason(jobId, activeModalJobId),
        });
      }
      logVerbose('DETAIL', `Proceso cancelado para ${jobId}; modal activo ${activeModalJobId}`);
      return;
    }
    try {
      const extractedData = this.extractJobData();
      if (typeof this.flow === 'function') {
        this.flow('extract-end', { jobId, reason: `skills=${(extractedData.requiredSkills || []).length}` });
      }
      logVerbose('DETAIL', `Datos extraidos (job ${jobId})`, extractedData);
      this.evaluateAndRender(jobId, extractedData);
    } catch (error) {
      logError('DETAIL', `Error procesando job ${jobId}`, error);
    }
  };
})();
