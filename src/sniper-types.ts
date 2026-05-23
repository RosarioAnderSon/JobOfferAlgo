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
  | 'New client'
  | 'Off-platform request'
  | 'External payment risk'
  | 'Free work request'
  | 'Too good to be true'
  | 'Possible client names'
  | 'Scope Monster'
  | 'Free Consultant'
  | 'Silent History'
  | 'Budget Mismatch'
  | 'Clear Brief'
  | 'Milestone Friendly'
  | 'Professional Tone'
  | 'First Job $2K+ Scam Risk'
  | 'Poco esfuerzo';

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
  lastViewed?: Date | null;
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
  hasOffPlatformContact?: boolean;
  hasExternalPaymentRequest?: boolean;
  hasFreeWorkRequest?: boolean;
  isTooGoodToBeTrue?: boolean;
  possibleClientNames?: string[];
  hasScopeMonster?: boolean;
  hasFreeConsultant?: boolean;
  hasSilentHistory?: boolean;
  hasBudgetMismatch?: boolean;
  hasClearBrief?: boolean;
  hasMilestoneFriendly?: boolean;
  hasProfessionalTone?: boolean;
  hasLowEffortTemplate?: boolean;
  hasJobNoLongerAvailable?: boolean;
  hasHighBudgetNewClientScam?: boolean;
  experienceLevel?: 'entry' | 'intermediate' | 'expert' | null;
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
