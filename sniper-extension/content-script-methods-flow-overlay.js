(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.extractJobIdFromHref = function(href) {
    const source = String(href || '');
    if (!source) return null;
    const match = source.match(/~([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  };

  UpworkSniperExtension.prototype.getFeedJobLinks = function(root) {
    const scope = root || document;
    return Array.from(scope.querySelectorAll('a[href*="~"]'));
  };

  UpworkSniperExtension.prototype.getCardJobId = function(card) {
    if (!card) return null;

    const stableAttr = card.getAttribute('data-sniper-job-id');
    if (stableAttr) return stableAttr;

    const directAttrs = ['data-job-id', 'data-opening-uid', 'data-ev-opening_uid'];
    for (const attr of directAttrs) {
      const value = card.getAttribute(attr);
      if (value && /^[A-Za-z0-9]+$/.test(value)) {
        if (value.startsWith('0') || value.length >= 20) return value;
      }
    }

    const links = this.getFeedJobLinks(card);
    for (const link of links) {
      const jobId = this.extractJobIdFromHref(link.getAttribute('href') || link.href || '');
      if (jobId) return jobId;
    }

    return null;
  };

  UpworkSniperExtension.prototype.markCardJobId = function(card, jobId) {
    if (!card || !jobId) return;
    card.setAttribute('data-sniper-job-id', jobId);
  };

  UpworkSniperExtension.prototype.cleanupOverlays = function(card, targetJobId = null) {
    if (!card) return;

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

    if (targetJobId) this.markCardJobId(card, targetJobId);
  };

  UpworkSniperExtension.prototype.removeOrphanOverlays = function() {
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

      const resolvedCardJobId = this.getCardJobId(card);
      if (!resolvedCardJobId) {
        // DOM virtualizado: conserva overlay hasta poder resolver el job real.
        return;
      }

      if (resolvedCardJobId !== overlayJobId) {
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

      const resolvedCardJobId = this.getCardJobId(card);
      if (!resolvedCardJobId) return;
      if (resolvedCardJobId !== panelJobId) panel.remove();
    });
  };

  UpworkSniperExtension.prototype.injectOverlay = function(card, result, rawData, jobId = null) {
    const overlay = document.createElement('div');
    overlay.className = 'sniper-overlay';

    if (jobId) {
      overlay.setAttribute('data-job-id', jobId);
      this.markCardJobId(card, jobId);
    }

    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'sniper-badges';

    const displayBadges = [...(result.badges || [])];
    if (rawData?.supportAvgBadge) displayBadges.push('Niche Avg/hr');
    if (rawData?.skillsMatch) displayBadges.push('Skills match');

    displayBadges.forEach((badge) => {
      const badgeEl = this.createBadge(badge, rawData);
      badgesContainer.appendChild(badgeEl);
    });

    const scoreEl = this.createScoreBadge(result, rawData);
    const settingsEl = this.createSettingsButton();

    overlay.appendChild(badgesContainer);
    overlay.appendChild(scoreEl);
    overlay.appendChild(settingsEl);

    card.style.position = 'relative';
    card.appendChild(overlay);
    this.renderGlobalMissingSkillsSidebar();
  };

  UpworkSniperExtension.prototype.createSettingsButton = function() {
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
      <div class="sniper-settings-label">${this.t('niche')}</div>
      <select class="sniper-settings-select sniper-niche-select">
        <option value="customer_service">${this.t('nicheCustomerService')}</option>
        <option value="customer_support">${this.t('nicheCustomerSupport')}</option>
        <option value="customer_specialist">${this.t('nicheCustomerSpecialist')}</option>
      </select>
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

    const nicheSelect = panel.querySelector('.sniper-niche-select');
    if (nicheSelect) {
      nicheSelect.value = this.getSelectedNiche();
      nicheSelect.addEventListener('change', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setSelectedNiche(nicheSelect.value);
        this.refreshOverlaysFromCache();
      });
    }

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
  };

  UpworkSniperExtension.prototype.copyTextToClipboard = async function(text) {
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
  };

  UpworkSniperExtension.prototype.refreshOverlaysFromCache = function() {
    const overlays = Array.from(document.querySelectorAll('.sniper-overlay'));
    overlays.forEach((overlay) => overlay.remove());
    this.applyCachedOverlaysToFeed();
    this.renderGlobalMissingSkillsSidebar();
  };
})();
