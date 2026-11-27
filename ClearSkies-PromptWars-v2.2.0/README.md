# ClearSkies — AI Clean Air Companion

**Breathe Smarter. Live Lighter.**

ClearSkies helps households in India make practical decisions about outdoor air-quality conditions, indoor particle sources, everyday travel and transparent transport-emissions estimates.

This release is a lightweight Node.js application with server-side Gemini integration, modelled air-quality lookups, a deterministic recommendation engine, transparent transport calculations, a household pollution Digital Twin, accessibility features and automated tests.

## Product capabilities

- Household profile: city/district, household size, budget, commute, schedule, home type and sensitive household groups.
- Outdoor air-quality lookup using Open-Meteo's CAMS model forecast.
- Pollutant snapshot for PM2.5, PM10, NO₂, SO₂, CO and O₃ when supplied by the provider.
- Clearly labelled model-derived CPCB-breakpoint indicator; not represented as an official CPCB station AQI.
- Personalised priority actions and local fallback assistant.
- Optional server-side Gemini assistant.
- Transport emissions scenario calculator with documented factors and visible assumptions.
- Household Pollution Digital Twin comparing current, improved and maximum practical monthly routines across travel, household electricity, scenario-specific outdoor activity plans, indoor-air actions, costs and a user-entered improvement budget.
- Comparable side-by-side outputs for transport tailpipe CO₂, electricity operational CO₂, scoped combined operational CO₂, electricity use, travel spend, electricity bill, total monthly cost, change versus baseline and budget status.
- AQI-category activity-planning notes that remain separate from carbon calculations; the model explicitly does not calculate personal exposure or inhaled dose.
- Indoor-air guidance, family checklist, browser-local progress and shareable reminder.
- Responsive layout, semantic landmarks, keyboard-visible focus, reduced-motion support and live status announcements.

## Architecture

```text
Browser (HTML / CSS / ES modules)
  ├── Household profile + local checklist storage
  ├── Recommendation, transport impact and household Digital Twin modules
  └── Same-origin JSON requests
        |
        v
Node.js HTTP server (server.js)
  ├── Input validation + body limits + rate limits
  ├── Security headers + same-origin request check
  ├── Air quality service
  │     ├── Open-Meteo Geocoding API
  │     └── Open-Meteo Air Quality API (CAMS)
  └── Assistant service
        ├── Gemini API (optional, server-side key)
        └── Deterministic local fallback
```

The server uses Node.js built-in modules and `fetch`; no runtime npm dependencies are required.

## Requirements

- Node.js 20 or later (Node 22 recommended).
- Internet access for Open-Meteo air-quality lookups.
- Optional Gemini API key for generative answers.

## Run locally

```bash
# 1. Extract the project and enter its directory
cd ClearSkies-PromptWars-v2.2.1

# 2. Optional: copy environment template
copy .env.example .env

# 3. Start the server
npm start
```

Open `http://127.0.0.1:3000`.

On Windows Command Prompt, use `copy .env.example .env` for step 2. The app works without a `.env` file or Gemini key.

## Configure Gemini (optional)

