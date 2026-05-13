(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logVerbose = logs.logVerbose || (() => {});

  UpworkSniperExtension.prototype.watchUrlChanges = function() {
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
  };

  UpworkSniperExtension.prototype.watchDetailModalChanges = function() {
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
  };

  UpworkSniperExtension.prototype.onUrlChange = function(trigger = 'unknown') {
    const url = window.location.href;
    const now = Date.now();
    if (url === this.lastUrlChangeHandledUrl && now - this.lastUrlChangeHandledAt < 900) {
      logVerbose('ROUTE', `Cambio de URL duplicado ignorado (${trigger}) -> ${url}`);
      return;
    }
    this.lastUrlChangeHandledUrl = url;
    this.lastUrlChangeHandledAt = now;
    this.lastUrl = url;
    if (typeof this.flow === 'function') {
      this.flow('route-url-change', { reason: trigger, currentJobId: this.currentJobId });
    }
    log('ROUTE', `Cambio de URL detectado -> ${url}`);
    const isDetailRoute = /\/details\/~[A-Za-z0-9]+/.test(window.location.pathname || url);
    this.markOverlayActivity(isDetailRoute ? 'url-change' : 'feed-route-change');
    this.checkCurrentPage();
  };

  UpworkSniperExtension.prototype.checkCurrentPage = function() {
    const url = window.location.href;
    const detailMatch = url.match(/\/details\/~([A-Za-z0-9]+)/);
    const modalJobId = this.getOpenModalJobId();
    const jobId = detailMatch?.[1] || modalJobId;

    if (jobId) {
      if (typeof this.isSameJobId === 'function' && this.isSameJobId(jobId, this.currentJobId)) {
        if (typeof this.flow === 'function') {
          this.flow('detail-skipped-same-id', { jobId, reason: 'same-current-job' });
        }
        log('DETAIL', `Job ${jobId} ya procesado, saltando`);
        return;
      }

      this.currentJobId = jobId;
      window.__sniperCurrentJobId = this.currentJobId;
      if (typeof this.flow === 'function') {
        this.flow('detail-detected', { jobId, reason: detailMatch?.[1] ? 'url' : 'modal' });
      }
      log('DETAIL', `Detectado job detail: ${jobId}`);
      this.markOverlayActivity('job-detail-open');
      this.waitForJobContent(jobId);
    } else {
      const hadActiveDetailWatcher = !!this.detailWatcherIntervalId;
      const modalVisible = !!document.querySelector(
        '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
      );
      if (typeof this.flow === 'function') {
        this.flow('route-no-detail', {
          reason: hadActiveDetailWatcher ? 'watcher-active' : 'no-modal',
          currentJobId: this.currentJobId,
        });
      }
      // Fix puntual: si hay watcher activo y modal visible, no resetear currentJobId todavia.
      if (hadActiveDetailWatcher && modalVisible) {
        return;
      }
      this.currentJobId = null;
      window.__sniperCurrentJobId = this.currentJobId;
      if (this.isFreelancerProfilePage()) {
        log('ROUTE', 'Freelancer profile detectado, extrayendo skills de perfil');
        this.captureFreelancerProfileSkills();
        return;
      }
      log('ROUTE', 'No estamos en un job detail');
    }
  };

  UpworkSniperExtension.prototype.getOpenModalJobId = function() {
    const modal = document.querySelector(
      '[role="dialog"].air3-slider-job-details, .air3-slider-job-details, .job-details-content'
    );
    if (!modal) return null;

    const parseJobIdCandidate = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      const fromHref = raw.match(/~([A-Za-z0-9]+)/);
      if (fromHref) {
        const looksLikeHref = raw.includes('/') || raw.includes('http');
        if (looksLikeHref && typeof this.isJobDetailsHref === 'function' && !this.isJobDetailsHref(raw)) {
          return null;
        }
        const candidate = fromHref[1];
        if (typeof this.isLikelyJobId === 'function') return this.isLikelyJobId(candidate) ? candidate : null;
        return candidate;
      }
      if (/^[A-Za-z0-9]{18,}$/.test(raw) && (raw.startsWith('0') || /^\d{18,}$/.test(raw))) {
        return raw;
      }
      return null;
    };

    // 1) Priorizar atributos del contenedor modal para evitar alternancia intra-modal.
    const modalAttrCandidate =
      modal.getAttribute('data-opening-uid') ||
      modal.getAttribute('data-ev-opening_uid') ||
      modal.getAttribute('data-job-id');
    const parsedModalAttr = parseJobIdCandidate(modalAttrCandidate);
    if (parsedModalAttr) return parsedModalAttr;

    // 2) Revisar atributos anidados; si uno coincide con currentJobId, preferirlo.
    const nestedNodes = Array.from(modal.querySelectorAll('[data-opening-uid], [data-ev-opening_uid], [data-job-id]'));
    const parsedNested = [];
    for (const node of nestedNodes) {
      if (!(node instanceof Element)) continue;
      const attrCandidate =
        node.getAttribute('data-opening-uid') ||
        node.getAttribute('data-ev-opening_uid') ||
        node.getAttribute('data-job-id');
      const parsed = parseJobIdCandidate(attrCandidate);
      if (parsed) parsedNested.push(parsed);
    }
    if (parsedNested.length > 0) {
      if (typeof this.isSameJobId === 'function' && this.currentJobId) {
        const sameAsCurrent = parsedNested.find((id) => this.isSameJobId(id, this.currentJobId));
        if (sameAsCurrent) return sameAsCurrent;
      }
      return parsedNested[0];
    }

    // 3) Fallback a links cuando no hay attrs fiables.
    const jobLink = modal.querySelector(
      'a[href*="/jobs/"][href*="~"], a[href*="/freelance-jobs/"][href*="~"], a[href*="/details/"][href*="~"], a[href*="/nx/find-work/"][href*="~"]'
    );
    const href = jobLink?.getAttribute('href') || jobLink?.href || '';
    return parseJobIdCandidate(href);
  };

  UpworkSniperExtension.prototype.isFreelancerProfilePage = function() {
    return /\/freelancers\/~[A-Za-z0-9]+/i.test(window.location.pathname || '');
  };
})();
