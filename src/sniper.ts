import type { Badge, EvaluationResult, JobInput } from './sniper-types';
import {
  LOW_REVIEW_TOXIC_THRESHOLD,
  activityPoints,
  clamp,
  daysSince,
  gradeFromScore,
  hireRatePoints,
  hoursSince,
  isValidDate,
  jobsPostedPoints,
  monthsBetween,
  paymentPoints,
  proposalsPoints,
  ratingPoints,
  round2,
  spendPoints,
} from './sniper-helpers';
import { addFinalBadges } from './sniper-post-badges';
export type { Badge, EvaluationResult, Grade, JobInput } from './sniper-types';
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
  const lastViewedDate = isValidDate(input.lastViewed) ? input.lastViewed : null;
  const daysSinceViewed = lastViewedDate ? daysSince(lastViewedDate, now) : null;
  const isNewbieRisk =
    monthsActive < 3 &&
    !input.paymentVerified &&
    input.jobsPosted === 0 &&
    input.totalSpent === 0 &&
    input.descriptionLength < 80;
  if (isNewbieRisk) {
    killSwitches.push('Newbie risk');
  }
  if (daysSinceViewed !== null && daysSinceViewed > 2 && input.interviewing === 0) {
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
  pushPenalty(
    !!input.hasOffPlatformContact,
    'Off-platform contact request',
    2.5
  );
  pushPenalty(
    !!input.hasFreeWorkRequest,
    'Free work request',
    2.5
  );
  pushPenalty(
    !!input.hasExternalPaymentRequest,
    'External payment risk',
    2
  );
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
  const hasClientRating = Number.isFinite(input.rating) && input.rating > 0;
  const hasLowReviewCount =
    Number.isFinite(input.reviewsCount) &&
    input.reviewsCount > 0 &&
    input.reviewsCount <= LOW_REVIEW_TOXIC_THRESHOLD;
  const isToxicClient = (hasClientRating && input.rating < 4.0) || hasLowReviewCount;
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
    effectiveHireRatePct >= 90 &&
      (input.jobsPosted >= 5 || input.totalHires >= 3),
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
  pushBonus(!!input.hasClearBrief, 'Clear Brief bonus', 1, 'Clear Brief');
  pushBonus(
    !!input.hasMilestoneFriendly,
    'Milestone Friendly bonus',
    1,
    'Milestone Friendly'
  );
  pushBonus(
    !!input.hasProfessionalTone,
    'Professional Tone bonus',
    1,
    'Professional Tone'
  );
  const teamBuilder =
    input.jobsPosted > 0 && input.totalHires / input.jobsPosted > 1.5;
  if (teamBuilder) addBadge(badges, 'Team builder');
  if (input.isTooGoodToBeTrue) {
    penaltiesApplied.push({ name: 'Too good to be true', points: 1.5 });
    addBadge(badges, 'Too good to be true');
  }
  const penalties = penaltiesApplied.reduce((acc, p) => acc + p.points, 0);
  const bonusPoints = bonusesApplied.reduce((acc, p) => acc + p.points, 0);
  const tempScore = baseScore + bonusPoints - penalties;
  if (tempScore >= 85 && input.proposalCount >= 10) {
    addBadge(badges, 'Boost it!');
  }
  const finalScore = clamp(round2(tempScore), 0, 100);
  const grade = gradeFromScore(finalScore);
  addFinalBadges(input, now, badges, addBadge, { isToxicClient, isUrgentRequest, killSwitches });
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
