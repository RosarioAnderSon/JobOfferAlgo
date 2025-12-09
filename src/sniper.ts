export type Grade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'F';

export type Badge =
  | 'Gold standard'
  | 'Fresh off the oven'
  | 'Whale client'
  | 'Elite hire rate'
  | 'Ojo'
  | 'Cheapskate'
  | 'Window shopper'
  | 'Toxic client'
  | 'Ghost job'
  | 'Crowded room'
  | 'Spammer'
  | 'SOS'
  | 'Tier 1 country'
  | 'Team builder'
  | 'Boost it!'
  | 'New client';

export interface JobInput {
  memberSince: Date;
  jobsPosted: number;
  paymentVerified: boolean;
  totalSpent: number;
  totalHires: number;
  jobTitle?: string;
  hasLowRecentReview?: boolean;
  /**
   * Optional explicit hire rate (%) if provided by the source.
   * If present, it overrides the computed (totalHires / jobsPosted) ratio for scoring.
   */
  hireRatePct?: number;
  rating: number;
  reviewsCount: number;
  proposalCount: number;
  descriptionText?: string;
  lastViewed: Date;
  invitesSent: number;
  /**
   * Pending invites (sent but not answered yet).
   * Needed to compute interviewing ratio accurately.
   */
  unansweredInvites?: number;
  interviewing: number;
  descriptionLength: number;
  clientCountry?: string;
  postedAt?: Date;
  jobBudget?: number;
  /**
   * Optional historical average hourly rate paid by the client.
   * Used for the Cheapskate badge/penalty.
   */
  avgHourlyPaid?: number;
  now?: Date;
}

export interface EvaluationResult {
  killSwitches: string[];
  baseScore: number;
  penaltiesApplied: { name: string; points: number }[];
  bonusesApplied: { name: string; points: number }[];
  finalScore: number;
  grade: Grade;
  badges: Badge[];
  componentScores: {
    hireRate: number;
    spend: number;
    rating: number;
    activity: number;
    proposals: number;
    payment: number;
    jobs: number;
  };
  totals: {
    penalties: number;
    bonuses: number;
  };
}

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round2 = (value: number) => Math.round(value * 100) / 100;

const monthsBetween = (from: Date, to: Date) => {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const days = to.getDate() - from.getDate();
  const total = years * 12 + months;
  return days < 0 ? total - 1 : total;
};

const daysSince = (date: Date, now: Date) =>
  (now.getTime() - date.getTime()) / MS_PER_DAY;

const hoursSince = (date: Date, now: Date) =>
  (now.getTime() - date.getTime()) / MS_PER_HOUR;

const hireRatePoints = (
  jobsPosted: number,
  totalHires: number,
  overridePct?: number
) => {
  if (jobsPosted === 0) return 85; // fallback
  const baseRate =
    overridePct !== undefined
      ? overridePct
      : (totalHires / jobsPosted) * 100;

  // v4.5 fine-tune: solo castigamos a los nuevos, NO premiamos a los viejos
  const multiplier = jobsPosted < 5 ? 0.9 : 1.0;

  const adjusted = baseRate * multiplier;

  if (adjusted >= 90) return 100;
  if (adjusted >= 70) return 85;
  if (adjusted >= 50) return 50;
  return 0;
};

const spendPoints = (
  totalSpent: number,
  totalHires: number,
  jobsPosted: number,
  jobBudget?: number
) => {
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

const ratingPoints = (rating: number, reviewsCount: number) => {
  if (rating < 4.4) return 0;
  if (reviewsCount < 3) return 80;
  if (rating >= 4.8) return 100;
  return 70;
};

const activityPoints = (lastViewed: Date, now: Date) => {
  const hours = hoursSince(lastViewed, now);
  if (hours < 1) return 100;
  if (hours < 3) return 80;
  if (hours < 24) return 70;
  if (hours < 48) return 60;
  return 0;
};

const proposalsPoints = (proposalCount: number) => {
  if (proposalCount < 5) return 100;
  if (proposalCount <= 10) return 85;
  if (proposalCount <= 20) return 60;
  if (proposalCount <= 50) return 30;
  return 0;
};

const paymentPoints = (paymentVerified: boolean) =>
  paymentVerified ? 100 : 0;

const jobsPostedPoints = (jobsPosted: number) => {
  if (jobsPosted >= 10) return 100;
  if (jobsPosted >= 1) return 80;
  return 50;
};

const gradeFromScore = (score: number): Grade => {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 80) return 'B';
  return 'F';
};

