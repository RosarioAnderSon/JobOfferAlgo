import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { evaluateSniper, type JobInput } from '../src/sniper';

const parseUpworkHTML = (htmlPath: string): JobInput => {
  const html = readFileSync(htmlPath, 'utf-8');
  const root$ = cheerio.load(html);

  // ========================================
  // PASO CRÍTICO: Aislar el Job Detail Modal
  // ========================================
  const jobDetailContainer = root$('[role="dialog"], .job-details-content').first();
  if (jobDetailContainer.length === 0) {
    throw new Error('No se encontró el contenedor de detalle del trabajo');
  }

  // Reinterpretamos el DOM sólo dentro del modal para evitar "contaminación"
  const $ = cheerio.load(jobDetailContainer.html() || '');

  // Helper: Extraer número con multiplicadores K/M
  const parseMoneyValue = (text: string): number => {
    const match = text.match(/\$([\d.,]+)([KkMm]?)/);
    if (!match) return 0;
    let value = parseFloat(match[1].replace(/,/g, ''));
    const multiplier = match[2].toLowerCase();
    if (multiplier === 'k') value *= 1000;
    if (multiplier === 'm') value *= 1000000;
    return value;
  };

  // Helper: Extraer fecha
  const parseDate = (text: string): Date => {
    const match = text.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/);
    return match ? new Date(`${match[1]} ${match[2]}, ${match[3]}`) : new Date();
  };

  // ========================================
  // ZONA 1: CLIENT SIDEBAR (Dentro del modal)
  // ========================================
  const sidebar = $('.sidebar, .cfe-ui-job-about-client').first();
  const sidebarText = sidebar.text();

  // Total Spent
  const spentMatch = sidebarText.match(/\$([\d.,]+)([KkMm]?)\s+total spent/i);
  let totalSpent = 0;
  if (spentMatch) {
    let value = parseFloat(spentMatch[1].replace(/,/g, ''));
    const mult = spentMatch[2].toLowerCase();
    if (mult === 'k') value *= 1000;
    if (mult === 'm') value *= 1000000;
    totalSpent = value;
  }

  // Total Hires
  const hiresMatch = sidebarText.match(/(\d+)\s+hires/i);
  const totalHires = hiresMatch ? parseInt(hiresMatch[1]) : 0;

  // Jobs Posted
  const jobsMatch = sidebarText.match(/(\d+)\s+jobs posted/i);
  const jobsPosted = jobsMatch ? parseInt(jobsMatch[1]) : 0;

  // Hire Rate
  const rateMatch = sidebarText.match(/(\d+)%\s+hire rate/i);
  const hireRatePct = rateMatch ? parseInt(rateMatch[1]) : undefined;

  // Rating & Reviews
  const ratingMatch = sidebarText.match(/(\d\.\d+)\s+of\s+(\d+)\s+reviews/i);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
  const reviewsCount = ratingMatch ? parseInt(ratingMatch[2]) : 0;

  // Avg Hourly
  const hourlyMatch = sidebarText.match(/\$([\d.,]+)\s*\/hr\s+avg hourly rate paid/i);
  const avgHourlyPaid = hourlyMatch ? parseFloat(hourlyMatch[1].replace(/,/g, '')) : undefined;

  // Member Since
  const memberMatch = sidebarText.match(/Member since\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
  const memberSince = memberMatch ? parseDate(memberMatch[1]) : new Date();

  // Payment Verified
  const paymentVerified = sidebarText.includes('Payment method verified');

  // Client Country
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
  let clientCountry: string | undefined;
  for (const country of tier1) {
    if (sidebarText.includes(country)) {
      clientCountry = country;
      break;
    }
  }

  // ========================================
  // ZONA 2: ACTIVITY SECTION (Dentro del modal)
  // ========================================
  const activitySection = $('h5, h4')
    .filter((_, el) => $(el).text().includes('Activity on this job'))
    .first()
    .parent();
  const activityText = activitySection.text();

  // Proposals
  const proposalMatch = activityText.match(/Proposals:.*?(\d+\s+to\s+\d+|less than \d+|\d+)/is);
  let proposalCount = 0;
  if (proposalMatch) {
    const pText = proposalMatch[1].toLowerCase();
    if (pText.includes('less than 5')) {
      proposalCount = 4;
    } else if (pText.includes('to')) {
      const nums = pText.match(/\d+/g);
      if (nums && nums.length >= 2) {
        proposalCount = (parseInt(nums[0]) + parseInt(nums[1])) / 2;
      }
    } else {
      const nums = pText.match(/\d+/);
      proposalCount = nums ? parseInt(nums[0]) : 0;
    }
  }

  // Interviewing
  const interviewingMatch = activityText.match(/Interviewing:?\s*(\d+)/i);
  const interviewing = interviewingMatch ? parseInt(interviewingMatch[1]) : 0;

  // Invites Sent
  const invitesMatch = activityText.match(/Invites sent:?\s*(\d+)/i);
  const invitesSent = invitesMatch ? parseInt(invitesMatch[1]) : 0;

  // Last Viewed
  const viewedMatch = activityText.match(/Last viewed by client:?\s*([^\n]+)/i);
  let lastViewed = new Date();
  if (viewedMatch) {
    const vText = viewedMatch[1].toLowerCase();
    const now = new Date();
    if (vText.includes('minute')) {
      const mins = parseInt(vText.match(/(\d+)/)?.[1] || '0');
      lastViewed = new Date(now.getTime() - mins * 60 * 1000);
    } else if (vText.includes('hour')) {
      const hours = parseInt(vText.match(/(\d+)/)?.[1] || '0');
      lastViewed = new Date(now.getTime() - hours * 60 * 60 * 1000);
    } else if (vText.includes('day')) {
      const days = parseInt(vText.match(/(\d+)/)?.[1] || '0');
      lastViewed = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
  }

  // ========================================
  // ZONA 3: JOB DESCRIPTION (Dentro del modal)
  // ========================================
  const description = $('.job-description, [data-test="Description"]').first().text();
  const descriptionLength = description.trim().length;
  const jobTitle = $('h1, [data-test="job-title"], .job-title').first().text().trim() || undefined;

  return {
    memberSince,
    jobsPosted,
    paymentVerified,
    totalSpent,
    totalHires,
    hireRatePct,
    rating,
    reviewsCount,
    proposalCount,
    lastViewed,
    invitesSent,
    interviewing,
    jobTitle,
    descriptionText: description,
    descriptionLength,
    clientCountry,
    avgHourlyPaid,
  };
};

const htmlPath = process.argv[2] || 'test/upwork-job-detail.html';
const input = parseUpworkHTML(htmlPath);
const result = evaluateSniper(input);

console.log('Parsed input:', input);
console.log('Evaluation:', result);

