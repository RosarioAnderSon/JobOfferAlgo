(() => {
  'use strict';

  window.SniperCorePreflight = {
    evaluate(input, now, helpers, addBadge) {
      const normalizeText = (value) =>
        String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      const urgencyText = `${input.jobTitle || ''} ${input.descriptionText || ''}`;
      const normalizedUrgencyText = normalizeText(urgencyText);
      const isUrgentRequest =
        normalizedUrgencyText.length > 0 &&
        ['urgency', 'urgent', 'emergency', 'urgencia', 'emergencia', 'urgente'].some((kw) =>
          normalizedUrgencyText.includes(kw)
        );
      const killSwitches = [];
      const badges = [];
      const monthsActive = helpers.monthsBetween(input.memberSince, now);
      const lastViewedDate =
        input.lastViewed instanceof Date && !Number.isNaN(input.lastViewed.getTime())
          ? input.lastViewed
          : null;
      const daysSinceViewed = lastViewedDate ? helpers.daysSince(lastViewedDate, now) : null;
      const interviewingCount = input.interviewing ?? 0;

      if (
        monthsActive < 3 &&
        !input.paymentVerified &&
        input.jobsPosted === 0 &&
        input.totalSpent === 0 &&
        (input.descriptionLength ?? 0) < 80
      ) {
        killSwitches.push('Newbie risk');
      }
      if (daysSinceViewed !== null && daysSinceViewed > 2 && interviewingCount === 0) {
        killSwitches.push('Ghost job');
      }
      if (!input.paymentVerified && input.totalSpent === 0) {
        killSwitches.push('Unverified & broke');
      }
      if (input.hasJobNoLongerAvailable) {
        killSwitches.push('Job no longer available');
      }
      if (input.hasHighBudgetNewClientScam) {
        killSwitches.push('First-job $2k+ scam risk');
        addBadge(badges, 'First Job $2K+ Scam Risk');
      }
      if (killSwitches.length === 0) {
        return {
          badges,
          daysSinceViewed,
          interviewingCount,
          isUrgentRequest,
          killSwitches,
          killResult: null,
          monthsActive
        };
      }
      return {
        badges,
        daysSinceViewed,
        interviewingCount,
        isUrgentRequest,
        monthsActive,
        killResult: {
          killSwitches,
          baseScore: 0,
          penaltiesApplied: [],
          bonusesApplied: [],
          finalScore: 0,
          grade: 'F',
          badges,
          componentScores: {
            hireRate: 0,
            spend: 0,
            rating: 0,
            activity: 0,
            proposals: 0,
            payment: 0,
            jobs: 0,
          },
          totals: { penalties: 0, bonuses: 0 },
        },
      };
    },
  };
})();
