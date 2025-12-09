# 🎯 Anderson's Sniper Elite v4.7 — Hardcore Specs

Documentación oficial del algoritmo de scoring para filtrar trabajos de Upwork. Incluye insumos requeridos, kill switches, puntajes base (con lógica de densidad), penalizaciones tácticas (ahora todas restan **-1**) y bonuses (todas suman **+1**) más badges clasificados.

## 1. Entradas requeridas (JobInput)

Los siguientes datos deben extraerse del contexto del trabajo (Sidebar/Job Detail):

*   **Dates:** `memberSince`, `postedAt`, `lastViewed`, `now` (default: current time).
*   **Client Stats:** `jobsPosted`, `paymentVerified`, `totalSpent` (USD), `totalHires`, `avgHourlyPaid` (USD/hr), `clientCountry`.
*   **Explicit Stats:** `hireRatePct` (Extracto literal "XX% hire rate", prioridad sobre cálculo manual).
*   **Rating:** `rating` (0.0–5.0), `reviewsCount`.
*   **Job Details:** `jobTitle`, `descriptionText` (para detectar urgencia declarada), `jobBudget` (USD, para cuentas nuevas), `descriptionLength` (chars).
*   **Activity:** `proposalCount` (bucket o int), `invitesSent`, `unansweredInvites`, `interviewing`.

***

## 2. Kill Switches (Muerte Súbita)

Si alguna condición es `TRUE`, el `FinalScore` se fuerza a **0 (F)** inmediatamente.

1.  **Newbie Risk:** `memberSince < 5 months` **AND** (`paymentVerified == false` OR `jobsPosted == 0`).
2.  **Ghost Job:** `lastViewed > 48 hours` (2 días). *Endurecido de 7 a 2 días.*
3.  **Unverified & Broke:** `paymentVerified == false` **AND** `totalSpent == 0`.

***

## 3. Puntaje Base (Base Score)

Cálculo de componentes normalizados (0-100) ponderados.

### A. Hire Rate (30%) - "Densidad de Contratación"

*   **Fuente:** Usa `hireRatePct` (explícito) si existe; si no, calcula `(totalHires / jobsPosted) * 100`.
*   **Multiplicador de Confianza:**
    *   Jobs < 5: Score ajustado por **0.9x** (incertidumbre suave).
    *   Jobs ≥ 5: Score ajustado por **1.0x** (sin premio por volumen).
*   **Escala (sobre valor ajustado):**
    *   **≥ 90:** 100 pts.
    *   **70 – 89:** 85 pts.
    *   **50 – 69:** 50 pts.
    *   **< 50:** 0 pts.

### B. Spend / Avg Price (25%) - "Ticket Real"

*   **Cálculo:** `Avg = totalSpent / totalHires`.
    *   *Excepción:* Si `hires == 0` y `jobs < 3`, usar `jobBudget` como proxy.
*   **Escala:**
    *   **≥ $1,000:** 100 pts (Elite).
    *   **$500 – $999:** 90 pts (High).
    *   **$200 – $499:** 75 pts (Mid).
    *   **$1 – $199:** 20 pts (Low).
    *   **$0:** 0 pts.

### C. Rating (15%) - "Densidad de Reviews"

*   Si `rating < 4.4` → **0 pts** (Toxic).
*   Si `reviewsCount < 3` → **80 pts** (Capped por falta de data, aunque sea 5.0).
*   Si `rating ≥ 4.8` (y reviews ≥ 3) → **100 pts**.
*   Si `rating 4.4 – 4.7` (y reviews ≥ 3) → **70 pts**.

### D. Activity (10%) - "Intensidad" (interacción + frescura)

*   **A:** Post < 12h **y** interacción (view del cliente o interviewing) → 100 pts.
*   **B:** Post < 12h **sin** interacción → 85 pts.
*   **B:** Post < 24h (con o sin interacción; si hay interacción se mantiene B) → 85 pts.
*   **B:** Post ≥ 24h **con** interacción → 85 pts.
*   **F:** Post ≥ 24h **sin** interacción → 0 pts.

