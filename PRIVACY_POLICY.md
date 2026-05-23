# Anderson's Sniper - Privacy Policy

Last updated: May 14, 2026

This Chrome/Edge extension (“the Extension”) scores and tags Upwork job posts. It is intended for personal use and runs entirely in your browser. By using it, you accept this Privacy Policy.

## What data is processed
- Upwork page content you are viewing: read only to compute the score and display badges.
- Local cache of results: stored in `localStorage` with the job ID, computed result, and extracted job signals to avoid recomputing.
- Local UI preferences: selected language, score weights, selected niche, and skills settings stored in `localStorage`.
- Runtime error/flow logs: kept in memory by default. They are stored in `localStorage` only if you explicitly enable `sniper-persist-logs-v1`.

## What data is NOT collected or sent
- No personal information, usage analytics, cookies, or browser identifiers are collected or transmitted to external servers.
- No data is shared with third parties.
- Feedback uses a `mailto:` link to `anderrosariotav@gmail.com`; the extension does not transmit feedback content.

## Browser permissions
- The Extension uses content scripts on Upwork pages only: `https://www.upwork.com/nx/*` and `https://www.upwork.com/freelancers/*`.
- It does not request `host_permissions`, `activeTab`, `tabs`, `scripting`, `webRequest`, or a background service worker.

## Use and retention
- Processing happens locally on your device. Cached results and preferences stay in your browser until you clear them (e.g., by clearing site data or uninstalling the Extension).

## Security
- The Extension does not expose remote interfaces or send data outside the browser. It relies on the security measures of the browser and Upwork as the source site.

## Your choices
- You can delete the cache by clearing site data for Upwork or uninstalling the Extension.
- If you do not accept this Policy, do not use the Extension.

## Changes
We may update this Privacy Policy. The current version will be in this file within the Extension repository/project. Review it periodically for updates.

## Contact
For questions or requests about this Privacy Policy, contact the repository owner or open an issue in the project.
