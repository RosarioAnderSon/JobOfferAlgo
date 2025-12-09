(() => {
  'use strict';

  const MS_PER_DAY = 86_400_000;
  const MS_PER_HOUR = 3_600_000;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round2 = (value) => Math.round(value * 100) / 100;

  const monthsBetween = (from, to) => {
    if (!(from instanceof Date) || Number.isNaN(from.getTime())) return 12; // asume viejo para no matar por novato
    const years = to.getFullYear() - from.getFullYear();
    const months = to.getMonth() - from.getMonth();
    const days = to.getDate() - from.getDate();
    const total = years * 12 + months;
    return days < 0 ? total - 1 : total;
  };

  const daysSince = (date, now) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return Infinity;
    return (now.getTime() - date.getTime()) / MS_PER_DAY;
  };
  const hoursSince = (date, now) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return Infinity;
    return (now.getTime() - date.getTime()) / MS_PER_HOUR;
  };

  const hireRatePoints = (jobsPosted, totalHires, overridePct) => {
    if (jobsPosted === 0) return 85;
    const baseRate =
      overridePct !== undefined ? overridePct : (totalHires / jobsPosted) * 100;

    // v4.5 fine-tune: solo castigamos a los nuevos, NO premiamos a los viejos
    const multiplier = jobsPosted < 5 ? 0.9 : 1.0;

    const adjusted = baseRate * multiplier;

    if (adjusted >= 90) return 100;
    if (adjusted >= 70) return 85;
    if (adjusted >= 50) return 50;
    return 0;
  };

  const spendPoints = (totalSpent, totalHires, jobsPosted, jobBudget) => {
    const avgPrice =
      totalHires > 0
        ? totalSpent / totalHires
        : totalSpent === 0 && jobsPosted < 3 && jobBudget
          ? jobBudget
          : 0;
    if (avgPrice >= 1000) return 100;
    if (avgPrice >= 500) return 90;
    if (avgPrice >= 200) return 75;
    if (avgPrice > 0) return 20;
    return 0;
  };

  const ratingPoints = (rating, reviewsCount) => {
    if (rating < 4.4) return 0;
    if (reviewsCount < 3) return 80;
    if (rating >= 4.8) return 100;
    return 70;
  };

  const activityPoints = (input, now) => {
    const hasInteraction =
      (input.interviewing ?? 0) > 0 ||
      (input.lastViewed instanceof Date &&
        !Number.isNaN(input.lastViewed.getTime()) &&
        hoursSince(input.lastViewed, now) <= 24);

    const postedHours =
      input.postedAt instanceof Date && !Number.isNaN(input.postedAt.getTime())
        ? hoursSince(input.postedAt, now)
        : Infinity;

    // Primeras 12h: con interacción A, sin interacción B
    if (postedHours < 12) {
      return hasInteraction ? 100 : 85;
    }

    // Primeras 24h: con o sin interacción = B (si no hay señal, no castigamos a F aún)
    if (postedHours < 24) {
      return hasInteraction ? 85 : 85;
    }

    // 24h+: con interacción = B; sin interacción = F
    if (hasInteraction) return 85;
    return 0;
  };

  const proposalsPoints = (proposalCount) => {
    if (proposalCount < 5) return 100; // A
    if (proposalCount <= 10) return 85; // B
    if (proposalCount <= 15) return 70; // C
    if (proposalCount <= 50) return 0; // F
    return 0;
  };

  const paymentPoints = (paymentVerified) => (paymentVerified ? 100 : 0);

  const jobsPostedPoints = (jobsPosted) => {
    if (jobsPosted >= 10) return 100;
    if (jobsPosted >= 1) return 80;
    return 50;
  };

  const gradeFromScore = (score) => {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 80) return 'B';
    return 'F';
  };

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
      ['urgency', 'urgent', 'emergency', 'urgencia', 'emergencia', 'urgente'].some(
        (kw) => normalizedUrgencyText.includes(kw)
      );

    const killSwitches = [];
    const monthsActive = monthsBetween(input.memberSince, now);
    const lastViewedDate =
      input.lastViewed instanceof Date && !Number.isNaN(input.lastViewed.getTime())
        ? input.lastViewed
        : null;
    const daysSinceViewed = lastViewedDate ? daysSince(lastViewedDate, now) : null;

    if (
      monthsActive < 5 &&
      (!input.paymentVerified || input.jobsPosted === 0)
    ) {
      killSwitches.push('Newbie risk');
    }

    if (daysSinceViewed !== null && daysSinceViewed > 2) {
      killSwitches.push('Ghost job');
    }

    if (!input.paymentVerified && input.totalSpent === 0) {
      killSwitches.push('Unverified & broke');
    }

    if (killSwitches.length > 0) {
      return {
        killSwitches,
        baseScore: 0,
        penaltiesApplied: [],
        bonusesApplied: [],
        finalScore: 0,
        grade: 'F',
        badges: [],
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
      spend: spendPoints(
        input.totalSpent,
        input.totalHires,
        input.jobsPosted,
        input.jobBudget
      ),
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

    pushPenalty(
      input.invitesSent === 1 && input.interviewing === 1,
      'The Nepo-Hire',
      1
    );

    pushPenalty(
      input.invitesSent > 15 && !isUrgentRequest,
      'The Spammer',
      1
    );

    pushPenalty(
      !input.paymentVerified && input.jobsPosted > 1,
      'The Unverified Regular',
      1
    );

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

    const effectiveHireRatePct =
      input.hireRatePct !== undefined
        ? input.hireRatePct
        : input.jobsPosted > 0
          ? (input.totalHires / input.jobsPosted) * 100
          : 0;
    const proposalsBase = input.proposalCount ?? 0;
    const invites = input.invitesSent ?? 0;
    const unanswered = input.unansweredInvites ?? 0;
    const interviewingCount = input.interviewing ?? 0;
    const effectivePool = Math.max(
      0,
      proposalsBase + invites - unanswered
    );
    const interviewingRatio =
      effectivePool > 0 ? interviewingCount / effectivePool : 0;
    const monthsSinceJoin = monthsActive;
    const avgPrice =
      input.totalHires > 0
        ? input.totalSpent / input.totalHires
        : input.totalSpent === 0 && input.jobsPosted < 3 && input.jobBudget
          ? input.jobBudget
          : 0;
    const postedRef = input.postedAt ?? input.lastViewed;
    const hoursFromPosted = hoursSince(postedRef, now);

    const badges = [];

    if (isDeadPost) {
      addBadge(badges, 'Dead post');
    }

    const isPerpetualPosting =
      input.postedAt !== undefined && postedDays > 7;
    pushPenalty(isPerpetualPosting, 'Perpetual Posting', 1);
    if (isPerpetualPosting) addBadge(badges, 'Perpetual Posting');

    const isComplot =
      (input.proposalCount ?? 0) >= 20 &&
      (input.interviewing ?? 0) === 1 &&
      (input.invitesSent ?? 0) === 0;
    pushPenalty(isComplot, 'Complot', 1);
    if (isComplot) addBadge(badges, 'Complot');

    const hireRateByJobs =
      input.jobsPosted > 0 ? (input.totalHires / input.jobsPosted) * 100 : 100;
    const isSerialPoster = input.jobsPosted >= 5 && hireRateByJobs < 30;
    pushPenalty(isSerialPoster, 'Serial Poster', 1);
    if (isSerialPoster) addBadge(badges, 'Serial Poster');

    // Client behavior flags (mutually exclusive). Data Harvesting tiene prioridad sobre Time Waster.
    if (
      interviewingRatio > 0.35 &&
      effectiveHireRatePct >= 80 &&
      input.rating >= 4.8
    ) {
      pushBonus(true, 'Sociable', 1, 'Sociable');
    } else if (
      input.totalHires <= 1 &&
      interviewingRatio > 0.35 &&
      effectiveHireRatePct < 25 &&
      monthsSinceJoin < 6
    ) {
      pushPenalty(true, 'Data Harvesting', 1);
      addBadge(badges, 'Data Harvesting');
    } else if (
      interviewingRatio > 0.4 &&
      effectiveHireRatePct >= 35 &&
      effectiveHireRatePct < 50
    ) {
      pushPenalty(true, 'Time Waster', 1);
      addBadge(badges, 'Time Waster');
    }

    const isHourlyCheap =
      input.avgHourlyPaid !== undefined &&
      input.avgHourlyPaid > 0 &&
      input.avgHourlyPaid < 6;
    const isGlobalCheap = avgPrice < 100;
    if (isHourlyCheap || isGlobalCheap) {
      penaltiesApplied.push({ name: 'Cheapskate History', points: 1 });
      addBadge(badges, 'Cheapskate');
    }

    const windowShopperPenalty =
      effectiveHireRatePct < 65 && input.jobsPosted > 3;
    if (windowShopperPenalty) {
      penaltiesApplied.push({ name: 'Window shopper risk', points: 1 });
      addBadge(badges, 'Window shopper');
    }

    const isToxicClient = input.rating < 4.4;

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
      tier1Countries.some((c) =>
        input.clientCountry?.toLowerCase().includes(c.toLowerCase())
      );
    pushBonus(isTier1, 'Tier 1 country bonus', 1, 'Tier 1 country');

    const goldStandard =
      effectiveHireRatePct > 70 &&
      input.totalSpent > 10_000 &&
      input.rating > 4.8;
    pushBonus(goldStandard, 'Gold standard bonus', 1, 'Gold standard');

    pushBonus(
      effectiveHireRatePct >= 90,
      'Elite hire rate bonus',
      1,
      'Elite hire rate'
    );

    const isWhale = input.totalSpent >= 10_000 || avgPrice >= 1_000;
    pushBonus(isWhale, 'Whale client bonus', 1, 'Whale client');

    pushBonus(
      hoursFromPosted < 1,
      'Fresh off the oven bonus',
      1,
      'Fresh off the oven'
    );

    const teamBuilder =
      input.jobsPosted > 0 && input.totalHires / input.jobsPosted > 1.5;
    if (teamBuilder) addBadge(badges, 'Team builder');

    const penalties = penaltiesApplied.reduce((acc, p) => acc + p.points, 0);
    const bonusPoints = bonusesApplied.reduce((acc, p) => acc + p.points, 0);
    const tempScore = baseScore + bonusPoints - penalties;
    if (tempScore >= 85 && input.proposalCount >= 10) {
      addBadge(badges, 'Boost it!');
    }

    const finalScore = clamp(round2(tempScore), 0, 100);
    const grade = gradeFromScore(finalScore);

    if (isToxicClient) addBadge(badges, 'Toxic client');

    if (lastViewedDate && hoursSince(lastViewedDate, now) > 48) {
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

  const api = { evaluateSniper };
  const root =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
        ? window
        : typeof self !== 'undefined'
          ? self
          : this;

  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = api;
  }

  if (root) {
    root.evaluateSniper = evaluateSniper;
  }
})();

