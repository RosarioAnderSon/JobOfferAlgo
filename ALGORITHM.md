# 🎯 Anderson's Sniper Elite v4.6 — Hardcore Specs

Documentación oficial del algoritmo de scoring para filtrar trabajos de Upwork. Incluye insumos requeridos, kill switches, puntajes base (con lógica de densidad), penalizaciones tácticas, bonuses por badges buenos y badges clasificados.

## 1. Entradas requeridas (JobInput)

Los siguientes datos deben extraerse del contexto del trabajo (Sidebar/Job Detail):

*   **Dates:** `memberSince`, `postedAt`, `lastViewed`, `now` (default: current time).
*   **Client Stats:** `jobsPosted`, `paymentVerified`, `totalSpent` (USD), `totalHires`, `avgHourlyPaid` (USD/hr), `clientCountry`.
*   **Explicit Stats:** `hireRatePct` (Extracto literal "XX% hire rate", prioridad sobre cálculo manual).
*   **Rating:** `rating` (0.0–5.0), `reviewsCount`.
*   **Job Details:** `jobBudget` (USD, para cuentas nuevas), `descriptionLength` (chars).
*   **Activity:** `proposalCount` (bucket o int), `invitesSent`, `interviewing`.

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

*   Si `rating < 4.5` → **0 pts** (Toxic).
*   Si `reviewsCount < 3` → **80 pts** (Capped por falta de data, aunque sea 5.0).
*   Si `rating ≥ 4.8` (y reviews ≥ 3) → **100 pts**.
*   Si `rating 4.5 – 4.7` (y reviews ≥ 3) → **70 pts**.

### D. Activity (10%) - "Intensidad"

*   **< 1 hora:** 100 pts (Super Hot).
*   **< 3 horas:** 80 pts.
*   **< 24 horas:** 70 pts.
*   **< 48 horas:** 60 pts.
*   **≥ 48 horas:** 0 pts (Ghost).

### E. Proposals (10%) - "Competencia"

*   **< 5:** 100 pts.
*   **5 – 10:** 85 pts.
*   **10 – 20:** 60 pts.
*   **20 – 50:** 30 pts.
*   **50+:** 0 pts.

### F. Payment Verification (5%)

*   **Verified:** 100 pts.
*   **Unverified:** 0 pts.

### G. Jobs Posted (5%)

*   **10+:** 100 pts.
*   **1 – 9:** 80 pts.
*   **0:** 50 pts.

**Fórmula Base:** `Σ (ComponentScore * Peso)`

***

## 4. Penalizaciones Tácticas (Restas) — v4.6

Valores ajustados; restan puntos del `BaseScore`.

1.  **Window shopper (penalización):** `hireRate < 65%` y `jobsPosted > 3` → **-10.0 pts**. (Ghosting = peor pérdida de tiempo)
2.  **The Forever Looking:** `postedAt > 4 days` **AND** `interviewing == 0` → **-7.5 pts**. (Trabajo muerto)
3.  **The Nepo-Hire:** `invitesSent == 1` **AND** `interviewing == 1` → **-7.5 pts**. (Ya eligió a alguien)
4.  **The Spammer:** `invitesSent > 15` → **-5.0 pts**. (Pesca de arrastre)
5.  **The Unverified Regular:** `paymentVerified == false` **AND** `jobsPosted > 1` → **-5.0 pts**. (Sin PMV, no es novato)
6.  **The Crowded Room:** `interviewing > 7` → **-2.5 pts**. (Competencia alta)
7.  **Cheapskate History:** `avgHourlyPaid > 0 && < $15` **OR** `avgSpendPerJob < $100` → **-10.0 pts**. (Paga poco, pero paga)
8.  **Lazy Description:** `descriptionLength < 100 chars` → **-2.5 pts**. (Señal de bajo esfuerzo)

***

## 5. Bonuses por Badges Buenos (Suma) — v4.6

Bonos suavizados; se suman al `BaseScore` y luego se clampa a 100.

*   🏅 **Gold standard**: **+5.0 pts** (Hire Rate > 70% AND Spend > $10k AND Rating > 4.8).
*   🚀 **Elite hire rate**: **+2.5 pts** (Hire Rate ≥ 90%).
*   🐋 **Whale client**: **+2.5 pts** (`totalSpent > $10k` **OR** `avgSpendPerJob > $1,000`).
*   🌍 **Tier 1 country**: **+2.5 pts** (País en lista Tier 1).
*   🔥 **Fresh off the oven**: **+2.5 pts** (Posted < 1 hora).
*   🏗️ **Team builder**: **0 pts** (solo informativo).
*   👶 **New client**: **0 pts** (JobsPosted == 0, si sobrevive kill switches).

**Límite:** `FinalScore = clamp(Base + Bonuses - Penalties, 0, 100)`.

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

*   🏅 **Gold standard**: Hire rate > 70% AND Total Spent > $10k AND Rating > 4.8. (**+5.0 pts**)
*   🚀 **Elite hire rate**: Hire Rate ≥ 90%. (**+2.5 pts**)
*   🐋 **Whale client**: TotalSpent > $10k **OR** Avg Spend > $1,000/job. (**+2.5 pts**)
*   🌍 **Tier 1 country**: País en lista Tier 1 (US, CA, UK, AU, DE, CH, SE, DK, NO, NL, SG, NZ). (**+2.5 pts**)
*   🔥 **Fresh off the oven**: Posted < 1 hour. (**+2.5 pts**)
*   🏗️ **Team builder**: TotalHires/JobsPosted > 1.5. (**0 pts**, informativo)
*   👶 **New client**: JobsPosted == 0 (sobrevive kill switches). (**0 pts**, informativo)
*   🚀 **Boost it!**: Score provisional (Base + Bonus − Penalty) ≥ 85 **AND** Proposals ≥ 10. (Badge de acción, no suma puntos)

### 🔴 Bad Badges (Red Flags)

*   👀 **Window shopper**: Hire Rate < **65%** (con > 3 jobs). (**-10.0 pts**)
*   📉 **Cheapskate**: Avg Hourly < $15 OR Avg Spend < $100. (**-10.0 pts**)
*   🎣 **Spammer**: Invites Sent > 15. (**-5.0 pts**)
*   🛑 **Crowded room**: Interviewing > 7. (**-2.5 pts**)
*   👻 **Ghost job**: Last Viewed > 48 horas. (**Kill-switch: score = 0**)
*   ☢️ **Toxic client**: Rating < 4.5. (**0 pts**, badge/alerta)

***

## 8. Notas de Implementación (Parser HTML)

*   **Hire Rate:** Priorizar extracción de regex `(\d+)%\s+hire\s+rate`.
*   **Avg Hourly:** Extraer de `data-qa="client-hourly-rate"` o texto regex `\$([\d.]+)\s*/hr\s*avg`.
*   **Spend:** Buscar cerca de "total spent" para evitar confundir con budget.
*   **Proposals:** Normalizar buckets ("Less than 5" → 4, "20 to 50" → 35).
*   **Country:** Extraer del bloque `data-test="client-country"` y comparar contra la lista Tier 1.
*   **Clamp:** Siempre `FinalScore = clamp(Base + Bonuses − Penalties, 0, 100)`.