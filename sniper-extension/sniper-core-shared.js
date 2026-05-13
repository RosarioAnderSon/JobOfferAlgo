(() => {
  'use strict';

  const MS_PER_DAY = 86_400_000;
  const MS_PER_HOUR = 3_600_000;
  const LOW_REVIEW_TOXIC_THRESHOLD = 2;

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

  const hireRatePoints = (jobsPosted, totalHires, overridePct, thresholds = { A: 90, B: 70, C: 50 }) => {
    if (jobsPosted === 0) return 85;
    const baseRate =
      overridePct !== undefined ? overridePct : (totalHires / jobsPosted) * 100;

    // v4.5 fine-tune: solo castigamos a los nuevos, NO premiamos a los viejos
    const multiplier = jobsPosted < 5 ? 0.9 : 1.0;

    const adjusted = baseRate * multiplier;

    if (adjusted >= thresholds.A) return 100;
    if (adjusted >= thresholds.B) return 85;
    if (adjusted >= thresholds.C) return 50;
    return 0;
  };

  const spendPoints = (totalSpent, _totalHires, _jobsPosted, _jobBudget, thresholds = { A: 1000, B: 500, C: 200 }) => {
    if (totalSpent >= thresholds.A) return 100;
    if (totalSpent >= thresholds.B) return 90;
    if (totalSpent >= thresholds.C) return 75;
    if (totalSpent > 0) return 20;
    return 0;
  };

  const ratingPoints = (rating, reviewsCount, thresholds = { A: 4.8, min: 4.0 }) => {
    if (rating < thresholds.min) return 0;
    if (reviewsCount < 3) return 80;
    if (rating >= thresholds.A) return 100;
    return 70;
  };

  const activityPoints = (input, now, thresholds = { fresh: 1, recent: 3 }) => {
    const lastViewed =
      input.lastViewed instanceof Date && !Number.isNaN(input.lastViewed.getTime())
        ? input.lastViewed
        : null;
    if (!lastViewed) return 0;

    const viewedHours = hoursSince(lastViewed, now);
    if (viewedHours < thresholds.fresh) return 100;
    if (viewedHours < thresholds.recent) return 80;
    if (viewedHours < 24) return 70;
    if (viewedHours < 48) return 60;
    return 0;
  };

  const proposalsPoints = (proposalCount, thresholds = { A: 5, B: 10, C: 15 }) => {
    if (proposalCount < thresholds.A) return 100; // A
    if (proposalCount <= thresholds.B) return 85; // B
    if (proposalCount <= thresholds.C) return 70; // C
    if (proposalCount <= 50) return 0; // F
    return 0;
  };

  const paymentPoints = (paymentVerified) => (paymentVerified ? 100 : 0);

  const jobsPostedPoints = (jobsPosted, thresholds = { A: 10, B: 1 }) => {
    if (jobsPosted >= thresholds.A) return 100;
    if (jobsPosted >= thresholds.B) return 80;
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


  window.SniperCoreShared = {
    MS_PER_DAY,
    MS_PER_HOUR,
    LOW_REVIEW_TOXIC_THRESHOLD,
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
  };
})();