### E. Proposals (10%) - "Competencia"

*   **< 5:** 100 pts (A).
*   **5 – 10:** 85 pts (B).
*   **10 – 15:** 70 pts (C).
*   **> 15 – 50:** 0 pts (F).
*   **50+:** 0 pts (F).

### F. Payment Verification (5%)

*   **Verified:** 100 pts.
*   **Unverified:** 0 pts.

### G. Jobs Posted (5%)

*   **10+:** 100 pts.
*   **1 – 9:** 80 pts.
*   **0:** 50 pts.

**Fórmula Base:** `Σ (ComponentScore * Peso)`

***

## 4. Penalizaciones Tácticas (Restas) — v4.7

Todas restan **-1** al `BaseScore`:

1. **Window shopper:** `hireRate < 65%` y `jobsPosted > 3` (ghosting probable).
2. **The Forever Looking:** `postedAt > 4 days` **AND** `interviewing == 0` (trabajo muerto).
3. **Dead post (stale & crowded):** `postedAt >= 2 days` **AND** `interviewing == 0` **AND** `proposalCount >= 50`.
4. **The Nepo-Hire:** `invitesSent == 1` **AND** `interviewing == 1` (ya tiene elegido).
5. **The Spammer:** `invitesSent > 15` (pesca de arrastre). Si el título o body declaran urgencia (`Urgency/Urgent/Emergency/Urgencia/Emergencia`), no se aplica la penalización y se marca el badge **SOS**.
6. **The Unverified Regular:** `paymentVerified == false` **AND** `jobsPosted > 1`.
7. **The Crowded Room:** `interviewing > 7` (competencia muy alta).
8. **Cheapskate History:** `avgHourlyPaid > 0 && < $15` **OR** `avgSpendPerJob < $100`.
9. **Lazy Description:** `descriptionLength < 100 chars`.
10. **Complot:** `proposalCount >= 20` **AND** `interviewing == 1` **AND** `invitesSent == 0`.
11. **Serial Poster:** `jobsPosted >= 5` **AND** `hireRateByJobs < 30%` (hires/jobs).
12. **Perpetual Posting:** `postedAt > 7 days`.
13. **Time Waster:** `interviewing / proposals > 40%` **AND** `35% <= hireRate < 50%`.
14. **Data Harvesting:** `hires <= 1` **AND** `interviewing / proposals > 35%` **AND** `hireRate < 25%` **AND** `memberSince < 6 months`.

***

## 5. Bonuses por Badges Buenos (Suma) — v4.7

Todos los bonuses suman **+1** (clamp a 100):

* 🏅 **Gold standard**: Hire Rate > 70% **AND** Spend > $10k **AND** Rating > 4.8.
* 🚀 **Elite hire rate**: Hire Rate ≥ 90%.
* 🐋 **Whale client**: `totalSpent > $10k` **OR** `avgSpendPerJob > $1,000`.
* 🌍 **Tier 1 country**: País en lista Tier 1.
* 🔥 **Fresh off the oven**: Posted < 1 hora.
* 🆘 **SOS**: 0 pts (informativo). Detecta keywords de urgencia en título/body. Si hay invites altos, se usa **SOS** en lugar de penalizar Spammer.
* 🤝 **Sociable**: `interviewingRatio > 35%` **AND** `hireRate ≥ 80%` **AND** `rating ≥ 4.8`.
* 🏗️ **Team builder**: 0 pts (solo informativo, badge).
* 👶 **New client**: 0 pts (JobsPosted == 0, si sobrevive kill switches).
* 🚀 **Boost it!**: 0 pts (badge de acción cuando score provisional ≥ 85 y proposals ≥ 10).

**Nota sobre interviewingRatio:** `interviewing / (proposalCount + invitesSent − unansweredInvites)` si el denominador > 0; en caso contrario 0. Se usa para Sociable, Time Waster y Data Harvesting.

**Fórmula:** `FinalScore = clamp(Base + Bonuses - Penalties, 0, 100)`.

