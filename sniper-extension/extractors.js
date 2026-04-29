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

  const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const getClientRatingText = (scope, sidebar) => {
    const roots = [sidebar, scope].filter(Boolean);
    const selectors = [
      '[data-testid="buyer-rating"]',
      '[data-test="client-rating"]',
      '[data-qa="client-rating"]',
      '.cfe-ui-job-about-client [data-testid="buyer-rating"]',
      '.cfe-ui-job-about-client .rating',
    ];

    for (const root of roots) {
      for (const selector of selectors) {
        const el = root.querySelector(selector);
        const text = normalizeText(el?.innerText || el?.textContent || '');
        if (text) return text;
      }
    }

    return '';
  };

  const extractClientRecentHistorySection = (scope) => {
    if (!scope) return null;
    const headingNodes = Array.from(scope.querySelectorAll('h2, h3, h4, h5, strong, span, div'));
    const heading = headingNodes.find((el) =>
      /client(?:['’`])?s recent history/i.test((el.textContent || '').trim())
    );
    if (!heading) return null;
    return (
      heading.closest('section, article, [data-test], .air3-card-section, .up-card-section') ||
      heading.parentElement ||
      null
    );
  };

  const extractPossibleClientNames = (scope) => {
    const MAX_CLIENT_NAMES = 5;
    const section = extractClientRecentHistorySection(scope);
    if (!section) return [];

    const itemNodes = Array.from(section.querySelectorAll('[data-cy="job"], .item'));
    const sourceItems = itemNodes.length ? itemNodes : [section];
    const freelancerNameSet = new Set();
    const freelancerFirstTokenSet = new Set();
    const blockedTokens = new Set([
      'he',
      'him',
      'his',
      'she',
      'her',
      'hers',
      'they',
      'them',
      'their',
      'theirs',
      'etc',
      'it',
    ]);
    const blockedPhrases = new Set([
      'the client',
      'client support',
      'upwork support',
      'payment verified',
    ]);
    const blockedTechnicalTokens = new Set([
      'api',
      'apis',
      'rest',
      'graphql',
      'firebase',
      'flutter',
      'backend',
      'frontend',
      'android',
      'ios',
      'sdk',
      'cti',
      'crm',
      'sql',
      'saas',
      'auth',
    ]);
    const blockedNameLikeWords = new Set([
      'straightforward',
      'simple',
      'quick',
      'professional',
      'friendly',
      'responsive',
      'clear',
      'amazing',
      'great',
      'good',
      'excellent',
      'easy',
    ]);
    const blockedFollowingNouns = new Set([
      'project',
      'task',
      'job',
      'work',
      'assignment',
      'role',
      'position',
      'request',
      'gig',
      'scope',
    ]);
    const nameToken = "[A-Z](?:[A-Za-z'-]*[A-Za-z])?|[A-Z]\\.";
    const nameCapture = `((?:${nameToken})(?:\\s+(?:${nameToken})){0,3})`;
    const nameBoundary = '(?=[\\s,.;:!?)]|$)';
    const patterns = [
      new RegExp(`\\b(?:[Ww]orking|[Ww]orked|[Ww]ork)\\s+[Ww]ith\\s+(?:(?:[Mm]r|[Mm]rs|[Mm]s|[Mm]iss|[Dd]r)\\.?\\s+)?${nameCapture}${nameBoundary}`, 'g'),
      new RegExp(`\\b(?:[Gg]reat|[Nn]ice|[Aa]wesome|[Ee]xcellent)\\s+[Ww]orking\\s+[Ww]ith\\s+(?:(?:[Mm]r|[Mm]rs|[Mm]s|[Mm]iss|[Dd]r)\\.?\\s+)?${nameCapture}${nameBoundary}`, 'g'),
      new RegExp(`\\b[Ii]t\\s+[Ww]as\\s+(?:[Rr]eally\\s+)?(?:[Gg]reat|[Nn]ice)\\s+[Ww]orking\\s+[Ww]ith\\s+(?:(?:[Mm]r|[Mm]rs|[Mm]s|[Mm]iss|[Dd]r)\\.?\\s+)?${nameCapture}${nameBoundary}`, 'g'),
      new RegExp(`\\b(?:[Ii]\\s+[Aa]m\\s+[A-Za-z\\s]{0,35}?(?:[Gg]lad|[Hh]appy)\\s+[Tt]o\\s+[Ww]ork|(?:[Ii]\\s+)?(?:[Ee]njoyed|[Ee]njoy)\\s+[Ww]orking|[Ii]t\\s+[Ww]as\\s+(?:[Ss]uch\\s+[Aa]\\s+)?[Pp]leasure\\s+[Ww]orking|[Ii]t\\s+[Ww]as\\s+(?:[Mm]y\\s+)?[Pp]leasure\\s+[Tt]o\\s+[Ww]ork)\\s+[Ww]ith\\s+(?:(?:[Mm]r|[Mm]rs|[Mm]s|[Mm]iss|[Dd]r)\\.?\\s+)?${nameCapture}${nameBoundary}`, 'g'),
      new RegExp(`\\b${nameCapture}\\s+(?:[Ii]s|[Ww]as)\\s+[A-Za-z\\s]{0,20}?[Tt]o\\s+[Ww]ork\\s+[Ww]ith\\b`, 'g'),
      new RegExp(`\\b${nameCapture}\\s+(?:[Ii]s|[Ww]as)\\s+[Oo]ne\\s+[Oo]f\\s+[Tt]he\\s+[Bb]est\\s+[Cc]lients?\\b`, 'g'),
      new RegExp(`\\b${nameCapture}\\s+(?:[Ii]s|[Ww]as)\\s+[Aa]n?\\s+(?:[Aa]mazing|[Ee]xcellent|[Gg]reat|[Gg]ood)\\s+[Cc]lient(?:\\s+[Tt]o\\s+[Ww]ork\\s+[Ww]ith)?\\b`, 'g'),
      new RegExp(`\\b[Tt]hanks[\\s,.-]+${nameCapture}${nameBoundary}`, 'g'),
      new RegExp(`\\b(?:[Cc]lient(?:\\s+[Nn]ame)?|[Cc]liente|[Nn]ombre\\s+del\\s+cliente)\\s*[:\\-]\\s*${nameCapture}${nameBoundary}`, 'g'),
    ];

    const normalizeCandidate = (value) =>
      String(value || '')
        .replace(/^[^A-Za-z]+|[^A-Za-z'. -]+$/g, '')
        .replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, '')
        .split(' ')
        .map((part) => part.replace(/[,:;!?]+$/g, ''))
        .join(' ')
        .replace(/\s+\b(?:to|and|or|but|with|for|from)\b$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanRecentHistoryItemText = (value) =>
      String(value || '')
        .split(/\r?\n/)
        .filter((line) => !/^\s*to freelancer\s*:/i.test(line))
        .join('\n');

    const registerFreelancerName = (value) => {
      const normalized = normalizeCandidate(value).toLowerCase();
      if (!normalized) return;
      freelancerNameSet.add(normalized);
      const firstToken = normalized.split(' ').filter(Boolean)[0];
      if (firstToken) freelancerFirstTokenSet.add(firstToken);
    };

    const collectFreelancerNamesFromText = (value) => {
      const text = normalizeText(value || '');
      if (!text) return;
      const regex =
        /\bto freelancer\s*:\s*([A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,2})/gi;
      let match;
      while ((match = regex.exec(text))) {
        registerFreelancerName(match[1]);
      }
    };

    for (const item of sourceItems) {
      collectFreelancerNamesFromText(item.innerText || item.textContent || '');
    }
    collectFreelancerNamesFromText(section.innerText || section.textContent || '');

    const isLikelyName = (value, contextText) => {
      if (!value) return false;
      const parts = value.split(' ').filter(Boolean);
      if (!parts.length || parts.length > 4) return false;
      if (!parts.every((part) => /^([A-Z](?:[A-Za-z'-]*[A-Za-z])?|[A-Z]\.)$/.test(part))) return false;
      if (parts.some((part) => blockedTokens.has(part.toLowerCase()))) return false;
      if (parts.some((part) => blockedTechnicalTokens.has(part.toLowerCase()))) return false;
      if (parts.some((part) => blockedNameLikeWords.has(part.toLowerCase()))) return false;
      if (parts.some((part) => /[0-9]/.test(part))) return false;
      if (parts.some((part) => /^[A-Z]{2,}\.?$/.test(part))) return false;
      if (parts.some((part) => !/[a-z]/.test(part))) return false;
      if (parts.some((part) => part[0] !== part[0].toUpperCase())) return false;
      if (parts.every((part) => part.length < 2)) return false;
      const joined = parts.join(' ').toLowerCase();
      if (blockedPhrases.has(joined)) return false;
      if (freelancerNameSet.has(joined)) return false;
      const firstToken = parts[0].toLowerCase();
      if (freelancerFirstTokenSet.has(firstToken)) return false;
      if (parts.length === 1 && contextText) {
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const afterTokenMatch = new RegExp(`\\b${escaped}\\b\\s+([A-Za-z]{3,})`, 'i').exec(contextText);
        if (afterTokenMatch) {
          const nextWord = String(afterTokenMatch[1] || '').toLowerCase();
          if (blockedFollowingNouns.has(nextWord)) return false;
        }
      }
      return true;
    };

    const addCandidate = (rawCandidate, contextText, target) => {
      const candidate = normalizeCandidate(rawCandidate);
      if (!isLikelyName(candidate, contextText)) return;
      const normalized = candidate.toLowerCase();
      if (target.some((name) => name.toLowerCase() === normalized)) return;
      target.push(candidate);
    };

    const found = [];
    for (const item of sourceItems) {
      if (found.length >= MAX_CLIENT_NAMES) break;
      const rawItemText = item.innerText || item.textContent || '';
      const itemText = normalizeText(cleanRecentHistoryItemText(rawItemText));
      if (!itemText) continue;

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(itemText)) && found.length < MAX_CLIENT_NAMES) {
          addCandidate(match[1], itemText, found);
        }
      }
    }

    return found.slice(0, MAX_CLIENT_NAMES);
  };

  const parseRelativeDate = (value, unit) => {
    const now = Date.now();
    const normalized = String(unit || '').toLowerCase();
    if (normalized.includes('minute')) return new Date(now - value * 60 * 1000);
    if (normalized.includes('hour')) return new Date(now - value * 60 * 60 * 1000);
    if (normalized.includes('day')) return new Date(now - value * 24 * 60 * 60 * 1000);
    if (normalized.includes('week')) return new Date(now - value * 7 * 24 * 60 * 60 * 1000);
    if (normalized.includes('month')) return new Date(now - value * 30 * 24 * 60 * 60 * 1000);
    return null;
  };

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
      const keywords = ['recent', 'history', 'feedback', 'review'];
      const pattern = /(?<![\d$])([0-5](?:\.\d{1,2})?)(?![\d%])/g;

      let match;
      while ((match = pattern.exec(normalized))) {
        const value = parseFloat(match[1]);
        if (Number.isNaN(value) || value > 3.2) continue;
        const windowText = normalized.slice(
          Math.max(0, match.index - 60),
          Math.min(normalized.length, match.index + 60)
        );
        const hasContext = keywords.some((kw) => windowText.includes(kw));
        if (hasContext) return true;
      }
      return false;
    },
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
    },
    extractLastViewed(text) {
      const match = text.match(/Last viewed by client:.*?(\d+)\s*(minute|hour|day)s?\s*ago/is);
      if (!match) return new Date();
      const value = parseInt(match[1], 10);
      return parseRelativeDate(value, match[2]) || new Date();
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
    extractProfessionalTone(text) {
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