1. Create a key in Google AI Studio.
2. Put it in the server environment, never in browser code or Git.
3. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` (default `gemini-2.5-flash`).
4. Restart the server.

Example PowerShell session:

```powershell
$env:GEMINI_API_KEY="YOUR_KEY"
$env:GEMINI_MODEL="gemini-2.5-flash"
npm start
```

Linux/macOS:

```bash
export GEMINI_API_KEY="YOUR_KEY"
export GEMINI_MODEL="gemini-2.5-flash"
npm start
```

The browser has no API-key input. If Gemini is missing or upstream service fails, the application uses local deterministic guidance. Do not commit secrets.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address; use `0.0.0.0` in a container platform |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Runtime environment label |
| `GEMINI_API_KEY` | empty | Optional server-side Gemini key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Configurable Gemini model |
| `AI_RATE_LIMIT` | `8` | Assistant requests per client per window |
| `AI_RATE_WINDOW_MS` | `600000` | Assistant rate-limit window |
| `AIR_RATE_LIMIT` | `30` | Air-quality lookups per client per window |
| `AIR_RATE_WINDOW_MS` | `60000` | Air lookup rate-limit window |

## Testing

```bash
npm test
npm run check
npm run smoke
npm run test:coverage
```

Tests use Node's built-in test runner. They cover CPCB breakpoint mapping, validation, recommendation prioritisation and 30 named AI-guidance evaluation scenarios, transport and household Digital Twin formulas, budget calculations, AQI/CO₂ separation, HTTP integration, fallback behaviour, security headers, cross-origin rejection and request-size limits.

The air-quality upstream integration requires network access and is intentionally not mocked as a successful live reading in unit tests. Browser end-to-end tests and real-device assistive-technology testing remain recommended before production launch.

## API

### `GET /api/health`

Returns service version and whether Gemini is configured. Does not return credentials.

### `GET /api/air-quality?city=Visakhapatnam`

Geocodes the city, requests Open-Meteo hourly CAMS pollutant forecasts and returns pollutant values, data timestamp, provider attribution and (when sufficient input exists) an indicative CPCB-breakpoint sub-index calculation.

### `POST /api/assistant`

JSON body:

```json
{
  "question": "How can my family improve indoor air on a low budget?",
  "profile": {
    "city": "Visakhapatnam",
    "householdSize": 4,
    "budget": "low",
    "commute": "two-wheeler",
    "vulnerable": ["children"],
    "schedule": "morning",
    "home": "Apartment",
    "filtration": "none",
    "aqi": null,
    "aqiSource": "Not loaded"
  }
}
```

Returns `{ "mode": "gemini" | "fallback", "answer": "..." }`. Invalid input returns a client error. The Gemini API key is sent to Google only from the server.

## AQI and air-quality methodology

India's National AQI categories are Good (0–50), Satisfactory (51–100), Moderate (101–200), Poor (201–300), Very Poor (301–400) and Severe (401–500). CPCB uses pollutant-specific breakpoints and the maximum valid sub-index to determine AQI.

This implementation uses CPCB concentration bands for PM2.5, PM10, NO₂, SO₂, CO and O₃. It calculates PM2.5, PM10, NO₂ and SO₂ averages over available trailing hourly model values (up to 24 hours) and CO/O₃ over up to 8 hours. CO is converted from µg/m³ to mg/m³ before applying the CPCB concentration bands. A result is shown only when at least three pollutant sub-indices are available and at least one is particulate matter.

**Important limitation:** Open-Meteo returns CAMS model forecasts, not CPCB station measurements. The grid cell may be several kilometres from the requested location. Model temporal resolution and regulatory averaging/validation are not equivalent. The displayed number is therefore called a *model-derived indicative CPCB-breakpoint estimate*, not an official CPCB AQI. For official public advisories, consult CPCB or the relevant State Pollution Control Board. The demo button loads explicitly labelled sample values, not live data.

Sources:
- CPCB, *About National Air Quality Index*: https://app.cpcbccr.com/ccr_docs/About_AQI.pdf
- Open-Meteo Air Quality API: https://open-meteo.com/en/docs/air-quality-api

## Transport impact methodology

The calculator estimates changes in direct vehicle tailpipe CO₂ using these factors. It also estimates rupee travel savings only from the user's own current/alternative monthly-spend inputs:

| Vehicle class | Factor |
|---|---:|
| Two-wheeler | 29 g CO₂ / vehicle-km |
| Three-wheeler | 78 g CO₂ / vehicle-km |
| Private four-wheeler | 140 g CO₂ / vehicle-km |
| Bus | 788 g CO₂ / vehicle-km |

Passenger emissions are estimated by dividing vehicle-kilometre emissions by an explicit assumed occupancy. The default occupancy assumptions are visible and can be changed. Formula:

`Passenger emissions (g) = (vehicle factor g/km ÷ occupancy) × passenger-km`

`Avoided kg = (baseline emissions g − alternative emissions g) ÷ 1,000`

These are indicative tailpipe CO₂ factors reported in India EV Digest 2023, which cites CPCB/MoHUA appraisal material. They are not full lifecycle CO₂e factors. Actual emissions vary by vehicle age, fuel, load, driving cycle and occupancy. Walking/cycling are treated as zero direct tailpipe emissions only. The calculator does not claim that personal changes reduce city AQI by a calculated amount.

Source: India EV Digest 2023, PIB-hosted document: https://static.pib.gov.in/WriteReadData/specificdocs/documents/2024/mar/doc202431317801.pdf

## Household Pollution Digital Twin

The Digital Twin compares three user-defined monthly scenarios:

1. Current household routine.
2. Improved low-emission household routine.
3. Maximum practical low-emission household routine.

Inputs include household size, number of travelling members, monthly passenger distance per traveller, transport mode and occupancy per scenario, travel spending, monthly electricity consumption, tariff, editable grid factor, electricity reduction assumptions, improvement budget, separate weekly outdoor activity minutes for each scenario and optional current AQI.

Formulas:

`Passenger-km = travelling household members × monthly distance per traveller`

`Transport tailpipe CO₂ (kg) = passenger-km × (vehicle factor g CO₂ / vehicle-km ÷ occupancy) ÷ 1,000`

`Electricity operational CO₂ (kg) = scenario kWh × editable grid factor (kg CO₂/kWh)`

`Electricity bill (₹) = scenario kWh × user-entered tariff (₹/kWh)`

`Combined operational CO₂ = transport tailpipe CO₂ + electricity operational CO₂`

The total is a scoped operational estimate, not a complete lifecycle footprint. Travel spending and tariff are user inputs; electricity bills exclude fixed charges, taxes, slabs and time-of-use pricing. The model validates traveller count against household size, mode values, occupancy, distance, costs, reductions and AQI range. Simplified occupancy ceilings are enforced (two-wheeler 2, car 8, auto-rickshaw 6, bus 100, walking/cycling 1). The budget compares incremental monthly household cost against the user-entered monthly improvement budget; it does not model one-time purchase costs or financing.

**Grid factor caveat:** the prefilled 0.675 kg CO₂/kWh value is a provisional editable placeholder inherited from the earlier prototype. It has not been independently verified against the latest official CEA publication in this release. Replace it with a current, sourced factor for formal reporting.

Each scenario displays its own weekly outdoor activity plan and a category-level planning note based on the optional AQI entered by the user. This is not a forecast, personal risk score or guarantee of safety; one AQI value cannot identify the cleanest hour. The user should check current local conditions and official advisories. Scenario-specific indoor-air suggestions cover source control, damp cleaning, kitchen exhaust and (for the maximum practical scenario) correctly sized, maintained mechanical HEPA filtration. These are educational actions only: the model does not calculate indoor PM2.5, filtration effectiveness, personal exposure, inhaled dose or health outcomes. AQI and activity minutes never enter the CO₂ equations. Transport factors remain indicative values documented in the transport methodology section; they are not universal fleet averages.

## AI safety and limitations

- AI output is general educational information, not medical diagnosis or treatment.
- The assistant must not invent live pollutant readings or claim precise health outcomes.
- It should not recommend ozone-generating cleaners, unsafe chemical methods or plants as a substitute for filtration.
- For severe pollution, follow official advisories; seek qualified medical care for symptoms.
- When Gemini is unavailable, deterministic fallback guidance is used.
- Household profile and question are sent to Gemini only when the user submits a question. Avoid sensitive personal or medical details.

Gemini API docs: https://ai.google.dev/gemini-api/docs

## Security

- Gemini key remains server-side.
- Same-origin check for browser requests; no permissive CORS.
- Content Security Policy, `X-Content-Type-Options`, frame protection, referrer and permissions policies.
- Request body limit, input validation, API rate limiting and upstream timeouts.
- User-generated text is inserted with `textContent` in the UI.
- No API key is accepted or rendered by the frontend.
- `.env` and secret files are ignored by Git.

For multi-instance production deployments, replace the in-memory rate limiter/cache with a shared store (e.g. Redis), add TLS at the reverse proxy/platform, configure trusted proxy handling carefully, and consider an abuse-monitoring strategy. The built-in limiter is per process and is not a substitute for a managed WAF.

## Accessibility

The interface includes semantic landmarks, skip navigation, labels and fieldsets, keyboard focus styling, live status regions, responsive layout, non-colour-only text labels, and reduced-motion support. Automated checks do not replace manual screen-reader, keyboard-only and contrast testing on target browsers.

## Deployment

Deploy as a Node.js web service, not static-only hosting, because Gemini and air-quality requests are server routes.

Generic platform configuration:
- Build command: `npm test && npm run check`
- Start command: `npm start`
- Runtime: Node 20+
- Set `HOST=0.0.0.0`, `PORT` from the platform, and optional `GEMINI_API_KEY` / `GEMINI_MODEL` as server environment variables.
- Configure HTTPS and health-check path `/api/health`.

Do not publish `.env`. GitHub Pages cannot host the server routes; use a Node-compatible host.

## Repository hygiene

`.gitignore` excludes `.env`, dependencies, coverage and generated test artifacts. CI runs tests, syntax checks and a smoke test on pushes and pull requests.

## Known limitations and future work

- Connect validated official CPCB/State Pollution Control Board station feeds where access and licensing permit. No official CPCB station feed is integrated in this release.
- Add browser end-to-end and screen-reader tests across supported browsers; no real-browser automation is included in this release.
- Use a shared cache/rate-limit store in multi-instance production.
- Add household multi-device sync only with explicit consent and secure authentication.
- Improve emission factors with fleet/region-specific source tables and versioned citations.
