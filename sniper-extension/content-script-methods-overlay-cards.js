(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logVerbose = logs.logVerbose || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.isLikelyJobId = function(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (!/^[A-Za-z0-9]+$/.test(raw)) return false;
    if (raw.length < 18) return false;
    if (raw.startsWith('0')) return true;
    if (/^\d{18,}$/.test(raw)) return true;
    return false;
  };

  UpworkSniperExtension.prototype.isJobDetailsHref = function(href) {
    const raw = String(href || '').trim();
    if (!raw) return false;

    let path = raw.toLowerCase();
    try {
      path = new URL(raw, window.location.origin).pathname.toLowerCase();
    } catch (error) {
      // Relative or malformed hrefs still get filtered by their raw path below.
    }

    if (path.includes('/freelancers/')) return false;
    return path.includes('/jobs/') || path.includes('/freelance-jobs/') || path.includes('/details/');
  };

  UpworkSniperExtension.prototype.extractJobIdFromHref = function(href) {
    const source = String(href || '');
    if (!source) return null;
    if (!this.isJobDetailsHref(source)) return null;
    const match = source.match(/~([A-Za-z0-9]+)/);
    if (!match) return null;
    const candidate = match[1];
    return this.isLikelyJobId(candidate) ? candidate : null;
  };

  UpworkSniperExtension.prototype.getFeedJobLinks = function(root) {
    const scope = root || document;
    const selectors = [
      'a[href*="/jobs/"][href*="~"]',
      'a[href*="/freelance-jobs/"][href*="~"]',
      'a[href*="/details/"][href*="~"]',
      'a[href*="/nx/find-work/"][href*="~"]',
    ];
    return Array.from(scope.querySelectorAll(selectors.join(','))).filter((link) =>
      this.extractJobIdFromHref(link.getAttribute('href') || link.href || '')
    );
  };

  UpworkSniperExtension.prototype.getFeedJobCards = function(root) {
    const scope = root || document;
    const isInsideModal = (el) =>
      el && el.closest('[role="dialog"], .air3-slider-job-details, .job-details-content');

    const cards = [];
    const seen = new Set();
    const addCard = (node) => {
      if (!node || !(node instanceof Element)) return;
      const canonical = typeof this.resolveOuterCard === 'function' ? this.resolveOuterCard(node) : node;
      if (!canonical || !(canonical instanceof Element)) return;
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'SPAN', 'P'].includes(canonical.tagName)) return;
      const cls = typeof canonical.className === 'string' ? canonical.className : '';
      if (cls.includes('title')) return;
      if (isInsideModal(canonical)) return;
      if (seen.has(canonical)) return;
      seen.add(canonical);
      cards.push(canonical);
    };

    const strongSelectors = [
      'section.air3-card-section',
      'article.job-tile',
      '[data-test="job-tile"]',
      'div.air3-card'
    ];
    strongSelectors.forEach((selector) => {
      scope.querySelectorAll(selector).forEach((el) => addCard(el));
    });

    const links = this.getFeedJobLinks(scope);
    links.forEach((link) => {
      let current = link.parentElement;
      while (current && current !== document.body) {
        if (!['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(current.tagName)) {
          const cls = typeof current.className === 'string' ? current.className : '';
          const dataTest = current.getAttribute('data-test') || '';
          if (
            current.matches('section.air3-card-section, article.job-tile, [data-test="job-tile"]') ||
            (cls.includes('job-tile') && !cls.includes('title') && !cls.includes('list')) ||
            (current.classList && current.classList.contains('air3-card')) ||
            dataTest === 'job-tile'
          ) {
            addCard(current);
            break;
          }
        }
        current = current.parentElement;
      }
    });

    return cards;
  };

  UpworkSniperExtension.prototype.getCardJobId = function(card) {
    if (!card) return null;

    let stableAttr = String(card.getAttribute('data-sniper-job-id') || '').trim();
    const directAttrs = ['data-job-id', 'data-opening-uid', 'data-ev-opening_uid'];
    let attrId = null;
    for (const attr of directAttrs) {
      const value = card.getAttribute(attr);
      if (this.isLikelyJobId(value)) {
        attrId = String(value).trim();
        break;
      }
    }

    let linkId = null;
    const links = this.getFeedJobLinks(card);
    for (const link of links) {
      const jobId = this.extractJobIdFromHref(link.getAttribute('href') || link.href || '');
      if (jobId) {
        linkId = jobId;
        break;
      }
    }

    if (stableAttr && this.isLikelyJobId(stableAttr)) {
      const canonicalStable = this.toCanonicalJobId(stableAttr);
      if (canonicalStable && stableAttr !== canonicalStable) {
        this.markCardJobId(card, canonicalStable);
        stableAttr = canonicalStable;
      }
      if (attrId && !this.isSameJobId(stableAttr, attrId)) {
        this.markCardJobId(card, attrId);
        return this.toCanonicalJobId(attrId);
      }
      if (linkId && !this.isSameJobId(stableAttr, linkId) && !attrId) {
        this.markCardJobId(card, linkId);
        return this.toCanonicalJobId(linkId);
      }
      return stableAttr;
    }

    if (attrId) {
      this.markCardJobId(card, attrId);
      return attrId;
    }

    if (linkId) {
      this.markCardJobId(card, linkId);
      return linkId;
    }

    return null;
  };

  UpworkSniperExtension.prototype.toCanonicalJobId = function(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (!this.isLikelyJobId(raw)) return raw;
    if (/^\d+$/.test(raw) && raw.length >= 18 && raw.startsWith('02')) {
      const trimmed02 = raw.slice(2);
      if (this.isLikelyJobId(trimmed02)) return trimmed02;
    }
    const normalized =
      typeof this.normalizeJobIdForCompare === 'function' ? this.normalizeJobIdForCompare(raw) : raw;
    return this.isLikelyJobId(normalized) ? normalized : raw;
  };

  UpworkSniperExtension.prototype.markCardJobId = function(card, jobId) {
    if (!card || !jobId) return;
    const canonical = this.toCanonicalJobId(jobId);
    card.setAttribute('data-sniper-job-id', canonical || String(jobId).trim());
  };

  UpworkSniperExtension.prototype.getMarkedCardJobId = function(card, preferredJobId = null) {
    if (!card) return null;

    const ownJobId = String(card.getAttribute('data-sniper-job-id') || '').trim();
    if (this.isLikelyJobId(ownJobId)) return ownJobId;

    if (preferredJobId && this.isLikelyJobId(preferredJobId)) {
      const preferredMarker = Array.from(card.querySelectorAll('[data-sniper-job-id]')).find((node) =>
        this.isSameJobId(node.getAttribute('data-sniper-job-id'), preferredJobId)
      );
      if (preferredMarker) return this.toCanonicalJobId(preferredMarker.getAttribute('data-sniper-job-id'));
    }

    const markedNode = Array.from(card.querySelectorAll('[data-sniper-job-id]')).find((node) =>
      this.isLikelyJobId(node.getAttribute('data-sniper-job-id'))
    );
    return markedNode ? this.toCanonicalJobId(markedNode.getAttribute('data-sniper-job-id')) : null;
  };
})();
