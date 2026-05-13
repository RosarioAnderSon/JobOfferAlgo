(() => {
  'use strict';
  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;

  UpworkSniperExtension.prototype.getBadgeConfig = function(badge, rawData = null) {
    const configs = typeof window.SniperBadgeDefinitions === 'function'
      ? window.SniperBadgeDefinitions.call(this, this, rawData)
      : {};
      const normalizeBadgeKey = (value) =>
        String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s$+.-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      const canonicalMap = {};
      Object.keys(configs).forEach((name) => {
        canonicalMap[normalizeBadgeKey(name)] = name;
      });
      canonicalMap['off platform request'] = 'Off-platform request';
      canonicalMap['off platform contact request'] = 'Off-platform request';
      canonicalMap['first job $2k+ scam risk'] = 'First Job $2K+ Scam Risk';
      canonicalMap['first-job $2k+ scam risk'] = 'First Job $2K+ Scam Risk';
      canonicalMap['poco esfuerzo'] = 'Poco esfuerzo';

      const sourceBadge = String(badge || '').trim();
      const sourceNormalized = normalizeBadgeKey(sourceBadge);
      const resolvedBadge = canonicalMap[sourceNormalized] || sourceBadge;
      const mappedByAlias = resolvedBadge !== sourceBadge;
      const isUnknownBadge = !configs[resolvedBadge];

      if (resolvedBadge === 'Possible client names') {
        const names = Array.isArray(rawData?.possibleClientNames)
          ? rawData.possibleClientNames
            .filter((name) => typeof name === 'string' && name.trim().length > 0)
            .slice(0, 5)
          : [];
        if (names.length > 0) {
          configs['Possible client names'].description = this.t('possibleNamesDetected').replace('{names}', names.join(', '));
        }
      }
      if (resolvedBadge === 'Niche Avg/hr') {
        const supportBadge = rawData?.supportAvgBadge || null;
        const matches = Array.isArray(supportBadge?.matches) ? supportBadge.matches : [];
        const matchesText = matches
          .slice(0, 5)
          .map((entry, index) => `${index + 1}) ${entry.title} — $${Number(entry.rate).toFixed(2)}/hr`)
          .join('\n');
        configs['Niche Avg/hr'].description = matchesText || this.t('supportAvgUnavailable');
      }
      if (resolvedBadge === 'Skills match') {
        const match = rawData?.skillsMatch || null;
        if (!match || !match.profileSkillsLoaded) {
          configs['Skills match'].description = this.t('skillsNeedProfile');
        } else {
          const matchedList = Array.isArray(match.matchedSkills) ? match.matchedSkills : [];
          const missingList = Array.isArray(match.missingSkills) ? match.missingSkills : [];
          const matchedText = matchedList.length ? matchedList.join(', ') : '';
          const missingText = missingList.length ? missingList.join(', ') : '';
          configs['Skills match'].description = this.language === 'es'
            ? `Match ${matchedList.length}: ${matchedText}\nFaltan ${missingList.length}: ${missingText}`
            : `Match ${matchedList.length}: ${matchedText}\nMissing ${missingList.length}: ${missingText}`;
        }
      }
      const selected = configs[resolvedBadge] || { icon: '\u25B9', type: 'neutral', description: sourceBadge };
      if (this.language === 'en') {
        const enDescriptions = {
          'Gold standard': 'Top signal: strong hire rate, >$10k spent and 4.8+ rating',
          'Whale client': 'Strong budget: >$10k total or >$1k per hire',
          Sociable: 'Interviews a lot and hires reliably',
          'Elite hire rate': 'Hire rate is 90% or higher',
          'Fresh off the oven': 'Posted less than 1 hour ago',
          'Tier 1 country': 'Client is from a Tier 1 market',
          'Window shopper': 'Low hire rate with multiple posts',
          Cheapskate: 'Low average pay history',
          'Ghost job': 'Not viewed in 48h and no active interviews',
          'Dead post': 'Old post, high proposals, no interviews',
          Shortlisting: 'Client paused but still interviewing',
          'Stagnant job': 'No metric changes for 7+ days',
          'New client': 'New client with little history',
          'Team builder': 'Often hires multiple freelancers per post',
          'Boost it!': 'Good job but crowded. Boost can help.',
          'Toxic client': 'Client has low feedback quality or very short review history.',
          'Crowded room': 'More than 7 interviewing',
          Spammer: 'More than 15 invites sent',
          SOS: 'Urgent hiring signals detected',
          'Time Waster': 'High interview ratio but low conversion',
          Complot: 'High proposals and odd interview/invite pattern',
          Ojo: 'Recent ratings the client gave freelancers include values of 4.0/5 or lower.',
          'First Job $2K+ Scam Risk': 'New unverified client with no history and a first job budget above $2k.',
          'Data Harvesting': 'Possible data-harvest or scam pattern',
          'Perpetual Posting': 'Open for over 7 days with low urgency',
          'Serial Poster': 'Many posts, low hire rate',
          'Off-platform request': 'Requests communication outside Upwork',
          'External payment risk': 'Requests external payments or risky methods',
          'Free work request': 'Requests unpaid sample or free work',
          'Too good to be true': 'Very high pay for simple task and weak history',
          'Scope Monster': 'Requests too many disciplines in one job; higher scope-creep risk.',
          'Free Consultant': 'Asks for detailed strategy before hiring; unpaid work risk.',
          'Silent History': 'Shows activity but little visible feedback to validate quality.',
          'Budget Mismatch': 'Expert-level ask with weak budget signals; lower fit quality.',
          'Clear Brief': 'Defines deliverables and timeline; reduces ambiguity.',
          'Milestone Friendly': 'Accepts phased delivery or staged payments; lower execution risk.',
          'Professional Tone': 'Specific and professional request, usually easier to execute well.',
          'Niche Avg/hr': 'Niche hourly position vs feed benchmark (informational).',
        };
        if (enDescriptions[resolvedBadge]) {
          selected.description = enDescriptions[resolvedBadge];
        }
      }
      selected._badgeMeta = {
        sourceBadge,
        resolvedBadge,
        mappedByAlias,
        unknown: isUnknownBadge,
      };
      return selected;
  };
})();
