(() => {
  'use strict';

  const shared = window.SniperCoreShared;
  if (!shared) return;

  const {
    clamp,
    round2,
    monthsBetween,
    daysSince,
    hoursSince,
    hireRatePoints,
    spendPoints,
    ratingPoints,
    activityPoints,
    proposalsPoints,
    paymentPoints,
    jobsPostedPoints,
    gradeFromScore,
    LOW_REVIEW_TOXIC_THRESHOLD,
  } = shared;

  const evaluateSniper = (input) => {
    const now = input.now ?? new Date();
    const addBadge = (list, badge) => {
      if (!list.includes(badge)) list.push(badge);
    };
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
    const monthsActive = monthsBetween(input.memberSince, now);
    const lastViewedDate =
      input.lastViewed instanceof Date && !Number.isNaN(input.lastViewed.getTime())
        ? input.lastViewed
        : null;
    const daysSinceViewed = lastViewedDate ? daysSince(lastViewedDate, now) : null;

    const isNewbieRisk =
      monthsActive < 3 &&
      !input.paymentVerified &&
      input.jobsPosted === 0 &&
      input.totalSpent === 0 &&
      (input.descriptionLength ?? 0) < 80;
    if (isNewbieRisk) {
      killSwitches.push('Newbie risk');
    }

    const interviewingCount = input.interviewing ?? 0;
    const isGhostJob = daysSinceViewed !== null && daysSinceViewed > 2 && interviewingCount === 0;
    if (isGhostJob) {
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

    if (killSwitches.length > 0) {
      return {
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
        totals: {
          penalties: 0,
          bonuses: 0,
        },
      };
    }

    const componentScores = {
      hireRate: hireRatePoints(input.jobsPosted, input.totalHires, input.hireRatePct),
      spend: spendPoints(input.totalSpent, input.totalHires, input.jobsPosted, input.jobBudget),
      rating: ratingPoints(input.rating, input.reviewsCount),
      activity: activityPoints(input, now),
      proposals: proposalsPoints(input.proposalCount),
      payment: paymentPoints(input.paymentVerified),
      jobs: jobsPostedPoints(input.jobsPosted),
    };

    const baseScore =
      componentScores.hireRate * 0.3 +
      componentScores.spend * 0.25 +
      componentScores.rating * 0.15 +
      componentScores.activity * 0.1 +
      componentScores.proposals * 0.1 +
      componentScores.payment * 0.05 +
      componentScores.jobs * 0.05;

    const penaltiesApplied = [];
    const bonusesApplied = [];
    const pushPenalty = (condition, name, points) => {
      if (condition) penaltiesApplied.push({ name, points });
    };
    const pushBonus = (condition, name, points, badge) => {
      if (condition) {
        bonusesApplied.push({ name, points });
        if (badge) addBadge(badges, badge);
      }
    };

    pushPenalty(input.invitesSent === 1 && input.interviewing === 1, 'The Nepo-Hire', 1);
    pushPenalty(input.invitesSent > 15 && !isUrgentRequest, 'The Spammer', 1);
    pushPenalty(!input.paymentVerified && input.jobsPosted > 1, 'The Unverified Regular', 1);
    pushPenalty(input.interviewing > 7, 'The Crowded Room', 1);

    const postedDays = input.postedAt ? daysSince(input.postedAt, now) : 0;
    pushPenalty(
      input.postedAt !== undefined && postedDays > 4 && input.interviewing === 0,
      'The Forever Looking',
      1
    );

    const isDeadPost =
      input.postedAt !== undefined &&
      postedDays >= 2 &&
      input.interviewing === 0 &&
      input.proposalCount >= 50;
    pushPenalty(isDeadPost, 'Dead post (stale & crowded)', 1);
    pushPenalty(input.descriptionLength < 100, 'Lazy Description', 1);
    pushPenalty(!!input.hasOffPlatformContact, 'Off-platform contact request', 2);
    pushPenalty(!!input.hasFreeWorkRequest, 'Free work request', 2);
    pushPenalty(!!input.hasExternalPaymentRequest, 'External payment risk', 2);
    pushPenalty(!!input.hasScopeMonster, 'Scope Monster', 1);
    pushPenalty(!!input.hasFreeConsultant, 'Free Consultant', 1);
    pushPenalty(!!input.hasSilentHistory, 'Silent History', 1);
    pushPenalty(!!input.hasBudgetMismatch, 'Budget Mismatch', 1);
    pushPenalty(!!input.hasHighBudgetNewClientScam, 'First-job $2k+ scam risk', 2);

    const effectiveHireRatePct =
      input.hireRatePct !== undefined
        ? input.hireRatePct
        : input.jobsPosted > 0
          ? (input.totalHires / input.jobsPosted) * 100
          : 0;
    const proposalsBase = input.proposalCount ?? 0;
    const invites = input.invitesSent ?? 0;
    const unanswered = input.unansweredInvites ?? 0;
    const effectivePool = Math.max(0, proposalsBase + invites - unanswered);
    const interviewingRatio = effectivePool > 0 ? interviewingCount / effectivePool : 0;
    const monthsSinceJoin = monthsActive;
    const avgPrice =
      input.totalHires > 0
        ? input.totalSpent / input.totalHires
        : input.totalSpent === 0 && input.jobsPosted < 3 && input.jobBudget
          ? input.jobBudget
          : 0;
    const postedRef = input.postedAt ?? input.lastViewed;
    const hoursFromPosted = hoursSince(postedRef, now);

    if (isDeadPost) {
      addBadge(badges, 'Dead post');
    }

    const isShortlisting = daysSinceViewed !== null && daysSinceViewed > 2 && interviewingCount > 0;
    if (isShortlisting) {
      pushPenalty(true, 'Paused/Shortlisting', 0.5);
      addBadge(badges, 'Shortlisting');
    }

    const stagnantDays = input.stagnantDays ?? 0;
    const isStagnantJob = stagnantDays >= 7 && interviewingCount === 0;
    if (isStagnantJob) {
      pushPenalty(true, 'Stagnant job (no changes in 7+ days)', 1);
      addBadge(badges, 'Stagnant job');
    }

    const isPerpetualPosting = input.postedAt !== undefined && postedDays > 7;
    pushPenalty(isPerpetualPosting, 'Perpetual Posting', 1);
    if (isPerpetualPosting) addBadge(badges, 'Perpetual Posting');

    const isComplot =
      (input.proposalCount ?? 0) >= 20 &&
      (input.interviewing ?? 0) === 1 &&
      (input.invitesSent ?? 0) === 0;
    pushPenalty(isComplot, 'Complot', 1);
    if (isComplot) addBadge(badges, 'Complot');

    const hireRateByJobs = input.jobsPosted > 0 ? (input.totalHires / input.jobsPosted) * 100 : 100;
    const isSerialPoster = input.jobsPosted >= 5 && hireRateByJobs < 30;
    pushPenalty(isSerialPoster, 'Serial Poster', 1);
    if (isSerialPoster) addBadge(badges, 'Serial Poster');

    if (interviewingRatio > 0.35 && effectiveHireRatePct >= 80 && input.rating >= 4.8) {
      pushBonus(true, 'Sociable', 1, 'Sociable');
    } else if (input.totalHires <= 1 && interviewingRatio > 0.35 && effectiveHireRatePct < 25 && monthsSinceJoin < 6) {
      pushPenalty(true, 'Data Harvesting', 1);
      addBadge(badges, 'Data Harvesting');
    } else if (interviewingRatio > 0.4 && effectiveHireRatePct >= 35 && effectiveHireRatePct < 50) {
      pushPenalty(true, 'Time Waster', 1);
      addBadge(badges, 'Time Waster');
    }

    const isHourlyCheap = input.avgHourlyPaid !== undefined && input.avgHourlyPaid > 0 && input.avgHourlyPaid < 6;
    const isGlobalCheap = avgPrice < 100;
    if (isHourlyCheap || isGlobalCheap) {
      penaltiesApplied.push({ name: 'Cheapskate History', points: 1 });
      addBadge(badges, 'Cheapskate');
    }

    const windowShopperPenalty = effectiveHireRatePct < 65 && input.jobsPosted > 3;
    if (windowShopperPenalty) {
      penaltiesApplied.push({ name: 'Window shopper risk', points: 1 });
      addBadge(badges, 'Window shopper');
    }

    const hasClientRating = Number.isFinite(input.rating) && input.rating > 0;
    const hasLowReviewCount =
      Number.isFinite(input.reviewsCount) &&
      input.reviewsCount > 0 &&
      input.reviewsCount <= LOW_REVIEW_TOXIC_THRESHOLD;
    const isToxicClient = (hasClientRating && input.rating < 4.0) || hasLowReviewCount;
    if (input.hasLowRecentReview && !isToxicClient) {
      penaltiesApplied.push({ name: 'Ojo con los reviews', points: 1 });
      addBadge(badges, 'Ojo');
    }

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
    const isTier1 =
      !!input.clientCountry &&
      tier1Countries.some((c) => input.clientCountry?.toLowerCase().includes(c.toLowerCase()));
    pushBonus(isTier1, 'Tier 1 country bonus', 1, 'Tier 1 country');

    const goldStandard = effectiveHireRatePct > 70 && input.totalSpent > 10_000 && input.rating > 4.8;
    pushBonus(goldStandard, 'Gold standard bonus', 1, 'Gold standard');
    pushBonus(
      effectiveHireRatePct >= 90 && (input.jobsPosted >= 5 || input.totalHires >= 3),
      'Elite hire rate bonus',
      1,
      'Elite hire rate'
    );

    const isWhale = input.totalSpent >= 10_000 || avgPrice >= 1_000;
    pushBonus(isWhale, 'Whale client bonus', 1, 'Whale client');
    pushBonus(hoursFromPosted < 1, 'Fresh off the oven bonus', 1, 'Fresh off the oven');
    pushBonus(!!input.hasClearBrief, 'Clear Brief bonus', 1, 'Clear Brief');
    pushBonus(!!input.hasMilestoneFriendly, 'Milestone Friendly bonus', 1, 'Milestone Friendly');
    pushBonus(!!input.hasProfessionalTone, 'Professional Tone bonus', 1, 'Professional Tone');

    const teamBuilder = input.jobsPosted > 0 && input.totalHires / input.jobsPosted > 1.5;
    if (teamBuilder) addBadge(badges, 'Team builder');
    if (input.isTooGoodToBeTrue) {
      penaltiesApplied.push({ name: 'Too good to be true', points: 1.5 });
      addBadge(badges, 'Too good to be true');
    }
    if (input.hasHighBudgetNewClientScam) {
      addBadge(badges, 'First Job $2K+ Scam Risk');
    }

    const penalties = penaltiesApplied.reduce((acc, p) => acc + p.points, 0);
    const bonusPoints = bonusesApplied.reduce((acc, p) => acc + p.points, 0);
    const tempScore = baseScore + bonusPoints - penalties;
    if (tempScore >= 85 && input.proposalCount >= 10) {
      addBadge(badges, 'Boost it!');
    }

    const finalScore = clamp(round2(tempScore), 0, 100);
    const grade = gradeFromScore(finalScore);

    if (isToxicClient) addBadge(badges, 'Toxic client');
    if (lastViewedDate && hoursSince(lastViewedDate, now) > 48 && interviewingCount === 0) {
      addBadge(badges, 'Ghost job');
    }
    if (input.interviewing > 7) {
      addBadge(badges, 'Crowded room');
    }
    if (isUrgentRequest) {
      addBadge(badges, 'SOS');
    }
    if (input.invitesSent > 15) {
      if (isUrgentRequest) {
        addBadge(badges, 'SOS');
      } else {
        addBadge(badges, 'Spammer');
      }
    }
    if (input.jobsPosted === 0 && !killSwitches.includes('Newbie risk')) {
      addBadge(badges, 'New client');
    }
    if (input.hasOffPlatformContact) {
      addBadge(badges, 'Off-platform request');
    }
    if (input.hasExternalPaymentRequest) {
      addBadge(badges, 'External payment risk');
    }
    if (input.hasFreeWorkRequest) {
      addBadge(badges, 'Free work request');
    }
    if (Array.isArray(input.possibleClientNames) && input.possibleClientNames.length > 0) {
      addBadge(badges, 'Possible client names');
    }
    if (input.hasScopeMonster) addBadge(badges, 'Scope Monster');
    if (input.hasFreeConsultant) addBadge(badges, 'Free Consultant');
    if (input.hasSilentHistory) addBadge(badges, 'Silent History');
    if (input.hasBudgetMismatch) addBadge(badges, 'Budget Mismatch');

    return {
      killSwitches,
      baseScore: round2(baseScore),
      penaltiesApplied,
      bonusesApplied,
      finalScore,
      grade,
      badges,
      componentScores,
      totals: {
        penalties,
        bonuses: bonusPoints,
      },
    };
  };

  window.SniperCoreEvaluate = evaluateSniper;
})();
