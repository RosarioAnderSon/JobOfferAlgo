(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logError = logs.logError || (() => {});

  const SKILLS_THRESHOLD_OPTIONS = [0, 50, 80];
  const MISSING_SKILLS_BY_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const MISSING_SKILLS_BY_JOB_MAX_ENTRIES = 250;
  const MAX_VISIBLE_SKILLS = 12;
  const SUPPORTED_NICHES = ['customer_service', 'customer_support', 'customer_specialist'];

  const normalizeThreshold = (value) => {
    const n = Number(value);
    return SKILLS_THRESHOLD_OPTIONS.includes(n) ? n : 0;
  };

  UpworkSniperExtension.prototype.resetSkillsTracking = function() {
    localStorage.removeItem(this.missingSkillsCounterKey);
    localStorage.removeItem(this.missingSkillsSeenJobsKey);
    localStorage.removeItem(this.missingSkillsByJobKey);
    localStorage.removeItem(this.missingSkillsTopSnapshotKey);
    localStorage.removeItem(this.profileSkillsKey);
    this.renderGlobalMissingSkillsSidebar();
  };

  UpworkSniperExtension.prototype.renderGlobalMissingSkillsSidebar = function() {
    const existing = document.getElementById('sniper-global-missing-skills');
    if (existing) existing.remove();

    const panel = document.createElement('aside');
    panel.id = 'sniper-global-missing-skills';
    panel.className = 'sniper-global-missing-skills';
    const isCollapsed = this.getMissingSkillsCollapsed();
    if (isCollapsed) panel.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'sniper-left-panel-header';
    const title = document.createElement('div');
    title.className = 'sniper-left-panel-title';
    title.textContent = this.t('skillsMissingTitle');
    header.appendChild(title);
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'sniper-left-panel-collapse-btn';
    collapseBtn.textContent = isCollapsed ? '›' : '‹';
    collapseBtn.title = isCollapsed ? 'Expandir' : 'Compactar';
    collapseBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.toggleMissingSkillsCollapsed();
    });
    header.appendChild(collapseBtn);
    panel.appendChild(header);

    if (isCollapsed) {
      document.body.appendChild(panel);
      return;
    }

    const minScore = this.getMissingSkillsMinScore();

    const filterRow = document.createElement('div');
    filterRow.className = 'sniper-left-panel-filter';
    const filterLabel = document.createElement('span');
    filterLabel.className = 'sniper-left-panel-filter-label';
    filterLabel.textContent = `${this.t('skillsMinScoreLabel')}:`;
    filterRow.appendChild(filterLabel);

    SKILLS_THRESHOLD_OPTIONS.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sniper-left-panel-filter-btn';
      btn.textContent = this.t(`skillsMinScore${option}`);
      btn.dataset.value = String(option);
      if (option === minScore) btn.classList.add('active');
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setMissingSkillsMinScore(option);
      });
      filterRow.appendChild(btn);
    });

    panel.appendChild(filterRow);

    const counterGroups = this.buildMissingSkillsCounters(minScore);
    const missingEntriesRaw = Object.entries(counterGroups.missing || {})
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    const matchedEntriesRaw = Object.entries(counterGroups.matched || {})
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    const topSnapshot = this.loadTopSkillsSnapshot();
    const matchedEntries = this.selectStableTopEntries(matchedEntriesRaw, topSnapshot.have);
    const missingEntries = this.selectStableTopEntries(missingEntriesRaw, topSnapshot.missing);
    this.saveTopSkillsSnapshot({
      have: matchedEntries.map(([skill]) => skill),
      missing: missingEntries.map(([skill]) => skill),
    });

    if (!missingEntries.length && !matchedEntries.length) {
      const msg = document.createElement('div');
      msg.className = 'sniper-left-panel-msg';
      msg.textContent = this.t('skillsMissingNone');
      panel.appendChild(msg);
    } else {
      const renderList = (entries, toneClass, titleText) => {
        const section = document.createElement('div');
        section.className = `sniper-left-panel-section ${toneClass}`;
        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'sniper-left-panel-section-title';
        sectionTitle.textContent = titleText;
        section.appendChild(sectionTitle);

        const list = document.createElement('ul');
        list.className = `sniper-left-panel-list ${toneClass}`;
        entries.forEach(([skill, count]) => {
          const li = document.createElement('li');
          li.textContent = `${this.toDisplaySkillLabel(skill)} x${count}`;
          list.appendChild(li);
        });
        section.appendChild(list);
        panel.appendChild(section);
      };

      if (matchedEntries.length) {
        renderList(
          matchedEntries,
          'sniper-skill-have',
          this.language === 'es' ? 'Skills que tienes' : 'Skills you have'
        );
      }
      if (missingEntries.length) {
        renderList(
          missingEntries,
          'sniper-skill-missing',
          this.language === 'es' ? 'Skills faltantes' : 'Missing skills'
        );
      }
    }

    document.body.appendChild(panel);
  };

})();
