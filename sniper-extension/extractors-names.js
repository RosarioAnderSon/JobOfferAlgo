(() => {
  'use strict';

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


  window.SniperExtractorNames = {
    normalizeText,
    getClientRatingText,
    extractPossibleClientNames,
    parseRelativeDate,
  };
})();
