import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { evaluateSniper, type JobInput } from '../src/sniper';

const defaultHtmlPath = 'test/Upwork.html';

const parseMoneyValue = (text: string): number => {
  const match = text.match(/\$([\d.,]+)([KkMm]?)/);
  if (!match) return 0;
  let value = parseFloat(match[1].replace(/,/g, ''));
  const mult = match[2]?.toLowerCase();
  if (mult === 'k') value *= 1000;
  if (mult === 'm') value *= 1_000_000;
  return value;
};

const parseDate = (text: string): Date => {
  const match = text.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/);
  return match ? new Date(`${match[1]} ${match[2]}, ${match[3]}`) : new Date();
};

const getScopeLoader = (root$: cheerio.Root): cheerio.Root => {
  const modal = root$('[role="dialog"], .job-details-content').first();
  if (modal.length) return cheerio.load(modal.html() || '');

  const detail = root$('.job-details, main').first();
  if (detail.length) return cheerio.load(detail.html() || '');

  return root$;
};

const extractContentScriptInput = (html: string): JobInput => {
  const root$ = cheerio.load(html);
  const $ = getScopeLoader(root$);

  const sidebar =
    $('.sidebar, .cfe-ui-job-about-client, [data-test="client-info"], .client-info, aside').first();
  const sidebarText = sidebar.length ? sidebar.text() : '';

  const activityHeader = $('h5, h4')
    .filter((_, el) => $(el).text().includes('Activity on this job'))
    .first();
  const activitySection = activityHeader.length
    ? activityHeader.parent()
    : sidebar.length
      ? sidebar.parent()
      : $.root();
  const activityText = activitySection.text();

  const descEl = $('[data-test="Description"], .job-description, .description').first();
  const descText = descEl.text() || '';
  const titleText = $('[data-test="job-title"], h1, .job-title').first().text() || '';
  const scopeText = $.root().text();

  const extractSpent = (text: string) => {
    const match = text.match(/\$([\d.,]+)([KkMm]?)\s+total spent/i);
    if (!match) return 0;
    let value = parseFloat(match[1].replace(/,/g, ''));
    const multiplier = match[2]?.toLowerCase();
    if (multiplier === 'k') value *= 1000;
    if (multiplier === 'm') value *= 1_000_000;
    return value;
  };

  const extractHires = (text: string) => {
    const match = text.match(/(\d+)\s*hires?/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const extractJobsPosted = (text: string) => {
    const match = text.match(/(\d+)\s*jobs? posted/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const extractHireRate = (text: string) => {
    const match = text.match(/(\d+)%\s*hire rate/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const extractRating = (text: string) => {
    // Match patterns like "4.89 of 21 reviews" or "4.9 of 5"
    const match = text.match(/(\d\.\d+)\s+of\s+(\d+)\s+reviews/i) || text.match(/(\d\.\d+)\s*of\s*5/i);
    return match ? parseFloat(match[1]) : 0;
  };

  const extractReviews = (text: string) => {
    const match = text.match(/(\d+)\s*reviews?/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const extractProposals = (text: string) => {
    const source = String(text || '');
    if (!source) return 20;
    const match = source.match(
      /Proposals:\s*(less than\s+\d+|\d+\s*(?:to|[^\d\s]+)\s*\d+|\d+\s*\+|\d+)/i
    );
    if (!match) return 20;

    const raw = String(match[1] || '').trim().toLowerCase();
    if (raw.includes('less than')) {
      const num = parseInt(raw.match(/\d+/)?.[0] || '0', 10);
      return Math.max(num - 1, 0);
    }
    if (raw.includes('+')) {
      const num = parseInt(raw.match(/\d+/)?.[0] || '0', 10);
      return Number.isFinite(num) ? num : 20;
    }
    const range = raw.match(/(\d+)\s*(?:to|[^\d\s]+)\s*(\d+)/i);
    if (range) {
      const lower = parseInt(range[1], 10);
      const upper = parseInt(range[2], 10);
      if (!Number.isFinite(lower) || !Number.isFinite(upper)) return 20;
      if (lower === 5 && upper === 10) return 5;
      return lower + 1;
    }
    const numbers = raw.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const lower = parseInt(numbers[0], 10);
      const upper = parseInt(numbers[1], 10);
      if (!Number.isFinite(lower) || !Number.isFinite(upper)) return 20;
      if (lower === 5 && upper === 10) return 5;
      return lower + 1;
    }
    const single = parseInt(raw.match(/\d+/)?.[0] || '0', 10);
    return Number.isFinite(single) ? single : 20;
  };

  const extractLastViewed = (text: string) => {
    const match = text.match(/Last viewed by client:.*?(\d+)\s*(minute|hour|day)s?\s*ago/is);
    if (!match) return undefined;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const now = Date.now();

    if (unit.includes('minute')) return new Date(now - value * 60 * 1000);
    if (unit.includes('hour')) return new Date(now - value * 60 * 60 * 1000);
    if (unit.includes('day')) return new Date(now - value * 24 * 60 * 60 * 1000);
    return undefined;
  };

  const extractInvites = (text: string) => {
    const match = text.match(/Invites sent:.*?(\d+)/is);
    return match ? parseInt(match[1], 10) : 0;
  };

  const extractInterviewing = (text: string) => {
    const match = text.match(/Interviewing:.*?(\d+)/is);
    return match ? parseInt(match[1], 10) : 0;
  };

  const extractMemberSince = (text: string) => {
    const match = text.match(/Member since\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
    return match ? parseDate(match[1]) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  };

  const extractCountry = (text: string) => {
    const tier1 = [
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
    return tier1.find((c) => text.includes(c));
  };

  const extractPostedTime = (text: string): Date | undefined => {
    const match = text.match(/Posted\s+(\d+)\s+(minute|hour|day|week|month)s?\s+ago/i);
    if (!match) return undefined;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const now = Date.now();

    if (unit.includes('minute')) return new Date(now - value * 60 * 1000);
    if (unit.includes('hour')) return new Date(now - value * 60 * 60 * 1000);
    if (unit.includes('day')) return new Date(now - value * 24 * 60 * 60 * 1000);
    if (unit.includes('week')) return new Date(now - value * 7 * 24 * 60 * 60 * 1000);
    if (unit.includes('month')) return new Date(now - value * 30 * 24 * 60 * 60 * 1000);
    return undefined;
  };

  const extractAvgHourly = (text: string) => {
    const match = text.match(/\$([\d.,]+)\s*\/hr\s*avg hourly rate paid/i);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  };

  const textForInfo = sidebarText || scopeText;

  return {
    memberSince: extractMemberSince(textForInfo),
    jobsPosted: extractJobsPosted(textForInfo),
    paymentVerified:
      textForInfo.includes('Payment verified') ||
      textForInfo.includes('Payment method verified') ||
      scopeText.includes('Payment verified'),
    totalSpent: extractSpent(textForInfo),
    totalHires: extractHires(textForInfo),
    hireRatePct: extractHireRate(textForInfo) || undefined,
    rating: extractRating(textForInfo),
    reviewsCount: extractReviews(textForInfo),
    jobTitle: titleText.trim() || undefined,
    proposalCount: extractProposals(activityText || scopeText),
    lastViewed: extractLastViewed(activityText || scopeText) || new Date(0),
    invitesSent: extractInvites(activityText || scopeText),
    interviewing: extractInterviewing(activityText || scopeText),
    descriptionText: descText,
    descriptionLength: descText.trim().length,
    clientCountry: extractCountry(textForInfo),
    postedAt: extractPostedTime(scopeText),
    avgHourlyPaid: extractAvgHourly(textForInfo),
  };
};

const run = () => {
  const htmlPath = process.argv[2] || defaultHtmlPath;
  const html = readFileSync(htmlPath, 'utf-8');

  const input = extractContentScriptInput(html);
  const evaluation = evaluateSniper(input);

  console.log('Parsed (content-script style):', input);
  console.log('Evaluation:', evaluation);
};

run();
