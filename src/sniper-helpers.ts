import type { Grade } from './sniper-types';

interface ActivityInput {
  lastViewed?: Date | null;
  postedAt?: Date | null;
}

export const MS_PER_DAY = 86_400_000;
export const MS_PER_HOUR = 3_600_000;
export const LOW_REVIEW_TOXIC_THRESHOLD = 2;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const round2 = (value: number) => Math.round(value * 100) / 100;

export const monthsBetween = (from: Date, to: Date) => {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const days = to.getDate() - from.getDate();
  const total = years * 12 + months;
  return days < 0 ? total - 1 : total;
};

export const isValidDate = (date: unknown): date is Date =>
  date instanceof Date && !Number.isNaN(date.getTime());

export const daysSince = (date: Date | null | undefined, now: Date) =>
  isValidDate(date)
    ? (now.getTime() - date.getTime()) / MS_PER_DAY
    : Infinity;

export const hoursSince = (date: Date | null | undefined, now: Date) =>
  isValidDate(date)
    ? (now.getTime() - date.getTime()) / MS_PER_HOUR
    : Infinity;

export const hireRatePoints = (
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

export const spendPoints = (
  totalSpent: number,
  _totalHires: number,
  _jobsPosted: number,
  _jobBudget?: number
) => {
  if (totalSpent >= 1000) return 100;
  if (totalSpent >= 500) return 90;
  if (totalSpent >= 200) return 75;
  if (totalSpent > 0) return 20;
  return 0;
};

export const ratingPoints = (rating: number, reviewsCount: number) => {
  if (rating < 4.0) return 0;
  if (reviewsCount < 3) return 80;
  if (rating >= 4.8) return 100;
  return 70;
};

export const activityPoints = (input: ActivityInput, now: Date) => {
  const lastViewed = isValidDate(input.lastViewed) ? input.lastViewed : null;
  if (lastViewed) {
    const hours = hoursSince(lastViewed, now);
    if (hours < 1) return 100;
    if (hours < 3) return 80;
    if (hours < 24) return 70;
    if (hours < 48) return 60;
    return 0;
  }

  const postedHours = hoursSince(input.postedAt, now);
  if (postedHours >= 0 && postedHours < 3) return 60;
  return 0;
};

export const proposalsPoints = (proposalCount: number) => {
  if (proposalCount < 5) return 100;
  if (proposalCount <= 10) return 85;
  if (proposalCount <= 20) return 60;
  if (proposalCount <= 50) return 30;
  return 0;
};

export const paymentPoints = (paymentVerified: boolean) =>
  paymentVerified ? 100 : 0;

export const jobsPostedPoints = (jobsPosted: number) => {
  if (jobsPosted >= 10) return 100;
  if (jobsPosted >= 1) return 80;
  return 50;
};

export const gradeFromScore = (score: number): Grade => {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 80) return 'B';
  return 'F';
};
