(() => {
  'use strict';

  const tier1Countries = [
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

  const namesApi = window.SniperExtractorNames;
  if (!namesApi) return;

  const { normalizeText, getClientRatingText, extractPossibleClientNames, parseRelativeDate } = namesApi;
  if (typeof parseRelativeDate !== 'function') {
    throw new Error('SniperExtractorNames.parseRelativeDate is not available');
  }

  const SniperExtractors = {
    getClientRatingText,
    extractPossibleClientNames,
    extractSpent(text) {
      const match = text.match(/\$([\d.,]+)([KkMm]?)\s+total spent/i);
      if (!match) return 0;
      let value = parseFloat(match[1].replace(/,/g, ''));
      const multiplier = match[2]?.toLowerCase();
      if (multiplier === 'k') value *= 1000;
      if (multiplier === 'm') value *= 1_000_000;
      return value;
    },
    extractHires(text) {
      const match = text.match(/(\d+)\s*hires?/i);
      return match ? parseInt(match[1], 10) : 0;
    },
    extractJobsPosted(text) {
      const match = text.match(/(\d+)\s*jobs? posted/i);
      return match ? parseInt(match[1], 10) : 0;
    },
    extractHireRate(text) {
      const match =
        text.match(/(\d+)\s*%\s*hire\s*rate/i) ||
        text.match(/hire\s*rate[:\s]+(\d+)\s*%/i);
      return match ? parseInt(match[1], 10) : 0;
    },
    extractRating(text, ratingText = '') {
      const source = normalizeText(ratingText) || normalizeText(text);
      const match =
        source.match(/(\d+(?:\.\d+)?)\s+of\s+([\d,]+)\s+reviews/i) ||
        source.match(/(\d+(?:\.\d+)?)\s*of\s*5/i);
      return match ? parseFloat(match[1]) : 0;
    },
    extractReviews(text, ratingText = '') {
      const source = normalizeText(ratingText) || normalizeText(text);
      const match = source.match(/(\d[\d,]*)\s*reviews?/i);
      return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
    },
    extractHasLowRecentReview(text) {
      const normalized = String(text || '').toLowerCase();
      const contextPattern = /(recent|history|feedback|reviews?\s+you\s+have\s+given|reviews?\s+this\s+client\s+has\s+given|client'?s\s+recent\s+history)/i;
      if (!contextPattern.test(normalized)) return false;
      const pattern = /(\d(?:\.\d{1,2})?)\s*(?:\/\s*5|out of 5)/g;

      let match;
      while ((match = pattern.exec(normalized))) {
        const value = parseFloat(match[1]);
        if (Number.isNaN(value) || value > 4.0) continue;
        const windowText = normalized.slice(
          Math.max(0, match.index - 80),
          Math.min(normalized.length, match.index + 80)
        );
        if (/(review|feedback|history|given)/i.test(windowText)) return true;
      }
      return false;
    },
    extractFixedBudget(text) {
      const source = String(text || '');
      if (!source) return null;
      const patterns = [
        /est\.\s*budget:\s*\$([\d.,]+)\s*([kKmM]?)/i,
        /budget[^$\n]{0,40}\$\s*([\d.,]+)\s*([kKmM]?)/i,
        /fixed[-\s]*price[^$\n]{0,40}\$\s*([\d.,]+)\s*([kKmM]?)/i,
      ];

      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (!match) continue;
        let value = parseFloat(String(match[1] || '').replace(/,/g, ''));
        if (!Number.isFinite(value)) continue;
        const suffix = String(match[2] || '').toLowerCase();
        if (suffix === 'k') value *= 1000;
        if (suffix === 'm') value *= 1000000;
        return value;
      }
      return null;
    },
    extractProposals(text) {
      const source = String(text || '');
      if (!source) return 20;

      // Upwork variants: "Less than 5", "5 to 10", "10-15", "10–15", "50+"
      const match = source.match(
        /Proposals:\s*(less than\s+\d+|\d+\s*(?:to|[^\d\s]+)\s*\d+|\d+\s*\+|\d+)/i
      );
      if (!match) return 20;

      const raw = String(match[1] || '').trim().toLowerCase();
      if (!raw) return 20;

      if (raw.includes('less than')) {
        const num = parseInt(raw.match(/\d+/)?.[0] || '0', 10);
        return Math.max(num - 1, 0);
      }

      if (raw.includes('+')) {
        const num = parseInt(raw.match(/\d+/)?.[0] || '0', 10);
        return Number.isFinite(num) ? num : 20;
      }

      const range = raw.match(/(\d+)\s*(?:to|[^\d\s]+)\s*(\d+)/i);
      if (range) {
        const lower = parseInt(range[1], 10);
        const upper = parseInt(range[2], 10);
        if (!Number.isFinite(lower) || !Number.isFinite(upper)) return 20;
        if (lower === 5 && upper === 10) return 5;
        return lower + 1;
      }

      // Fallback for odd separators caused by encoding/rendering artifacts.
      const numbers = raw.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const lower = parseInt(numbers[0], 10);
        const upper = parseInt(numbers[1], 10);
        if (!Number.isFinite(lower) || !Number.isFinite(upper)) return 20;
        if (lower === 5 && upper === 10) return 5;
        return lower + 1;
      }

      const single = parseInt(raw.match(/\d+/)?.[0] || '0', 10);
      return Number.isFinite(single) ? single : 20;
    },
    extractLastViewed(text) {
      const source = normalizeText(text);
      if (/Last viewed by client:?\s*yesterday\b/i.test(source)) {
        return parseRelativeDate(1, 'day');
      }
      const match = source.match(/Last viewed by client:.*?(\d+)\s*(minute|hour|day)s?\s*ago/i);
      if (!match) return null;
      const value = parseInt(match[1], 10);
      return parseRelativeDate(value, match[2]) || null;
    },
    extractInvites(text) {
      const match = text.match(/Invites sent:.*?(\d+)/is);
      return match ? parseInt(match[1], 10) : 0;
    },
    extractInterviewing(text) {
      const match = text.match(/Interviewing:.*?(\d+)/is);
      return match ? parseInt(match[1], 10) : 0;
    },
    extractUnansweredInvites(text) {
      const match = text.match(/Unanswered invites:.*?(\d+)/is);
      return match ? parseInt(match[1], 10) : 0;
    },
    extractMemberSince(text) {
      const match = text.match(/Member since\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
      return match ? new Date(match[1]) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    },
    extractCountry(text) {
      const normalized = String(text || '').toLowerCase();
      return tier1Countries.find((country) => normalized.includes(country.toLowerCase())) || null;
    },
    extractPostedTime(text) {
      const match = text.match(/Posted\s+(\d+)\s+(minute|hour|day|week|month)s?\s+ago/i);
      if (!match) return null;
      const value = parseInt(match[1], 10);
      return parseRelativeDate(value, match[2]);
    },
    extractAvgHourly(text) {
      const match = text.match(/\$([\d.,]+)\s*\/hr\s*avg hourly rate paid/i);
      return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
    },
    extractOffPlatformContact(text) {
      const normalized = String(text || '').toLowerCase();
      return /(telegram|whatsapp|skype|gmail|outlook|email me|contact me on)/i.test(normalized);
    },
    extractExternalPaymentRisk(text) {
      const normalized = String(text || '').toLowerCase();
      return /(crypto|bitcoin|gift card|wire transfer|check payment|pay outside upwork|buy equipment)/i.test(normalized);
    },
    extractFreeWorkRequest(text) {
      const normalized = String(text || '').toLowerCase();
      return /(free test|unpaid sample|free work|prueba gratis|muestra gratis)/i.test(normalized);
    },
    extractTooGoodToBeTrue(descriptionText, infoText) {
      const normalized = String(descriptionText || '').toLowerCase();
      const lowSignalClient = /0\s+jobs posted|0\s+hires|0\s+reviews|0\s+total spent/i.test(
        String(infoText || '')
      );
      const simpleTask =
        /(data entry|copy paste|simple typing|easy task|quick task|captura de datos|copiar y pegar)/i.test(
          normalized
        );
      const highPay =
        /\$\s*(\d{3,}|\d{2}\s*\/\s*hr|\d{2}\s*per hour|\d{4,})/i.test(normalized);
      return lowSignalClient && simpleTask && highPay;
    },
    extractScopeMonster(text) {
      const normalized = String(text || '').toLowerCase();
      const longDescription = normalized.length >= 1200;
      const domains = [/frontend/i, /backend/i, /design/i, /\bseo\b/i, /\bai\b/i, /deploy/i, /devops/i];
      const matched = domains.filter((regex) => regex.test(normalized)).length;
      return longDescription && matched >= 4;
    },
    extractFreeConsultant(text) {
      const normalized = String(text || '').toLowerCase();
      return /(tell me how you would fix|explain your strategy|diagnose first|provide solution before hire|audit first then hire)/i.test(
        normalized
      );
    },
    extractSilentHistory(text) {
      const normalized = String(text || '').toLowerCase();
      const jobs = normalized.match(/(\d+)\s+jobs?\s+posted/i);
      const hires = normalized.match(/(\d+)\s+hires?/i);
      const reviews = normalized.match(/(\d+)\s+reviews?/i);
      if (!jobs || !hires || !reviews) return false;
      const jobsCount = parseInt(jobs[1], 10);
      const hiresCount = parseInt(hires[1], 10);
      const reviewsCount = parseInt(reviews[1], 10);
      return jobsCount >= 8 && hiresCount >= 5 && reviewsCount <= 2;
    },
    extractExperienceLevel(text) {
      const normalized = String(text || '').toLowerCase();
      if (/\bexpert\b/.test(normalized)) return 'expert';
      if (/\bintermediate\b/.test(normalized)) return 'intermediate';
      if (/\bentry\b|entry level/.test(normalized)) return 'entry';
      return null;
    },
    extractBudgetMismatch(scopeText, descText) {
      const level = this.extractExperienceLevel(scopeText);
      if (level !== 'expert') return false;
      const normalized = String(descText || '').toLowerCase();
      const hourlyMatch = normalized.match(/\$([\d.,]+)\s*(\/hr|per hour)/i);
      const fixedMatch = normalized.match(/budget[^$\n]*\$\s*([\d.,]+)/i);
      const hourly = hourlyMatch ? parseFloat(hourlyMatch[1].replace(/,/g, '')) : null;
      const fixed = fixedMatch ? parseFloat(fixedMatch[1].replace(/,/g, '')) : null;
      const hasReliableBudget = hourly !== null || fixed !== null;
      if (!hasReliableBudget) return false;
      return (hourly !== null && hourly < 15) || (fixed !== null && fixed < 100);
    },
    extractClearBrief(text) {
      const normalized = String(text || '').toLowerCase();
      const hasDeliverables = /(deliverable|output|acceptance criteria|requirements|scope)/i.test(normalized);
      const hasDeadline = /(deadline|by\s+\w+\s+\d{1,2}|within\s+\d+\s+(day|week|month))/i.test(normalized);
      return hasDeliverables && hasDeadline && normalized.length >= 220;
    },
    extractMilestoneFriendly(text) {
      const normalized = String(text || '').toLowerCase();
      return /(milestone|phase 1|phase 2|payment per stage|paid per milestone|entrega por etapa)/i.test(
        normalized
      );
    },
        extractLowEffortTemplate(titleText, descriptionText) {
      const title = String(titleText || '').trim().toLowerCase();
      const description = String(descriptionText || '').trim().toLowerCase();
      return (
        title.startsWith('job title:') ||
        title.startsWith('project title:') ||
        title.startsWith('about the project:') ||
        description.startsWith('job title:') ||
        description.startsWith('project title:') ||
        description.startsWith('about the project:')
      );
    },    extractProfessionalTone(text) {
      const normalized = String(text || '').toLowerCase();
      const hasSpecificLanguage = /(requirements|deliverables|timeline|experience needed|tech stack)/i.test(
        normalized
      );
      const hasToxicUrgency = /(urgent!!!|asap only|must start now|guaranteed huge pay)/i.test(normalized);
      const hasOddPromise = /(easy money|no experience needed and high pay)/i.test(normalized);
      return hasSpecificLanguage && !hasToxicUrgency && !hasOddPromise;
    },
  };

  window.SniperExtractors = SniperExtractors;
})();