***

## 6. Grading Scale (Interpretación)

| Score | Grade | Significado |
| :--- | :--- | :--- |
| **97 – 100** | **A+** | 💎 Joya (Aplica YA) |
| **93 – 96** | **A** | 🔥 Excelente |
| **90 – 92** | **A-** | ✅ Muy Bueno |
| **87 – 89** | **B+** | 👍 Sólido |
| **80 – 86** | **B** | 🆗 Decente |
| **< 80** | **F** | 🗑️ Basura |

***

## 7. Badges Clasificados (Visuales)

### 🟢 Good Badges (Green Flags)

* 🏅 **Gold standard**: +1 (Hire rate > 70%, Spend > $10k, Rating > 4.8)
* 🚀 **Elite hire rate**: +1 (Hire rate ≥ 90%)
* 🐋 **Whale client**: +1 (TotalSpent > $10k **o** Avg Spend > $1k/job)
* 🌍 **Tier 1:** +1 (País con demanda y buen pago: US, CA, UK, AU, DE, CH, SE, DK, NO, NL, SG, NZ)
* 🔥 **Fresh off the oven**: +1 (Posted < 1h)
* 🆘 **SOS**: 0 pts (informativo; detecta keywords de urgencia y evita penalizar Spammer)
* 👁️ **Ojo**: -1 (red flag). Historial reciente con reviews ≤ 3; "con los reviews, puede haber algo ahí".
* 🏗️ **Team builder**: 0 pts (informativo, hires/job > 1.5) — ahora con emoji
* 👶 **New client**: 0 pts (JobsPosted == 0, si sobrevive kill switches) — ahora con emoji
* 🚀 **Boost it!**: 0 pts (acción cuando score provisional ≥ 85 y proposals ≥ 10)

### 🔴 Bad Badges (Red Flags)

* 👀 **Window shopper**: -1 (Hire rate < 65% con >3 jobs)
* 💀 **Dead post**: -1 (≥2 días, 0 interviewing, 50+ proposals)
* 🎭 **Complot**: -1 (20+ proposals, 1 interview, 0 invites)
* 💀 **Serial Poster**: -1 (`jobsPosted >= 5` y `hireRateByJobs < 30%`)
* 🤡 **Perpetual Posting**: -1 (`postedAt > 7 días`)
* 📉 **Cheapskate**: -1 (Avg Hourly < $6 **o** Avg Spend < $100)
* 🎣 **Spammer**: -1 (Invites Sent > 15; se reemplaza por **SOS** si hay urgencia declarada)
* 👁️ **Ojo**: -1 (Historial reciente con reviews ≤ 3; con los reviews, puede haber algo ahí)
* 🛑 **Crowded room**: -1 (Interviewing > 7)
* 👻 **Ghost job**: Kill-switch (Last Viewed > 48h)
* ☢️ **Toxic client**: 0 pts (badge/alerta)

**Prioridad (mutuamente excluyentes entre sí):** Sociable > Data Harvesting > Time Waster.

***

## 8. Notas de Implementación (Parser HTML)

*   **Hire Rate:** Priorizar extracción de regex `(\d+)%\s+hire\s+rate`.
*   **Avg Hourly:** Extraer de `data-qa="client-hourly-rate"` o texto regex `\$([\d.]+)\s*/hr\s*avg`.
*   **Spend:** Buscar cerca de "total spent" para evitar confundir con budget.
*   **Proposals:** Normalizar buckets ("Less than 5" → 4, "20 to 50" → 35).
*   **Country:** Extraer del bloque `data-test="client-country"` y comparar contra la lista Tier 1.
*   **SOS/Urgencia:** Capturar `jobTitle` (`[data-test="job-title"]`/`h1`) y `descriptionText` para buscar keywords "Urgency/Urgent/Emergency/Urgencia/Emergencia" y decidir si se neutraliza Spammer (badge **SOS**).
*   **Clamp:** Siempre `FinalScore = clamp(Base + Bonuses − Penalties, 0, 100)`.