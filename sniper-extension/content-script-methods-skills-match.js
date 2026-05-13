(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;

  UpworkSniperExtension.prototype.computeSkillsMatch = function(requiredSkills, jobId) {
    const required = this.dedupeSkills(requiredSkills || []);
    const profileCache = this.loadProfileSkillsCache();
    const profileSkills = this.dedupeSkills(profileCache.skills || []);

    if (!required.length) {
      this.upsertMissingSkillsByJob(jobId, [], null, []);
      return {
        profileSkillsLoaded: profileSkills.length > 0,
        profileSkills,
        requiredSkills: [],
        matchedSkills: [],
        missingSkills: [],
      };
    }

    if (!profileSkills.length) {
      this.upsertMissingSkillsByJob(jobId, required, null, []);
      this.renderGlobalMissingSkillsSidebar();
      return {
        profileSkillsLoaded: false,
        profileSkills: [],
        requiredSkills: required,
        matchedSkills: [],
        missingSkills: required,
      };
    }

    const profileSet = new Set(profileSkills.map((skill) => this.normalizeSkillLabel(skill)));
    const matched = [];
    const missing = [];
    required.forEach((skill) => {
      const normalized = this.normalizeSkillLabel(skill);
      if (profileSet.has(normalized)) matched.push(skill);
      else missing.push(skill);
    });

    this.upsertMissingSkillsByJob(jobId, missing, null, matched);
    this.renderGlobalMissingSkillsSidebar();
    return {
      profileSkillsLoaded: true,
      profileSkills,
      requiredSkills: required,
      matchedSkills: matched,
      missingSkills: missing,
    };
  };
})();
