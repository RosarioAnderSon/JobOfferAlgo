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
    if (rating < 4.0) return 0;
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