export const evaluateSniper = (input: JobInput): EvaluationResult => {
  const now = input.now ?? new Date();
  const addBadge = (list: Badge[], badge: Badge) => {
    if (!list.includes(badge)) list.push(badge);
  };
  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const urgencyText =
    (input.jobTitle ?? '') + ' ' + (input.descriptionText ?? '');
  const normalizedUrgencyText = normalizeText(urgencyText);
  const isUrgentRequest =
    normalizedUrgencyText.length > 0 &&
    ['urgency', 'urgent', 'emergency', 'urgencia', 'emergencia', 'urgente'].some(
      (kw) => normalizedUrgencyText.includes(kw)
    );

  const killSwitches: string[] = [];
  const monthsActive = monthsBetween(input.memberSince, now);
  const daysSinceViewed = daysSince(input.lastViewed, now);

  if (
    monthsActive < 5 &&
    (!input.paymentVerified || input.jobsPosted === 0)
  ) {
    killSwitches.push('Newbie risk');
  }

  if (daysSinceViewed > 2) {
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
    hireRate: hireRatePoints(
      input.jobsPosted,
      input.totalHires,
      input.hireRatePct
    ),
    spend: spendPoints(
      input.totalSpent,
      input.totalHires,
      input.jobsPosted,
      input.jobBudget
    ),
    rating: ratingPoints(input.rating, input.reviewsCount),
    activity: activityPoints(input.lastViewed, now),
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

  const penaltiesApplied: { name: string; points: number }[] = [];
  const bonusesApplied: { name: string; points: number }[] = [];

  const pushPenalty = (condition: boolean, name: string, points: number) => {
    if (condition) penaltiesApplied.push({ name, points });
  };

  const pushBonus = (
    condition: boolean,
    name: string,
    points: number,
    badge?: Badge
  ) => {
    if (condition) {
      bonusesApplied.push({ name, points });
      if (badge) addBadge(badges, badge);
    }
  };

  pushPenalty(
    input.invitesSent === 1 && input.interviewing === 1,
    'The Nepo-Hire',
    7.5
  );

  pushPenalty(
    input.invitesSent > 15 && !isUrgentRequest,
    'The Spammer',
    5
  );

  pushPenalty(
    !input.paymentVerified && input.jobsPosted > 1,
    'The Unverified Regular',
    5
  );

  pushPenalty(input.interviewing > 7, 'The Crowded Room', 2.5);

  const postedDays = input.postedAt ? daysSince(input.postedAt, now) : 0;
  pushPenalty(
    input.postedAt !== undefined && postedDays > 4 && input.interviewing === 0,
    'The Forever Looking',
    7.5
  );

  pushPenalty(input.descriptionLength < 100, 'Lazy Description', 2.5);

  const effectiveHireRatePct =
    input.hireRatePct !== undefined
      ? input.hireRatePct
      : input.jobsPosted > 0
        ? (input.totalHires / input.jobsPosted) * 100
        : 0;
  const avgPrice =
    input.totalHires > 0
      ? input.totalSpent / input.totalHires
      : input.totalSpent === 0 && input.jobsPosted < 3 && input.jobBudget
        ? input.jobBudget
        : 0;
  const postedRef = input.postedAt ?? input.lastViewed;
  const hoursFromPosted = hoursSince(postedRef, now);

  const badges: Badge[] = [];

  const isHourlyCheap =
    input.avgHourlyPaid !== undefined &&
    input.avgHourlyPaid > 0 &&
    input.avgHourlyPaid < 6;
  const isGlobalCheap = avgPrice < 100;
  if (isHourlyCheap || isGlobalCheap) {
    penaltiesApplied.push({ name: 'Cheapskate History', points: 10 });
    addBadge(badges, 'Cheapskate');
  }

  const windowShopperPenalty =
    effectiveHireRatePct < 65 && input.jobsPosted > 3;
  if (windowShopperPenalty) {
    penaltiesApplied.push({ name: 'Window shopper risk', points: 10 });
    addBadge(badges, 'Window shopper');
  }

  const isToxicClient = input.rating < 4.4;

  const lowRecentReviewPenalty = !!input.hasLowRecentReview && !isToxicClient;
  if (lowRecentReviewPenalty) {
    penaltiesApplied.push({ name: 'Ojo con los reviews', points: 5 });
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
  pushBonus(isTier1, 'Tier 1 country bonus', 2.5, 'Tier 1 country');

  const goldStandard =
    effectiveHireRatePct > 70 &&
    input.totalSpent > 10_000 &&
    input.rating > 4.8;
  pushBonus(goldStandard, 'Gold standard bonus', 5, 'Gold standard');

  pushBonus(
    effectiveHireRatePct >= 90,
    'Elite hire rate bonus',
    2.5,
    'Elite hire rate'
  );

  const isWhale = input.totalSpent >= 10_000 || avgPrice >= 1_000;
  pushBonus(isWhale, 'Whale client bonus', 2.5, 'Whale client');

  pushBonus(
    hoursFromPosted < 1,
    'Fresh off the oven bonus',
    2.5,
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

  if (hoursSince(input.lastViewed, now) > 48) {
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

