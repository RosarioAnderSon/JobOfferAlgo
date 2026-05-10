(() => { 'use strict'; const UpworkSniperExtension = window.UpworkSniperExtension; if (!UpworkSniperExtension) return; const logs = window.SniperLog || {}; const log = logs.log || (() => {}); const logSuccess = logs.logSuccess || (() => {}); const logError = logs.logError || (() => {});
  UpworkSniperExtension.prototype.getBadgeConfig = function(badge, rawData = null) {
      const configs = {
        'Gold standard': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gsGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD700"/><stop offset="50%" stop-color="#FFC107"/><stop offset="100%" stop-color="#FF8F00"/></linearGradient><linearGradient id="gsRibbon" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1E88E5"/><stop offset="100%" stop-color="#1565C0"/></linearGradient></defs><path d="M8 3L9 13" stroke="url(#gsRibbon)" stroke-width="2" stroke-linecap="round"/><path d="M16 3L15 13" stroke="url(#gsRibbon)" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="6" fill="url(#gsGoldGrad)" opacity="0.3"/><circle cx="12" cy="16" r="5.5" fill="url(#gsGoldGrad)"/><circle cx="12" cy="16" r="4" fill="#FFF9C4" opacity="0.4"/><path d="M12 13L12.8 15.2L15.2 15.5L13.5 17L14 19.5L12 18.2L10 19.5L10.5 17L8.8 15.5L11.2 15.2L12 13Z" fill="#B7791F"/><path d="M12 10L12.5 11.5L14 12L12.5 12.5L12 14L11.5 12.5L10 12L11.5 11.5L12 10Z" fill="#FFE082"/></svg>`,
          type: 'good',
          description: 'Top Globables, hire rate 70%+, gasto por encima de $10k y rating 4.8+',
        },
        'Whale client': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="whBody" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#4FC3F7"/><stop offset="100%" stop-color="#0288D1"/></linearGradient><linearGradient id="whCoin" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFD54F"/><stop offset="100%" stop-color="#F9A825"/></linearGradient></defs><path d="M3 12.5c0-2.2 1.8-4 4-4h6.5c1.7 0 3.2 1.1 3.7 2.7l.3 1c.2.7.8 1.2 1.6 1.2.5 0 .9-.4.9-.9 0-.5-.3-.8-.8-.8-.4 0-.7.3-.8.7" stroke="#01579B" stroke-width="1.2" stroke-linecap="round"/><path d="M3 12.8c0 2.7 2.2 4.9 4.9 4.9H12c1.8 0 3.5-.7 4.7-2l.8-.9" fill="url(#whBody)"/><path d="M8 14c.6.4 1.2.6 2 .6.8 0 1.4-.2 2-.6" stroke="#E1F5FE" stroke-width="1.1" stroke-linecap="round"/><circle cx="8" cy="12.4" r="0.75" fill="#004D73"/><path d="M14.5 9.5c-.2-.5-.5-1-.5-1.6C14 6.9 15 6 16 6c1.2 0 2 .9 2 2 0 .6-.3 1.1-.5 1.6" stroke="#01579B" stroke-width="1.1" stroke-linecap="round"/><circle cx="17.2" cy="14.2" r="3.2" fill="url(#whCoin)" stroke="#F57F17" stroke-width="1.1"/><path d="M17.2 12.4c-.8 0-1.4.5-1.4 1.2 0 .7.6 1 1.4 1 .8 0 1.4.3 1.4 1 0 .7-.6 1.2-1.4 1.2-.7 0-1.2-.3-1.4-.8" stroke="#6D4C41" stroke-width="1" stroke-linecap="round"/><path d="M17.2 11.8v1" stroke="#6D4C41" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'good',
          description: 'Presupuesto fuerte, gast\u00f3 m\u00e1s de $10k total o $1k por hire',
        },
        Sociable: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="socHand" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0F2F1"/><stop offset="100%" stop-color="#B2DFDB"/></linearGradient><linearGradient id="socHeart" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFCDD2"/><stop offset="100%" stop-color="#E57373"/></linearGradient></defs><path d="M6 9.5c0-1.1.9-2 2-2h2.5c.7 0 1.3.4 1.6 1l.4.8c.2.4.6.7 1.1.7h1.3c.6 0 1.1.5 1.1 1.1 0 .6-.5 1.1-1.1 1.1H9.8c-.5 0-.9.2-1.3.5l-.6.6c-.6.6-1.7.6-2.3 0-.4-.4-.6-.9-.6-1.4V9.5Z" fill="url(#socHand)" stroke="#4E342E" stroke-width="1.1" stroke-linecap="round"/><path d="M17.6 6.6c-.7 0-1.3.3-1.7.8l-.2.2-.2-.2c-.5-.5-1.1-.8-1.7-.8-.9 0-1.8.5-2.2 1.5-.4 1-.2 2.3.6 3.1l3.5 3.6 3.5-3.6c.8-.8 1-2.1.6-3.1-.4-1-1.3-1.5-2.2-1.5Z" fill="url(#socHeart)" stroke="#C62828" stroke-width="1" stroke-linejoin="round"/></svg>`,
          type: 'good',
          description: 'Habla pero contrata, entrevista 35%+, hire rate 80%+, rating 4.8+',
        },
        'Elite hire rate': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#FFF3E0" stroke="#FB8C00" stroke-width="1.4"/><path d="M12 4.5l2 4.1 4.5.7-3.3 3.2.8 4.5-4-2.1-4 2.1.8-4.5-3.3-3.2 4.5-.7 2-4.1Z" fill="#FFB300" stroke="#F57C00" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
          type: 'good',
          description: 'Hire rate de 90% o m\u00e1s',
        },
        'Fresh off the oven': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="foFlameOuter" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FF6E40" stop-opacity="1"/><stop offset="100%" stop-color="#D84315" stop-opacity="1"/></radialGradient><radialGradient id="foFlameInner" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#FFEB3B" stop-opacity="1"/><stop offset="60%" stop-color="#FF9800" stop-opacity="1"/><stop offset="100%" stop-color="#FF5722" stop-opacity="0.8"/></radialGradient></defs><path d="M12 3C12 3 9 6 8 10C7.5 12 8 14 10 16C10.5 16.5 11.5 17 12 17C12.5 17 13.5 16.5 14 16C16 14 16.5 12 16 10C15 6 12 3 12 3Z" fill="url(#foFlameOuter)"/><path d="M12 7C12 7 10 9 9.5 11C9.2 12 9.5 13.5 11 14.5C11.5 14.8 12 15 12 15C12 15 12.5 14.8 13 14.5C14.5 13.5 14.8 12 14.5 11C14 9 12 7 12 7Z" fill="url(#foFlameInner)"/><ellipse cx="12" cy="11" rx="1.5" ry="2" fill="#FFF9C4" opacity="0.9"/></svg>`,
          type: 'good',
          description: 'Publicado hace menos de 1h, oportunidad fresca',
        },
        'Tier 1 country': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="t1Ocean2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4FC3F7"/><stop offset="100%" stop-color="#0288D1"/></linearGradient><linearGradient id="t1Land2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#A5D6A7"/><stop offset="100%" stop-color="#2E7D32"/></linearGradient><linearGradient id="t1Flag" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFCA28"/><stop offset="100%" stop-color="#F57C00"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#t1Ocean2)" stroke="#01579B" stroke-width="1.1"/><path d="M6.2 9.3c1.4-.9 3.3-1.4 4.9-.9 1 .3 1.8.9 2.5 1.7l-1.4 1.1-1.7-.4-.8 1.3-1.6.2-.7-1.3-1.2-.7Z" fill="url(#t1Land2)"/><path d="M7.1 12.4c-.6.3-1 .9-1 1.6 0 .6.3 1.2.8 1.6 1.1.8 2.4 1.3 3.7 1.4l.4-1.4-1-1.2.6-1.1-1.2-1.1-2.3-.8Z" fill="url(#t1Land2)"/><path d="M13.2 14.4c.5.5 1.3.9 2.1.9.8 0 1.6-.3 2.2-.8" stroke="#E1F5FE" stroke-width="1" stroke-linecap="round"/><path d="M15.8 7.3c-.5 0-.9.4-.9.9 0 1 .9 2.1 2 3.8 1.1-1.7 2-2.8 2-3.8 0-.5-.4-.9-.9-.9s-.9.4-.9.9c0-.5-.4-.9-.9-.9Z" fill="url(#t1Flag)" stroke="#F57C00" stroke-width="0.8" stroke-linecap="round"/><circle cx="16.9" cy="8.1" r="0.55" fill="#6D4C41"/></svg>`,
          type: 'good',
          description: 'Pa\u00eds con demanda y buen pago',
          tooltip: 'Pa\u00eds con demanda y capital',
        },
        'Window shopper': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wsScope" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ECEFF1"/><stop offset="100%" stop-color="#CFD8DC"/></linearGradient></defs><rect x="4" y="8" width="7" height="10" rx="3.5" fill="url(#wsScope)" stroke="#37474F" stroke-width="1.5"/><rect x="13" y="8" width="7" height="10" rx="3.5" fill="url(#wsScope)" stroke="#37474F" stroke-width="1.5"/><rect x="10" y="11" width="4" height="3" fill="#546E7A" rx="0.5"/><circle cx="7.5" cy="13" r="2.5" fill="#90CAF9" opacity="0.3"/><circle cx="7.5" cy="13" r="1.8" fill="#42A5F5"/><circle cx="16.5" cy="13" r="2.5" fill="#90CAF9" opacity="0.3"/><circle cx="16.5" cy="13" r="1.8" fill="#42A5F5"/><circle cx="7.8" cy="12.5" r="0.6" fill="#E3F2FD"/><circle cx="16.8" cy="12.5" r="0.6" fill="#E3F2FD"/></svg>`,
          type: 'bad',
          description: 'Hire rate menor a 65% con varios posts; mira m\u00e1s de lo que contrata',
        },
        Cheapskate: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="csBody" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFF3E0"/><stop offset="100%" stop-color="#FFE0B2"/></linearGradient></defs><path d="M4 10.5c0-1.1.9-2 2-2h9c1.4 0 2.5 1.1 2.5 2.5v4c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-4.5Z" fill="url(#csBody)" stroke="#F57F17" stroke-width="1.2" stroke-linejoin="round"/><path d="M7.2 9c0-.6.5-1 1-1h6.5c.6 0 1 .4 1 1v.5h-8.5V9Z" fill="#FFCC80" stroke="#F57F17" stroke-width="1.1"/><path d="M5.5 12.5h2.2c.5 0 .9.4.9.9v.2c0 .5-.4.9-.9.9H5.5" stroke="#F57F17" stroke-width="1.1" stroke-linecap="round"/><circle cx="15.8" cy="12.5" r="1.1" fill="#FFF" stroke="#F57F17" stroke-width="1.1"/><path d="M9 15.5c-.3.6-.8 1-1.5 1-.7 0-1.2-.4-1.5-1" stroke="#F57F17" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'Pago menor al promedio menor $100 fixed o $6/hora',
        },
        'Ghost job': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 18c0 1.1-.9 2-2 2v-9c0-4 3-7 7-7s7 3 7 7v9c-1.1 0-2-.9-2-2 0 1.1-.9 2-2 2-.9 0-1.6-.6-1.9-1.4-.3.8-1 1.4-1.9 1.4-1.1 0-2-.9-2-2Z" fill="#ECEFF1" stroke="#607D8B" stroke-width="1.2" stroke-linejoin="round"/><circle cx="10" cy="11" r="1" fill="#263238"/><circle cx="14" cy="11" r="1" fill="#263238"/><path d="M10 14c.5.4 1.1.6 2 .6.9 0 1.5-.2 2-.6" stroke="#455A64" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'No visto en m\u00e1s de 48h; probablemente abandonado',
        },
        'Dead post': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="5" width="12" height="15" rx="3" fill="#CFD8DC" stroke="#455A64" stroke-width="1.2"/><rect x="9.5" y="3" width="5" height="3.5" rx="1" fill="#B0BEC5" stroke="#455A64" stroke-width="1.1"/><circle cx="10" cy="11" r="0.9" fill="#263238"/><circle cx="14" cy="11" r="0.9" fill="#263238"/><path d="M10 14.5c.6.4 1.3.6 2 .6.7 0 1.4-.2 2-.6" stroke="#37474F" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '50+ propuestas, 0 entrevistas y +2 d\u00edas; post muerto',
        },
        'Shortlisting': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="slClip" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF8E1"/><stop offset="100%" stop-color="#FFECB3"/></linearGradient></defs><rect x="5" y="3" width="14" height="18" rx="2" fill="url(#slClip)" stroke="#FFA000" stroke-width="1.2"/><path d="M8 7h8M8 10h8M8 13h5" stroke="#FF8F00" stroke-width="1.2" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="#FFC107" stroke="#FF8F00" stroke-width="1.1"/><path d="M14.5 16l1 1 2-2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          type: 'neutral',
          description: 'Cliente en proceso de shortlisting; hay entrevistas activas pero el post est\u00e1 pausado',
        },
        'Stagnant job': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="stWater" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#E0E0E0"/><stop offset="100%" stop-color="#9E9E9E"/></linearGradient></defs><ellipse cx="12" cy="15" rx="8" ry="4" fill="url(#stWater)" stroke="#616161" stroke-width="1.1"/><path d="M4 15v-4c0-4.4 3.6-8 8-8s8 3.6 8 8v4" stroke="#757575" stroke-width="1.2"/><path d="M8 12h8" stroke="#9E9E9E" stroke-width="1" stroke-dasharray="2 2"/><path d="M9 10h6" stroke="#BDBDBD" stroke-width="0.8" stroke-dasharray="1.5 1.5"/><circle cx="12" cy="7" r="1.5" fill="#BDBDBD"/></svg>`,
          type: 'bad',
          description: 'Sin cambios en las m\u00e9tricas durante 7+ d\u00edas; el cliente parece haber abandonado',
        },
        'New client': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="16" height="14" rx="3" fill="#E3F2FD" stroke="#1E88E5" stroke-width="1.2"/><text x="12" y="15" text-anchor="middle" fill="#1E88E5" font-size="8" font-family="Inter, Arial" font-weight="700">NEW</text></svg>`,
          type: 'neutral',
          description: 'Cliente nuevo sin historial todav\u00eda',
        },
        'Team builder': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="tb2Skin" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE0B2"/><stop offset="100%" stop-color="#FFB74D"/></linearGradient><linearGradient id="tb2Shirt" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#BBDEFB"/><stop offset="100%" stop-color="#64B5F6"/></linearGradient></defs><circle cx="12" cy="7" r="3" fill="url(#tb2Skin)" stroke="#F57C00" stroke-width="1.1"/><path d="M9 13c0-1.7 1.3-3 3-3s3 1.3 3 3v4.5c0 .8-.7 1.5-1.5 1.5h-3c-.8 0-1.5-.7-1.5-1.5V13Z" fill="url(#tb2Shirt)" stroke="#1E88E5" stroke-width="1.1"/><path d="M14.5 12.5c.8-.6 1.8-.5 2.6.1l.6.5c.7.6.8 1.6.2 2.3-.6.7-1.6.8-2.3.2l-.3-.2" fill="url(#tb2Skin)" stroke="#F57C00" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 12.5c-.8-.6-1.8-.5-2.6.1l-.6.5c-.7.6-.8 1.6-.2 2.3.6.7 1.6.8 2.3.2l.3-.2" fill="url(#tb2Skin)" stroke="#F57C00" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.6 9.2c0 .9-.7 1.6-1.6 1.6-.9 0-1.6-.7-1.6-1.6" stroke="#F57C00" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'good',
          description: 'Recontrata, m\u00e1s de 1.5 hires por cada job',
        },
        'Boost it!': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="biBtn2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#48E1FF"/><stop offset="100%" stop-color="#1BA1F2"/></linearGradient><linearGradient id="biFlash2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFDE7"/><stop offset="100%" stop-color="#FFE082"/></linearGradient></defs><rect x="3" y="7" width="18" height="10" rx="5" fill="url(#biBtn2)" stroke="#0D8BD6" stroke-width="1.2"/><path d="M11.6 7.8 9.4 12.6h2l-.7 3.5 3.5-4.4H12.3l1.1-3.9Z" fill="url(#biFlash2)" stroke="#F9A825" stroke-width="0.9" stroke-linejoin="round"/><path d="M7 12h2.2" stroke="#E1F5FE" stroke-width="1.2" stroke-linecap="round"/><path d="M15 12h2.2" stroke="#E1F5FE" stroke-width="1.2" stroke-linecap="round"/><path d="M7 12c-.1-.6.3-1.2.8-1.7" stroke="#B3E5FC" stroke-width="0.9" stroke-linecap="round"/><path d="M17.2 12c.1-.6-.3-1.2-.8-1.7" stroke="#B3E5FC" stroke-width="0.9" stroke-linecap="round"/></svg>`,
          type: 'good',
          description: 'Cliente valioso con alta competencia pero puedes destacar',
        },
        'Toxic client': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3 21 19H3L12 3Z" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.2"/><path d="M12 10.5v3.5" stroke="#D32F2F" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="16.5" r="0.9" fill="#D32F2F"/></svg>`,
          type: 'bad',
          tooltipTitle:
            this.language === 'es'
              ? 'Riesgo de mala experiencia' : 'Client Feedback Risk',
          description: this.language === 'es'
            ? 'Este cliente suele recibir valoraciones bajas o tiene historial de reseñas muy corto.' : 'This client has low feedback quality or a very short review history.',
        },
        'Crowded room': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="crHead1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFECB3"/><stop offset="100%" stop-color="#FBC02D"/></linearGradient><linearGradient id="crHead2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE0B2"/><stop offset="100%" stop-color="#FFB74D"/></linearGradient><linearGradient id="crHead3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE082"/><stop offset="100%" stop-color="#FFCA28"/></linearGradient></defs><circle cx="8" cy="11.5" r="3" fill="url(#crHead1)" stroke="#F9A825" stroke-width="1.1"/><circle cx="13.5" cy="10" r="3" fill="url(#crHead2)" stroke="#FB8C00" stroke-width="1.1"/><circle cx="16.5" cy="14" r="3" fill="url(#crHead3)" stroke="#F57C00" stroke-width="1.1"/><path d="M6.5 15.5c-.2.8-.7 1.3-1.5 1.3-.5 0-1-.2-1.3-.6" stroke="#F57F17" stroke-width="1" stroke-linecap="round"/><path d="M12 13c-.2.8-.7 1.3-1.5 1.3-.6 0-1.1-.3-1.4-.7" stroke="#F57F17" stroke-width="1" stroke-linecap="round"/><path d="M15.5 17c-.2.8-.7 1.3-1.5 1.3-.6 0-1.1-.3-1.4-.7" stroke="#F57F17" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'M\u00e1s de 7 entrevistando; competencia alta',
        },
        Spammer: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="6" width="17" height="12" rx="2" fill="#E3F2FD" stroke="#1E88E5" stroke-width="1.2"/><path d="M4.5 7.5 12 12l7.5-4.5" stroke="#1E88E5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          type: 'bad',
          description: 'Invitaciones mayores a 15',
        },
        SOS: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#FFFFFF">SOS</text></svg>`,
          type: 'neutral',
          description: 'Cliente est\u00e1 desesperado por contratar',
        },
        'Time Waster': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="twGlass" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF3E0"/><stop offset="100%" stop-color="#FFE0B2"/></linearGradient></defs><path d="M8 4.5h8" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M8 19.5h8" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M9 4.5c0 1.8 1 3.1 2.2 4l1.6 1.2c.5.4.5 1.2 0 1.6L11.2 12c-1.3.9-2.2 2.3-2.2 4v1.5" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M15 4.5c0 1.8-1 3.1-2.2 4L11.2 9.7c-.5.4-.5 1.2 0 1.6l1.6 1.2c1.3.9 2.2 2.3 2.2 4v1.5" stroke="#F57C00" stroke-width="1.2" stroke-linecap="round"/><path d="M10 9.5h4" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><path d="M10 14.5h4" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><rect x="5" y="9" width="3" height="6" rx="1.2" fill="#FFE082" stroke="#FB8C00" stroke-width="1.1"/><path d="M6.5 10.2v3.6" stroke="#F57C00" stroke-width="0.9" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'Entrevista 40%+ pero hire rate 35-50%; habla mucho, contrata poco',
        },
        Complot: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cpRed" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFCDD2"/><stop offset="100%" stop-color="#E53935"/></linearGradient><linearGradient id="cpBlue" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#BBDEFB"/><stop offset="100%" stop-color="#1E88E5"/></linearGradient></defs><path d="M4.2 9.5c0-1 .8-1.8 1.8-1.8h5c1 0 1.8.8 1.8 1.8v5.8c0 1.5-1.8 2.3-3 1.3l-.9-.7c-.45-.4-1.15-.4-1.6 0l-.9.7c-1.2 1-3 .2-3-1.3V9.5Z" fill="url(#cpRed)" stroke="#B71C1C" stroke-width="1.1" stroke-linejoin="round"/><path d="M11.3 6c0-1 .8-1.8 1.8-1.8h5c1 0 1.8.8 1.8 1.8v5.9c0 1.5-1.8 2.3-3 1.3l-.9-.7c-.45-.4-1.15-.4-1.6 0l-.9.7c-1.2 1-3 .2-3-1.3V6Z" fill="url(#cpBlue)" stroke="#0D47A1" stroke-width="1.1" stroke-linejoin="round"/><path d="M7 11.5c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M9.7 11.5c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M6.6 12.7c-.35.4-.45.9-.2 1.3.2.35.55.55.96.55.16 0 .32-.02.47-.07" stroke="#1976D2" stroke-width=".9" stroke-linecap="round"/><path d="M7.4 14.2c.48-.4 1.06-.6 1.95-.6.9 0 1.47.2 1.95.6" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M14 9.3c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/><path d="M16.7 9.3c.14.32.4.55.72.55.33 0 .6-.23.74-.55" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/><path d="M14.4 11.6c.55.5 1.25.72 2.1.72.85 0 1.55-.22 2.1-.72" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/><path d="M12.2 7.2c.34.2.66.5.93.9" stroke="#B71C1C" stroke-width="1" stroke-linecap="round"/><path d="M17.4 5.9c.32.1.63.32.94.62" stroke="#0D47A1" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '20+ propuestas, 1 entrevista y 0 invites: probable favorito oculto',
        },
        Ojo: {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#E0E0E0" stop-opacity="0.6"/></radialGradient></defs><ellipse cx="32" cy="32" rx="22" ry="14" fill="url(#eyeGlow)" stroke="#212121" stroke-width="2"/><circle cx="32" cy="32" r="9" fill="#FFFFFF" stroke="#111111" stroke-width="2"/><circle cx="32" cy="32" r="5" fill="#111111"/><circle cx="30" cy="30" r="1.5" fill="#FFFFFF" opacity="0.9"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Señal de feedback reciente' : 'Recent Feedback Signal',
          description: this.language === 'es'
            ? 'Detecta ratings que el cliente dejó a freelancers en su historial reciente cuando son de 4.0/5 o menos.'
            : 'Flags ratings the client gave freelancers in recent history when they are 4.0/5 or lower.',
        },
        'Data Harvesting': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dhShield" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFEBEE"/><stop offset="100%" stop-color="#FFCDD2"/></linearGradient></defs><path d="M12 3 6 5.5v5.4c0 3.4 2.5 6.5 6 7.6 3.5-1.1 6-4.2 6-7.6V5.5L12 3Z" fill="url(#dhShield)" stroke="#C62828" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 9.5c0-.8.6-1.5 1.4-1.5h3.2c.8 0 1.4.7 1.4 1.5 0 .6-.3 1.1-.8 1.3l-2.2 1c-.3.1-.5.4-.5.7v.5" stroke="#C62828" stroke-width="1.1" stroke-linecap="round"/><circle cx="12" cy="15.2" r="0.95" fill="#C62828"/><path d="M8.3 7.5c.3-.9 1-1.5 1.9-1.5h3.6c.9 0 1.6.6 1.9 1.5" stroke="#E57373" stroke-width="1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '0-1 hires, hire rate <25%, entrevista 35%+ y cuenta <6 meses; posible recolecci\u00f3n de datos/estafa',
        },
        'Perpetual Posting': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="3.5" width="12" height="17" rx="3" fill="#FFF3E0" stroke="#FB8C00" stroke-width="1.2"/><path d="M9 7h6" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><path d="M9 9h6" stroke="#FB8C00" stroke-width="1.1" stroke-linecap="round"/><path d="M9 13.5 15 17" stroke="#EF6C00" stroke-width="1.3" stroke-linecap="round"/><path d="M15 13.5 9 17" stroke="#EF6C00" stroke-width="1.3" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: 'Publicado hace m\u00e1s de 7 d\u00edas; baja urgencia',
        },
        'Serial Poster': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4" width="10" height="16" rx="2" fill="#ECEFF1" stroke="#37474F" stroke-width="1.2"/><rect x="9" y="6.5" width="8" height="13" rx="2" fill="#CFD8DC" stroke="#455A64" stroke-width="1.1"/><path d="M8.5 10h6.5M8.5 13h6.5M8.5 16h6.5" stroke="#546E7A" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          description: '5+ jobs y hire rate <30%; publica mucho, contrata poco',
        },
        'Off-platform request': {
          icon: '\u26D4',
          type: 'bad',
          description: 'Pide mover la conversaci\u00f3n fuera de Upwork',
        },
        'External payment risk': {
          icon: '\u26A0\uFE0F',
          type: 'bad',
          description: 'Solicita pagos externos, crypto, gift cards o compra de equipos',
        },
        'Free work request': {
          icon: '\uD83E\uDDEA',
          type: 'bad',
          description: 'Solicita prueba gratuita o trabajo sin pagar',
        },
        'Too good to be true': {
          icon: '\uD83C\uDFA3',
          type: 'bad',
          description: 'Pago inusualmente alto para tarea simple con poco historial',
        },
        'First Job $2K+ Scam Risk': {
          icon: '🚨',
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Posible estafa' : 'Possible Scam',
          description: this.language === 'es'
            ? 'Cliente nuevo sin historial verificable, pago no verificado y oferta alta (+$2k) en su primer trabajo.'
            : 'New client with no verifiable history, unverified payment, and a high first-job budget (>$2k).',
        },

        'Possible client names': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.8" y="4.2" width="16.4" height="15.6" rx="3" fill="#E8EAF6" stroke="#3949AB" stroke-width="1.2"/><path d="M7.2 9.2h9.6M7.2 12.1h5.1" stroke="#3949AB" stroke-width="1.1" stroke-linecap="round"/><circle cx="14.9" cy="14.8" r="3.3" fill="#C5CAE9" stroke="#3949AB" stroke-width="1.1"/><path d="M16.8 16.7 18.5 18.4" stroke="#303F9F" stroke-width="1.1" stroke-linecap="round"/><path d="M14.9 13.7v2.2M13.8 14.8h2.2" stroke="#303F9F" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'neutral',
          tooltipTitle: this.language === 'es' ? 'Posible nombre del cliente' : 'Possible Client Name',
          description: this.t('possibleNamesNoMatch'),
        },
        'Niche Avg/hr': {
          icon: '\uD83D\uDCB5',
          type: 'neutral',
          tooltipTitle: this.t('supportAvgBadge'),
          description: this.t('supportAvgUnavailable'),
        },
        'Skills match': {
          icon: '\uD83E\uDDE9',
          type: 'neutral',
          tooltipTitle: this.t('skillsMatchBadge'),
          description: this.t('skillsNeedProfile'),
        },
        'Scope Monster': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="3" fill="#FFEBEE" stroke="#C62828" stroke-width="1.2"/><path d="M8 8h8M8 11h8M8 14h8" stroke="#D32F2F" stroke-width="1.1" stroke-linecap="round"/><path d="M9 17c1.2-.7 2-.9 3-.9s1.8.2 3 .9" stroke="#B71C1C" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Alcance Difuso' : 'Scope Too Broad',
          description: 'Pide demasiados roles en un solo job; aumenta riesgo de scope creep y retrabajo.',
        },
        'Free Consultant': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4.5" width="16" height="15" rx="3" fill="#FFF8E1" stroke="#F57F17" stroke-width="1.2"/><path d="M8 9h8M8 12h6" stroke="#F9A825" stroke-width="1.1" stroke-linecap="round"/><path d="M12 16.5 10.5 15l-1.7 1.1.6-2-1.6-1.2 2-.1.7-1.9.7 1.9 2 .1-1.6 1.2.6 2L12 16.5Z" fill="#FFB300" stroke="#F57F17" stroke-width="0.9" stroke-linejoin="round"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Consultor\u00eda Gratis' : 'Free Consulting Ask',
          description: 'Pide estrategia o diagn\u00f3stico completo antes de contratar; riesgo de trabajo no pagado.',
        },
        'Silent History': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="5" width="16" height="14" rx="3" fill="#ECEFF1" stroke="#455A64" stroke-width="1.2"/><path d="M8 10h8M8 13h5" stroke="#607D8B" stroke-width="1.1" stroke-linecap="round"/><path d="M15.8 8.8c1.4 0 2.5 1.2 2.5 2.6s-1.1 2.6-2.5 2.6c-1.3 0-2.4-1-2.5-2.3" stroke="#37474F" stroke-width="1.1" stroke-linecap="round"/><path d="M14.2 10.4 17.3 13.3" stroke="#37474F" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Historial Opaco' : 'Low-Trace History',
          description: 'Tiene actividad hist\u00f3rica, pero casi sin feedback visible; reduce confianza en el historial.',
        },
        'Budget Mismatch': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="7" width="16" height="10" rx="3" fill="#FFEBEE" stroke="#C62828" stroke-width="1.2"/><path d="M7 12h10" stroke="#C62828" stroke-width="1.2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="#FFCDD2" stroke="#B71C1C" stroke-width="1"/></svg>`,
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Presupuesto Desalineado' : 'Budget Mismatch',
          description: 'Pide nivel experto con presupuesto bajo; menor probabilidad de cierre justo.',
        },
        'Clear Brief': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4.5" y="3.8" width="15" height="16.4" rx="2.5" fill="#E8F5E9" stroke="#2E7D32" stroke-width="1.2"/><path d="M8 8h8M8 11h6M8 14h5" stroke="#2E7D32" stroke-width="1.1" stroke-linecap="round"/><circle cx="16.5" cy="16" r="3.2" fill="#A5D6A7" stroke="#2E7D32" stroke-width="1.1"/><path d="M15.2 16.1 16.3 17.2 18 15.4" stroke="#1B5E20" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
          type: 'good',
          tooltipTitle: this.language === 'es' ? 'Brief Claro' : 'Clear Brief',
          description: 'Define entregables y fecha objetivo; facilita ejecuci\u00f3n y reduce ambig\u00fcedad.',
        },
        'Milestone Friendly': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 17.5h16" stroke="#1E88E5" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="17.5" r="2" fill="#BBDEFB" stroke="#1E88E5" stroke-width="1.1"/><circle cx="12" cy="12.5" r="2" fill="#90CAF9" stroke="#1E88E5" stroke-width="1.1"/><circle cx="18" cy="8.5" r="2" fill="#64B5F6" stroke="#1E88E5" stroke-width="1.1"/><path d="M7.5 16.2 10.5 13.8M13.5 11.2 16.5 9.8" stroke="#1565C0" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'good',
          tooltipTitle: this.language === 'es' ? 'Trabajo por Hitos' : 'Milestone Friendly',
          description: 'Acepta fases o pagos por etapa; mejora control de alcance y cobro.',
        },
        'Professional Tone': {
          iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4.5" width="14" height="15" rx="3" fill="#E3F2FD" stroke="#1565C0" stroke-width="1.2"/><path d="M9 9.2h6M9 12h6M9 14.8h4" stroke="#1565C0" stroke-width="1.1" stroke-linecap="round"/><path d="M15.4 6.8 17.2 8.6" stroke="#0D47A1" stroke-width="1.1" stroke-linecap="round"/><path d="M17.2 6.8 15.4 8.6" stroke="#0D47A1" stroke-width="1.1" stroke-linecap="round"/></svg>`,
          type: 'good',
          tooltipTitle: this.language === 'es' ? 'Comunicaci\u00f3n Profesional' : 'Professional Tone',
          description: 'Describe necesidad de forma espec\u00edfica y profesional; suele mejorar colaboraci\u00f3n.',
        },
        'Poco esfuerzo': {
          icon: '🧩',
          type: 'bad',
          tooltipTitle: this.language === 'es' ? 'Baja calidad de brief' : 'Low-effort brief',
          description: this.language === 'es'
            ? 'Descripción plantilla o de bajo esfuerzo; aumenta ambigüedad y riesgo de retrabajo.'
            : 'Template-like or low-effort brief; tends to increase ambiguity and rework risk.',
        },
      };

      const normalizeBadgeKey = (value) =>
        String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s$+.-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      const canonicalMap = {};
      Object.keys(configs).forEach((name) => {
        canonicalMap[normalizeBadgeKey(name)] = name;
      });
      canonicalMap['off platform request'] = 'Off-platform request';
      canonicalMap['off platform contact request'] = 'Off-platform request';
      canonicalMap['first job $2k+ scam risk'] = 'First Job $2K+ Scam Risk';
      canonicalMap['first-job $2k+ scam risk'] = 'First Job $2K+ Scam Risk';
      canonicalMap['poco esfuerzo'] = 'Poco esfuerzo';

      const sourceBadge = String(badge || '').trim();
      const sourceNormalized = normalizeBadgeKey(sourceBadge);
      const resolvedBadge = canonicalMap[sourceNormalized] || sourceBadge;
      const mappedByAlias = resolvedBadge !== sourceBadge;
      const isUnknownBadge = !configs[resolvedBadge];

      if (resolvedBadge === 'Possible client names') {
        const names = Array.isArray(rawData?.possibleClientNames)
          ? rawData.possibleClientNames
            .filter((name) => typeof name === 'string' && name.trim().length > 0)
            .slice(0, 5)
          : [];
        if (names.length > 0) {
          configs['Possible client names'].description = this.t('possibleNamesDetected').replace('{names}', names.join(', '));
        }
      }
      if (resolvedBadge === 'Niche Avg/hr') {
        const supportBadge = rawData?.supportAvgBadge || null;
        const matches = Array.isArray(supportBadge?.matches) ? supportBadge.matches : [];
        const matchesText = matches
          .slice(0, 5)
          .map((entry, index) => `${index + 1}) ${entry.title} — $${Number(entry.rate).toFixed(2)}/hr`)
          .join('\n');
        configs['Niche Avg/hr'].description = matchesText || this.t('supportAvgUnavailable');
      }
      if (resolvedBadge === 'Skills match') {
        const match = rawData?.skillsMatch || null;
        if (!match || !match.profileSkillsLoaded) {
          configs['Skills match'].description = this.t('skillsNeedProfile');
        } else {
          const matchedList = Array.isArray(match.matchedSkills) ? match.matchedSkills : [];
          const missingList = Array.isArray(match.missingSkills) ? match.missingSkills : [];
          const matchedText = matchedList.length ? matchedList.join(', ') : '';
          const missingText = missingList.length ? missingList.join(', ') : '';
          configs['Skills match'].description = this.language === 'es'
            ? `Match ${matchedList.length}: ${matchedText}\nFaltan ${missingList.length}: ${missingText}`
            : `Match ${matchedList.length}: ${matchedText}\nMissing ${missingList.length}: ${missingText}`;
        }
      }
      const selected = configs[resolvedBadge] || { icon: '\u25B9', type: 'neutral', description: sourceBadge };
      if (this.language === 'en') {
        const enDescriptions = {
          'Gold standard': 'Top signal: strong hire rate, >$10k spent and 4.8+ rating',
          'Whale client': 'Strong budget: >$10k total or >$1k per hire',
          Sociable: 'Interviews a lot and hires reliably',
          'Elite hire rate': 'Hire rate is 90% or higher',
          'Fresh off the oven': 'Posted less than 1 hour ago',
          'Tier 1 country': 'Client is from a Tier 1 market',
          'Window shopper': 'Low hire rate with multiple posts',
          Cheapskate: 'Low average pay history',
          'Ghost job': 'Not viewed in 48h and no active interviews',
          'Dead post': 'Old post, high proposals, no interviews',
          Shortlisting: 'Client paused but still interviewing',
          'Stagnant job': 'No metric changes for 7+ days',
          'New client': 'New client with little history',
          'Team builder': 'Often hires multiple freelancers per post',
          'Boost it!': 'Good job but crowded. Boost can help.',
          'Toxic client': 'Client has low feedback quality or very short review history.',
          'Crowded room': 'More than 7 interviewing',
          Spammer: 'More than 15 invites sent',
          SOS: 'Urgent hiring signals detected',
          'Time Waster': 'High interview ratio but low conversion',
          Complot: 'High proposals and odd interview/invite pattern',
          Ojo: 'Recent ratings the client gave freelancers include values of 4.0/5 or lower.',
          'First Job $2K+ Scam Risk': 'New unverified client with no history and a first job budget above $2k.',
          'Data Harvesting': 'Possible data-harvest or scam pattern',
          'Perpetual Posting': 'Open for over 7 days with low urgency',
          'Serial Poster': 'Many posts, low hire rate',
          'Off-platform request': 'Requests communication outside Upwork',
          'External payment risk': 'Requests external payments or risky methods',
          'Free work request': 'Requests unpaid sample or free work',
          'Too good to be true': 'Very high pay for simple task and weak history',
          'Scope Monster': 'Requests too many disciplines in one job; higher scope-creep risk.',
          'Free Consultant': 'Asks for detailed strategy before hiring; unpaid work risk.',
          'Silent History': 'Shows activity but little visible feedback to validate quality.',
          'Budget Mismatch': 'Expert-level ask with weak budget signals; lower fit quality.',
          'Clear Brief': 'Defines deliverables and timeline; reduces ambiguity.',
          'Milestone Friendly': 'Accepts phased delivery or staged payments; lower execution risk.',
          'Professional Tone': 'Specific and professional request, usually easier to execute well.',
          'Niche Avg/hr': 'Niche hourly position vs feed benchmark (informational).',
        };
        if (enDescriptions[resolvedBadge]) {
          selected.description = enDescriptions[resolvedBadge];
        }
      }
      selected._badgeMeta = {
        sourceBadge,
        resolvedBadge,
        mappedByAlias,
        unknown: isUnknownBadge,
      };
      return selected;
    }})();




