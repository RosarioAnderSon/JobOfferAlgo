import type { Badge, JobInput } from './sniper-types';
import { hoursSince } from './sniper-helpers';

type AddBadge = (list: Badge[], badge: Badge) => void;

interface FinalBadgeContext {
  isToxicClient: boolean;
  isUrgentRequest: boolean;
  killSwitches: string[];
}

export const addFinalBadges = (
  input: JobInput,
  now: Date,
  badges: Badge[],
  addBadge: AddBadge,
  context: FinalBadgeContext
) => {
  if (context.isToxicClient) addBadge(badges, 'Toxic client');
  if (hoursSince(input.lastViewed, now) > 48) addBadge(badges, 'Ghost job');
  if (input.interviewing > 7) addBadge(badges, 'Crowded room');
  if (context.isUrgentRequest) addBadge(badges, 'SOS');

  if (input.invitesSent > 15) {
    addBadge(badges, context.isUrgentRequest ? 'SOS' : 'Spammer');
  }
  if (input.jobsPosted === 0 && !context.killSwitches.includes('Newbie risk')) {
    addBadge(badges, 'New client');
  }
  if (input.hasOffPlatformContact) addBadge(badges, 'Off-platform request');
  if (input.hasExternalPaymentRequest) addBadge(badges, 'External payment risk');
  if (input.hasFreeWorkRequest) addBadge(badges, 'Free work request');
  if (input.possibleClientNames && input.possibleClientNames.length > 0) {
    addBadge(badges, 'Possible client names');
  }
  if (input.hasScopeMonster) addBadge(badges, 'Scope Monster');
  if (input.hasFreeConsultant) addBadge(badges, 'Free Consultant');
  if (input.hasSilentHistory) addBadge(badges, 'Silent History');
  if (input.hasBudgetMismatch) addBadge(badges, 'Budget Mismatch');
  if (input.hasHighBudgetNewClientScam) addBadge(badges, 'First Job $2K+ Scam Risk');
  if (input.hasLowEffortTemplate) addBadge(badges, 'Poco esfuerzo');
};
