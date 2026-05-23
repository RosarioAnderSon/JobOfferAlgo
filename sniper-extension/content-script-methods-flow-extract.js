(() => {
  'use strict';
  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const logVerbose = logs.logVerbose || (() => {});

  UpworkSniperExtension.prototype.getJobScope = function() {
    const modal = document.querySelector(
      '[role="dialog"].air3-slider-job-details, .job-details-content, .air3-slider-job-details'
    );
    if (modal) return modal;
    const detail = document.querySelector('.job-details, main');
    return detail || document.body;
  };

  UpworkSniperExtension.prototype.extractJobData = function() {
    const scope = this.getJobScope();
    const sidebar = scope.querySelector(
      'aside.sidebar, .cfe-ui-job-about-client, [data-test="client-info"], .client-info'
    );
    const aboutClientSection = Array.from(scope.querySelectorAll('h4, h3, h2')).find(
      (h) => h.textContent?.trim() === 'About the client'
    )?.nextElementSibling;
    const effectiveSidebar = sidebar || aboutClientSection || scope;
    const sidebarText = effectiveSidebar?.innerText || effectiveSidebar?.textContent || '';
    logVerbose('DETAIL', '--- EXTRACCION DE DATOS ---');
    logVerbose('DETAIL', `Scope selector: ${scope === document.body ? 'body' : scope.className || scope.tagName}`);
    logVerbose('DETAIL', `Sidebar found: ${!!sidebar} (${sidebar?.className || sidebar?.tagName || 'N/A'})`);
    logVerbose('DETAIL', `About client section: ${!!aboutClientSection}`);
    logVerbose('DETAIL', `Effective sidebar text length: ${sidebarText.length} chars`);
    logVerbose('DETAIL', `Effective sidebar first 400 chars: "${sidebarText.substring(0, 400).replace(/\s+/g, ' ')}"`);

    const activityHeader = Array.from(scope.querySelectorAll('h5, h4')).find((el) =>
      el?.textContent?.includes('Activity on this job')
    );
    const activitySection =
      activityHeader?.parentElement || activityHeader?.closest('section') || effectiveSidebar?.parentElement || scope;
    const activityText = activitySection?.innerText || activitySection?.textContent || '';
    logVerbose('DETAIL', `Activity section found: ${!!activityHeader}`);
    logVerbose('DETAIL', `Activity text length: ${activityText.length} chars`);

    const descEl = scope.querySelector('[data-test="Description"], .job-description, .description');
    const descText = descEl?.innerText || descEl?.textContent || '';
    const titleEl = scope.querySelector('[data-test="job-title"], h1, .job-title');
    const titleText = titleEl?.innerText || titleEl?.textContent || '';
    const scopeText = scope.innerText || scope.textContent || document.body.innerText || '';
    const requiredSkills = this.extractJobRequiredSkills(scope);
    const extractors = window.SniperExtractors;
    if (!extractors) throw new Error('SniperExtractors is not available');

    const clientRatingText = extractors.getClientRatingText(scope, effectiveSidebar);
    logVerbose('DETAIL', `Description length: ${descText.length} chars`);
    logVerbose('DETAIL', `Total scope text length: ${scopeText.length} chars`);
    logVerbose('DETAIL', '------------------------------------');
    const extractedData = {
      jobId: this.currentJobId || null,
      memberSince: extractors.extractMemberSince(sidebarText || scopeText),
      jobsPosted: extractors.extractJobsPosted(sidebarText || scopeText),
      paymentVerified:
        sidebarText.includes('Payment verified') ||
        sidebarText.includes('Payment method verified') ||
        scopeText.includes('Payment verified'),
      totalSpent: extractors.extractSpent(sidebarText || scopeText),
      totalHires: extractors.extractHires(sidebarText || scopeText),
      hireRatePct: extractors.extractHireRate(sidebarText || scopeText),
      rating: extractors.extractRating(sidebarText || scopeText, clientRatingText),
      reviewsCount: extractors.extractReviews(sidebarText || scopeText, clientRatingText),
      hasLowRecentReview: extractors.extractHasLowRecentReview(sidebarText || scopeText),
      proposalCount: extractors.extractProposals(activityText || scopeText),
      lastViewed: extractors.extractLastViewed(activityText || scopeText),
      invitesSent: extractors.extractInvites(activityText || scopeText),
      unansweredInvites: extractors.extractUnansweredInvites(activityText || scopeText),
      interviewing: extractors.extractInterviewing(activityText || scopeText),
      jobTitle: titleText.trim() || undefined,
      descriptionText: descText,
      scopeText,
      activityText,
      requiredSkills,
      descriptionLength: descText.trim().length,
      clientCountry: extractors.extractCountry(sidebarText || scopeText),
      postedAt: extractors.extractPostedTime(scopeText),
      avgHourlyPaid: extractors.extractAvgHourly(sidebarText || scopeText),
      hasOffPlatformContact: extractors.extractOffPlatformContact(descText || scopeText),
      hasExternalPaymentRequest: extractors.extractExternalPaymentRisk(descText || scopeText),
      hasFreeWorkRequest: extractors.extractFreeWorkRequest(descText || scopeText),
      isTooGoodToBeTrue: extractors.extractTooGoodToBeTrue(descText || scopeText, sidebarText || scopeText),
      possibleClientNames: extractors.extractPossibleClientNames(scope),
      hasScopeMonster: extractors.extractScopeMonster(descText || scopeText),
      hasFreeConsultant: extractors.extractFreeConsultant(descText || scopeText),
      hasSilentHistory: extractors.extractSilentHistory(sidebarText || scopeText),
      hasBudgetMismatch: extractors.extractBudgetMismatch(scopeText, descText || scopeText),
      hasClearBrief: extractors.extractClearBrief(descText || scopeText),
      hasMilestoneFriendly: extractors.extractMilestoneFriendly(descText || scopeText),
      hasProfessionalTone: extractors.extractProfessionalTone(descText || scopeText),
      hasLowEffortTemplate: extractors.extractLowEffortTemplate(titleText, descText),
      experienceLevel: extractors.extractExperienceLevel(scopeText),
      hasJobNoLongerAvailable: /job is no longer available/i.test(scopeText),
    };
    extractedData.jobBudget = extractors.extractFixedBudget(scopeText);
    const accountAgeDays = Math.max(0, (Date.now() - extractedData.memberSince.getTime()) / 86_400_000);
    extractedData.hasHighBudgetNewClientScam =
      !extractedData.paymentVerified &&
      accountAgeDays < 31 &&
      extractedData.jobsPosted <= 1 &&
      extractedData.totalHires === 0 &&
      extractedData.totalSpent === 0 &&
      extractedData.reviewsCount === 0 &&
      Number(extractedData.jobBudget || 0) >= 2000;
    extractedData.supportAvgBadge = this.computeSupportAvgBadge(extractedData);
    extractedData.skillsMatch = this.computeSkillsMatch(requiredSkills, extractedData.jobId);
    logVerbose('DETAIL', 'Valores extraidos:');
    logVerbose('DETAIL', `  - jobsPosted: ${extractedData.jobsPosted}`);
    logVerbose('DETAIL', `  - totalHires: ${extractedData.totalHires}`);
    logVerbose('DETAIL', `  - totalSpent: $${extractedData.totalSpent}`);
    logVerbose('DETAIL', `  - hireRatePct: ${extractedData.hireRatePct}%`);
    logVerbose('DETAIL', `  - paymentVerified: ${extractedData.paymentVerified}`);
    logVerbose('DETAIL', `  - rating: ${extractedData.rating}`);
    logVerbose('DETAIL', `  - memberSince: ${extractedData.memberSince?.toDateString?.() || 'N/A'}`);
    logVerbose('DETAIL', `  - requiredSkills: ${requiredSkills.length}`);
    return extractedData;
  };
})();
