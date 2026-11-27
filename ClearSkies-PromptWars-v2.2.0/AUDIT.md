# ClearSkies Engineering Audit — PromptWars upgrade

**Audit date:** 27 November 2026  
**Source inspected:** `ClearSkies-PromptWars-Upgrade (1)(1).zip`  
**Project release version:** 2.2.1  
**Scope:** source inspection, targeted implementation, Node tests, syntax checks and HTTP smoke/integration tests.

## Executive summary

The uploaded archive contained a working Node.js application with model-derived Open-Meteo/CAMS air-quality lookups, a deterministic household recommendation engine, optional server-side Gemini integration, indoor-air education and a transport-only impact calculator. It did **not** contain the household-wide three-scenario Digital Twin described in the handover.

The upgrade adds that missing Digital Twin, 30 named deterministic AI-guidance evaluation scenarios, stronger regression coverage and documentation. A positional-index defect in recommendation prioritisation and a null-AQI-to-zero validation defect were also found and fixed.

## Original baseline

- Archive entries: 30.
- Existing test run before modifications: **15 passed, 0 failed**.
- Existing household Digital Twin: **not present**.
- Existing calculation: transport comparison only; household electricity, total monthly household costs and budget-aware three-scenario modelling were absent.

## Implemented changes

### 1. Household Pollution Digital Twin

Added `public/js/household-twin.js` and a dedicated responsive interface in `public/index.html` / `public/css/styles.css`.

The model compares:
- Current household routine.
- Improved low-emission routine.
- Maximum practical low-emission routine.

It accepts household size, travelling members, monthly distance per traveller, scenario transport modes and occupancy, travel spend, monthly electricity consumption, tariff, editable grid factor, electricity reduction assumptions, improvement budget, separate current/improved/maximum-practical weekly outdoor activity minutes and optional user-entered AQI.

It reports transport tailpipe CO₂ and electricity operational CO₂ separately, their scoped combined operational total, electricity consumption and reduction percentage, travel spend, electricity bill, total monthly cost, change and reduction percentage versus baseline, and budget status. Budget status correctly compares only additional monthly cost against the entered improvement budget; cost-saving scenarios do not consume the budget.

### 2. Calculation and safety boundaries

- Transport passenger-kilometres use travelling household members × distance per traveller.
- Transport factors are allocated by the entered vehicle occupancy.
- Electricity emissions use user-entered kWh × user-editable grid factor.
- AQI and scenario-specific outdoor activity minutes are not included in carbon formulas.
- AQI category guidance is broad planning context only; a single AQI reading does not identify the cleanest hour or a personal safe exposure level.
- Personal exposure and inhaled dose are explicitly not calculated.
- Indoor-air actions are educational suggestions; indoor PM2.5 and filtration performance are not measured or calculated.
- The combined total is labelled operational, not lifecycle emissions.
- Input ranges and traveller count are validated; invalid combinations are rejected.
- Occupancy ceilings are checked by mode (two-wheeler 2, car 8, auto-rickshaw 6, bus 100, walking/cycling 1). These are simplified model guardrails, not claims about every vehicle configuration.

**Grid-factor limitation:** 0.675 kg CO₂/kWh is retained only as an editable provisional value inherited from the previous prototype. This release did not independently verify it against the latest official CEA publication. Users must verify and cite a current factor for formal reporting.

### 3. Recommendation-engine defect fixed

The original recommendation engine modified `items[3]` for severe AQI and `items[0]` for poor AQI. When a sensitive-group recommendation was inserted at the beginning, those positional references shifted and the wrong card received the severe-AQI override. The implementation now finds recommendation objects by stable title identity. Two regression tests cover this defect. Validation now preserves missing, null and empty AQI as unavailable while retaining a genuine numeric zero.

### 4. AI evaluation coverage

Added 30 named evaluation scenarios for deterministic household guidance, including:
- AQI missing, zero, moderate, poor, very poor and severe.
- Children, older adults and respiratory sensitivity.
- Multiple sensitive groups.
- Low and flexible budgets.
- Car, two-wheeler, auto, bus and mixed commutes.
- Morning, daytime, evening and variable schedules.
- Small and large households.
- Combined AQI and household-sensitivity cases.

These are deterministic guidance-engine tests, **not** a live Gemini model benchmark or an external competition evaluation.

### 5. Documentation

Updated README with the Digital Twin formulas, assumptions, Windows CMD setup, model limitations, data provenance caveats and test instructions.

## Validation results — v2.2.1

| Command | Result |
|---|---|
| `npm run check` | Passed after the v2.2.1 changes |
| `npm test` | **89 passed, 0 failed** (including new scenario activity, AQI separation, occupancy-boundary and rendered-interface integration assertions) |
| `npm run smoke` | Passed; service health and release version checked |
| `npm run test:coverage` | Not rerun for v2.2.1; previous v2.1.0 coverage numbers must not be treated as current |
| `npm ci` | Not rerun for this patch; package dependencies were not changed |
| Live Open-Meteo request | Not used as a release acceptance test |
| Live Gemini request | Not run; no user API key supplied |
| Browser automation / screen reader | Not run in this environment |

The earlier v2.1.0 run reported 81 passing tests. v2.2.1 includes the client input-guard and DOM-reference consistency check. Automated checks do not replace a real browser visual/interaction check.

## Security and privacy observations

Existing controls retained include server-side Gemini key handling, no permissive CORS, same-origin checks, security headers, bounded JSON request bodies, API rate limiting, upstream timeouts, input validation, and DOM `textContent` rendering for user-facing text.

Limitations:
- Rate limiting and cache are in-memory and per process.
- No shared-store protection for horizontally scaled deployments.
- No formal third-party dependency audit was run; the core runtime has no required third-party npm dependency.
- No external GitHub secret scan was run.
- Production TLS depends on the deployment platform or reverse proxy.
- Gemini output remains generative and should be reviewed for accuracy; fallback remains available.

## Remaining gaps before a high-stakes public launch

1. Verify and cite the current CEA grid-emission factor; replace the provisional default with a dated, sourced value.
2. Validate transport factors against primary and current sources; consider vehicle/fuel/region-specific factors and uncertainty ranges.
3. Add browser-level end-to-end testing on desktop and mobile.
4. Conduct manual keyboard, screen-reader and contrast testing.
5. Integrate official CPCB / State Pollution Control Board observations only through a validated, permitted feed. Current AQ data is Open-Meteo/CAMS model data, not official station data.
6. Consider time-of-day exposure planning only when appropriately resolved pollutant data and validated exposure methods are available.
7. Consider indoor sensors only with real device measurements and calibration metadata.

## Score and confidence

The previous user-provided evaluation was 94.13/100 (Code Quality 86, Security 98, Efficiency 100, Testing 98, Accessibility 99, Problem Statement Alignment 94).

No new competition evaluator was available, so **no new competition score is claimed**. The upgrade directly addresses the missing household-level scenario and impact explanation capabilities, but 99/100 cannot be guaranteed.

Confidence:
- Source archive inspection: high.
- Deterministic calculations and regression tests: high for tested input ranges.
- Live data correctness: not re-verified in this run.
- Gemini quality: not evaluated against a live model.
- Browser accessibility and visual behaviour: partial; automated source tests are not a substitute for manual testing.
