(() => {
  'use strict';

  const UpworkSniperExtension = window.UpworkSniperExtension;
  if (!UpworkSniperExtension) return;
  const logs = window.SniperLog || {};
  const log = logs.log || (() => {});
  const logSuccess = logs.logSuccess || (() => {});
  const logError = logs.logError || (() => {});

  UpworkSniperExtension.prototype.normalizeSkillLabel = function(value) {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

  UpworkSniperExtension.prototype.toDisplaySkillLabel = function(value) {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
    }

  UpworkSniperExtension.prototype.dedupeSkills = function(skills) {
      const seen = new Set();
      const out = [];
      (skills || []).forEach((skill) => {
        const display = this.toDisplaySkillLabel(skill);
        if (!display) return;
        const normalized = this.normalizeSkillLabel(display);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        out.push(display);
      });
      return out;
    }

  UpworkSniperExtension.prototype.extractSkillsFromElement = function(root) {
      if (!root) return [];
      const candidateNodes = Array.from(
        root.querySelectorAll(
          '[data-test="token-container"] .air3-token, [data-test="token-container"] [role="button"], [data-test="token-container"] button, [data-test="token-container"] span, .skills-list .badge, .skills-list [role="button"], .skills-list button, .air3-token-container .air3-token, .air3-token-container button, .skills .air3-token-wrap .skill-name, .skills .air3-token-wrap .air3-token, .skills .air3-popper-trigger .skill-name, .skills .air3-popper-trigger [class*="skill-name"]'
        )
      );
      const blocked = new Set([
        'skip skills',
        'previous skills. update list',
        'next skills. update list',
        'skills',
        'must have skills:',
        'required skills',
      ]);
      const extracted = candidateNodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => {
          if (!text) return false;
          const normalized = text.toLowerCase();
          if (blocked.has(normalized)) return false;
          if (normalized.includes('skip skills')) return false;
          if (normalized.includes('update list')) return false;
          if (text.length < 2 || text.length > 48) return false;
          return true;
        });
      return this.dedupeSkills(extracted);
    }

  UpworkSniperExtension.prototype.extractJobRequiredSkills = function(scope) {
      return this.extractSkillsFromElement(scope || document);
    }

  UpworkSniperExtension.prototype.extractFreelancerProfileSkills = function() {
      return this.extractSkillsFromElement(document);
    }

  UpworkSniperExtension.prototype.hasFreelancerSkillsContainer = function() {
      const container = document.querySelector('.skills .air3-token-wrap, .skills-list, [data-test="token-container"], .air3-token-container');
      return !!container;
    }

  UpworkSniperExtension.prototype.loadProfileSkillsCache = function() {
      try {
        const raw = localStorage.getItem(this.profileSkillsKey);
        if (!raw) return { skills: [], updatedAt: 0, sourceUrl: null };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { skills: [], updatedAt: 0, sourceUrl: null };
        const skills = Array.isArray(parsed.skills) ? this.dedupeSkills(parsed.skills) : [];
        return {
          skills,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
          sourceUrl: parsed.sourceUrl || null,
        };
      } catch (error) {
        logError('DETAIL', 'No se pudo leer cache de skills de perfil', error);
        return { skills: [], updatedAt: 0, sourceUrl: null };
      }
    }

  UpworkSniperExtension.prototype.saveProfileSkillsCache = function(skills, sourceUrl) {
      try {
        const payload = {
          skills: this.dedupeSkills(skills),
          updatedAt: Date.now(),
          sourceUrl: sourceUrl || window.location.href,
        };
        localStorage.setItem(this.profileSkillsKey, JSON.stringify(payload));
      } catch (error) {
        logError('DETAIL', 'No se pudo guardar cache de skills de perfil', error);
      }
    }

  UpworkSniperExtension.prototype.captureFreelancerProfileSkills = function() {
      if (this._profileSkillsCaptureInProgress) return;
      this._profileSkillsCaptureInProgress = true;

      const maxAttempts = 12;
      const attemptDelayMs = 500;
      let attempts = 0;
      let observer = null;
      let intervalId = null;

      const cleanup = () => {
        if (observer) observer.disconnect();
        if (intervalId) clearInterval(intervalId);
        this._profileSkillsCaptureInProgress = false;
      };

      const tryCapture = () => {
        attempts += 1;
        const hasContainer = this.hasFreelancerSkillsContainer();
        if (hasContainer) {
          log('DETAIL', `Contenedor de skills detectado (intento ${attempts}/${maxAttempts})`);
        }
        const skills = this.extractFreelancerProfileSkills();
        if (skills.length > 0) {
          this.saveProfileSkillsCache(skills, window.location.href);
          log('DETAIL', `Skills de perfil guardados: ${skills.length} (intento ${attempts}/${maxAttempts})`);
          cleanup();
          return;
        }

        if (attempts >= maxAttempts) {
          log('DETAIL', `No se detectaron skills en perfil freelancer tras ${maxAttempts} intentos`);
          cleanup();
        }
      };

      tryCapture();
      if (!this._profileSkillsCaptureInProgress) return;

      intervalId = setInterval(() => {
        if (!this._profileSkillsCaptureInProgress) return;
        tryCapture();
      }, attemptDelayMs);

      observer = new MutationObserver(() => {
        if (!this._profileSkillsCaptureInProgress) return;
        const skills = this.extractFreelancerProfileSkills();
        if (skills.length > 0) {
          this.saveProfileSkillsCache(skills, window.location.href);
          log('DETAIL', `Skills de perfil guardados via observer: ${skills.length}`);
          cleanup();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
})();

