## Upwork Job Analyzer - Badges and Scoring (Compact)

Analyze an Upwork job post and explain quality/risk with badges plus a final score.

How to use:
1. Open an Upwork job offer.
2. Close it to return to the list/feed.
3. Review the score and badges rendered on the card.

### Green Flags

- `Gold standard` (+1)
  - Hire rate > 70%, total spent > $10,000, rating > 4.8.
- `Fresh off the oven` (+1)
  - Posted < 1 hour.
- `Whale client` (+1)
  - Total spent > $10k OR avg spend per hire > $1,000.
- `Tier 1 country` (+1)
  - Country in: US, CA, UK, AU, DE, CH, SE, DK, NO, NL, SG, NZ.
- `Elite hire rate` (+1)
  - Hire rate >= 90%.
- `Sociable` (+1)
  - Interview ratio > 35%, hire rate >= 80%, rating >= 4.8.
- `Clear Brief` (+1)
  - Clear deliverables + timeline/deadline signals.
- `Milestone Friendly` (+1)
  - Mentions milestone/phase/staged payments.
- `Professional Tone` (+1)
  - Professional/specific wording without toxic urgency.
- `Team builder` (info)
  - Hires per job posted > 1.5.
- `New client` (info)
  - Jobs posted == 0 (if no kill switch).
- `Boost it!` (info)
  - Provisional score >= 85 and proposals >= 10.
- `SOS` (info)
  - Urgency keywords detected; can neutralize `Spammer`.
- `Possible client names` (info)
  - Names extracted from `Client's recent history` only.
- `Support Avg/hr` (info)
  - For support niche jobs (`Customer Service/Support/Specialist`), compares hourly signal against feed benchmark.
  - Status: `Above benchmark`, `On benchmark`, `Below benchmark`, or `Benchmark unavailable`.
- `Skills match` (info)
  - Compares required job skills vs freelancer profile skills loaded from `/freelancers/...`.
  - If profile skills are missing, badge instructs opening profile first, then reopening the job.

Interview ratio note:
`interviewing / (proposals + invitesSent - unansweredInvites)` when denominator > 0.

Skills counters note:
Missing skills are shown in a left-side panel on the JobCard with accumulated counter `x#` per skill.
Counters and cached profile skills persist manually in local storage and can be reset from Settings.

### Red Flags

- `Window shopper` (-1)
  - Hire rate < 65% with more than 3 jobs posted.
- `Dead post` (-1)
  - Posted >= 2 days, interviewing == 0, proposals >= 50.
- `Complot` (-1)
  - Proposals >= 20, interviewing == 1, invites == 0.
- `Time Waster` (-1)
  - Interview ratio > 40% and hire rate between 35% and 50%.
- `Data Harvesting` (-1)
  - Hires <= 1, interview ratio > 35%, hire rate < 25%, account age < 6 months.
- `Serial Poster` (-1)
  - Jobs posted >= 5 and hires/jobs < 30%.
- `Perpetual Posting` (-1)
  - Posted > 7 days.
- `Cheapskate` (-1)
  - Avg hourly paid < $15 OR avg spend per hire < $100.
- `Spammer` (-1)
  - Invites sent > 15 (unless `SOS` applies).
- `Crowded room` (-1)
  - Interviewing > 7.
- `Ojo` (-1)
  - Weak recent-feedback signal (not duplicated when `Toxic client` already triggered by low review volume).
- `Scope Monster` (-1)
  - Over-broad multi-role scope in one post.
- `Free Consultant` (-1)
  - Asks for detailed strategy/diagnosis before hiring.
- `Silent History` (-1)
  - Historical activity with weak visible feedback trace.
- `Budget Mismatch` (-1)
  - Expert-level ask with weak budget signal.
- `Off-platform request` (-2)
  - Requests contact outside Upwork.
- `External payment risk` (-2)
  - Requests external payment methods (crypto/gift card/check, etc).
- `Free work request` (-2)
  - Requests unpaid sample/free work.
- `Too good to be true` (-1.5)
  - Simple task + unusually high pay + weak history.
- `Shortlisting` (-0.5)
  - Last viewed > 48h but interviewing > 0.
- `Stagnant job` (-1)
  - No metric movement for 7+ days and interviewing == 0.

### Kill Switches (Score = 0)

- `Ghost job`
  - Last viewed > 48h AND interviewing == 0.
- `Unverified & broke`
  - Payment not verified AND total spent == 0.
- `Job no longer available`
  - Explicit unavailable marker detected.
- `Newbie risk`
  - Very new/weak trust profile combination.

### Toxic Client Rule

- `Toxic client` (badge-only signal, 0 points)
  - Rating < 4.0 OR very low review count (1-2 reviews).
  - Meaning: higher experience risk due to low rating or too little review volume.
