import { FACTORS } from "./impact.js";

const MODES = Object.freeze(Object.keys(FACTORS));
const MAX_OCCUPANCY = Object.freeze({ "two-wheeler": 2, car: 8, auto: 6, bus: 100, walk: 1 });

function activityGuidance(aqi, minutes) {
  if (aqi === null) return {
    category: "AQI unavailable",
    plan: `Plan ${minutes} outdoor activity minutes per week only after checking current local air-quality information and official advisories. No best time of day can be inferred from a single AQI value.`,
    confidence: "No AQI supplied"
  };
  if (aqi <= 50) return { category: "Good", plan: `Keep the planned ${minutes} minutes/week if it suits the household. Continue checking changing conditions.`, confidence: "AQI category only" };
  if (aqi <= 100) return { category: "Satisfactory", plan: `Plan the ${minutes} minutes/week flexibly. Sensitive household members should monitor symptoms and local advisories.`, confidence: "AQI category only" };
  if (aqi <= 200) return { category: "Moderate", plan: `Consider shorter or lower-intensity outdoor sessions; move strenuous activity indoors when practical, especially for sensitive members. Recheck conditions before going out.`, confidence: "AQI category only" };
  if (aqi <= 300) return { category: "Poor", plan: `Reduce prolonged or strenuous outdoor activity. Prefer indoor alternatives where practical and follow local health advisories.`, confidence: "AQI category only" };
  if (aqi <= 400) return { category: "Very Poor", plan: `Avoid strenuous outdoor activity; shift planned exercise indoors where possible and follow official advisories.`, confidence: "AQI category only" };
  return { category: "Severe", plan: `Avoid outdoor physical exertion and follow current official local advisories. Keep essential outdoor trips brief where possible.`, confidence: "AQI category only" };
}
const finite = (value, name, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new RangeError(`${name} must be between ${min} and ${max}.`);
  return n;
};
const modeFactor = (mode) => {
  if (!MODES.includes(mode)) throw new TypeError(`Unsupported transport mode: ${mode}.`);
  return FACTORS[mode];
};

/**
 * Monthly household scenario model.
 * Transport is household-allocated tailpipe CO2: passenger-km × (vehicle factor / occupancy).
 * Electricity is operational grid CO2: kWh × editable grid factor.
 * No AQI, exposure, inhaled dose, lifecycle or health outcome is inferred.
 */
export function calculateHouseholdTwin(input = {}) {
  const householdSize = finite(input.householdSize, "Household size", 1, 20);
  const travellers = finite(input.travellers, "Travelling household members", 1, householdSize);
  const kmPerTraveller = finite(input.monthlyKmPerTraveller, "Monthly distance per traveller", 0, 10000);
  const currentMode = input.currentMode;
  const improvedMode = input.improvedMode;
  const stretchMode = input.stretchMode;
  const currentFactor = modeFactor(currentMode);
  const improvedFactor = modeFactor(improvedMode);
  const stretchFactor = modeFactor(stretchMode);
  const currentOccupancy = finite(input.currentOccupancy ?? currentFactor.occupancy, "Current vehicle occupancy", 1, 100);
  const improvedOccupancy = finite(input.improvedOccupancy ?? improvedFactor.occupancy, "Improved vehicle occupancy", 1, 100);
  const stretchOccupancy = finite(input.stretchOccupancy ?? stretchFactor.occupancy, "Stretch vehicle occupancy", 1, 100);
  const currentTravelSpend = finite(input.currentTravelSpend, "Current monthly travel spend", 0, 10000000);
  const improvedTravelSpend = finite(input.improvedTravelSpend, "Improved monthly travel spend", 0, 10000000);
  const stretchTravelSpend = finite(input.stretchTravelSpend, "Stretch monthly travel spend", 0, 10000000);
  const monthlyKwh = finite(input.monthlyKwh, "Monthly electricity consumption", 0, 100000);
  const tariff = finite(input.electricityTariff, "Electricity tariff", 0, 1000);
  const gridFactor = finite(input.gridFactor, "Grid emission factor", 0, 5);
  const improvementBudget = finite(input.improvementBudget, "Improvement budget", 0, 10000000);
  const improvedReduction = finite(input.improvedElectricityReductionPct, "Improved electricity reduction", 0, 90);
  const stretchReduction = finite(input.stretchElectricityReductionPct, "Stretch electricity reduction", 0, 90);
  if (stretchReduction < improvedReduction) throw new RangeError("Stretch electricity reduction must be at least the improved reduction.");
  const currentOutdoorMinutes = finite(input.currentOutdoorActivityMinutesPerWeek ?? input.outdoorActivityMinutesPerWeek, "Outdoor activity minutes per week", 0, 10080);
  const improvedOutdoorMinutes = finite(input.improvedOutdoorActivityMinutesPerWeek ?? currentOutdoorMinutes, "Improved outdoor activity minutes per week", 0, 10080);
  const stretchOutdoorMinutes = finite(input.stretchOutdoorActivityMinutesPerWeek ?? improvedOutdoorMinutes, "Maximum practical outdoor activity minutes per week", 0, 10080);
  const aqi = input.aqi === null || input.aqi === undefined || input.aqi === "" ? null : finite(input.aqi, "AQI", 0, 500);

  const passengerKm = travellers * kmPerTraveller;
  const scenario = (name, mode, occupancy, travelSpend, electricityReductionPct) => {
    const factor = modeFactor(mode);
    if (occupancy > MAX_OCCUPANCY[mode]) throw new RangeError(`${factor.label} occupancy cannot exceed ${MAX_OCCUPANCY[mode]} people in this model.`);
    const transportKg = passengerKm * factor.gPerVehicleKm / occupancy / 1000;
    const electricityKwh = monthlyKwh * (1 - electricityReductionPct / 100);
    const electricityKg = electricityKwh * gridFactor;
    const electricityBill = electricityKwh * tariff;
    const totalCost = travelSpend + electricityBill;
    const totalOperationalKg = transportKg + electricityKg;
    return {
      name, mode, occupancy, passengerKm,
      transportTailpipeKgCo2: transportKg,
      electricityKwh, electricityOperationalKgCo2: electricityKg,
      combinedOperationalKgCo2: totalOperationalKg,
      travelSpendRupees: travelSpend, electricityBillRupees: electricityBill,
      totalMonthlyCostRupees: totalCost,
      electricityReductionPct,
      outdoorActivityMinutesPerWeek: 0,
      activityGuidance: null,
      householdRoutine: ""
    };
  };
  const current = scenario("Current household routine", currentMode, currentOccupancy, currentTravelSpend, 0);
  const improved = scenario("Improved low-emission routine", improvedMode, improvedOccupancy, improvedTravelSpend, improvedReduction);
  const stretch = scenario("Maximum practical low-emission routine", stretchMode, stretchOccupancy, stretchTravelSpend, stretchReduction);
  current.outdoorActivityMinutesPerWeek = currentOutdoorMinutes;
  improved.outdoorActivityMinutesPerWeek = improvedOutdoorMinutes;
  stretch.outdoorActivityMinutesPerWeek = stretchOutdoorMinutes;
  const routines = [
    "Keep the existing travel pattern and electricity habits; identify avoidable trips and high-use appliances.",
    "Use public/shared transport or trip-combining where feasible; switch off idle loads, use efficient settings and reduce avoidable electricity use.",
    "Use the lowest practical-emission travel option for suitable trips; combine journeys, maximise safe shared occupancy and apply the largest realistic electricity-saving measures."
  ];
  const indoorActions = [
    ["Record current indoor-air habits; do not assume indoor air quality is known without a suitable monitor."],
    ["Avoid indoor smoking, incense and candles; damp-wipe or wet-mop to limit dust resuspension; use a kitchen exhaust vented outdoors where available."],
    ["Apply the improved source-control routine; consider a correctly room-sized mechanical HEPA cleaner and maintain its filter; ventilate when outdoor conditions are more favourable without compromising required ventilation or combustion safety."]
  ];
  [current, improved, stretch].forEach((item, index) => {
    item.householdRoutine = routines[index];
    item.indoorAirActions = indoorActions[index];
    item.activityGuidance = activityGuidance(aqi, item.outdoorActivityMinutesPerWeek);
  });
  const scenarios = [current, improved, stretch].map((item, index) => ({
    ...item,
    operationalCo2ChangeKgVsCurrent: item.combinedOperationalKgCo2 - current.combinedOperationalKgCo2,
    operationalCo2ReductionPctVsCurrent: current.combinedOperationalKgCo2 > 0
      ? (1 - item.combinedOperationalKgCo2 / current.combinedOperationalKgCo2) * 100 : null,
    monthlyCostChangeRupeesVsCurrent: item.totalMonthlyCostRupees - current.totalMonthlyCostRupees,
    budgetStatus: index === 0 ? "baseline" : Math.max(0, item.totalMonthlyCostRupees - current.totalMonthlyCostRupees) <= improvementBudget ? "within-budget" : "over-budget"
  }));
  return {
    householdSize, travellers, monthlyKmPerTraveller: kmPerTraveller, passengerKm,
    electricityGridFactorKgCo2PerKwh: gridFactor,
    improvementBudgetRupees: improvementBudget,
    activityPlanning: {
      currentMinutesPerWeek: currentOutdoorMinutes,
      improvedMinutesPerWeek: improvedOutdoorMinutes,
      maximumPracticalMinutesPerWeek: stretchOutdoorMinutes,
      basis: "Activity guidance uses only the supplied AQI category and planned minutes; it does not estimate dose, exposure or a safe personal threshold. A single AQI value cannot identify the cleanest hour."
    },
    airQualityContext: {
      aqi,
      category: aqi === null ? null : activityGuidance(aqi, 0).category,
      interpretation: aqi === null ? "AQI not supplied; no air-quality category inferred." : "AQI is contextual activity-planning guidance only and is not part of the emissions calculation.",
      exposureCalculated: false,
      inhaledDoseCalculated: false
    },
    scenarios,
    assumptions: [
      "Monthly passenger-kilometres equal travelling household members multiplied by each traveller's monthly distance.",
      "Vehicle tailpipe emissions are allocated per passenger using the selected occupancy; the factors are indicative, not universal.",
      "Electricity emissions are operational grid emissions only: monthly kWh × editable grid factor.",
      "Combined operational CO2 is transport tailpipe CO2 plus electricity-related operational CO2; it is not a full lifecycle footprint.",
      "Electricity bill assumes a flat user-entered tariff and excludes fixed charges, slabs, taxes and time-of-use pricing.",
      "Each scenario has its own planned outdoor activity minutes and AQI-category planning note; these do not change CO2 calculations.",
      "AQI guidance is indicative category-level planning, not a forecast, personal exposure estimate or guarantee of safety.",
      "Transport occupancy is bounded by simplified vehicle capacities: two-wheeler 2, car 8, auto-rickshaw 6, bus 100, walking/cycling 1.",
      "Indoor-air actions are behavioural suggestions only; no indoor PM2.5 or filtration performance is measured or modelled.",
      "The indoor-air suggestions are not assigned a numerical exposure reduction or health benefit."
    ],
    scope: "Monthly household estimates. Combined operational emissions are not a full lifecycle footprint. CO2, AQI, indoor particulate pollution, personal exposure, inhaled dose and health outcomes are distinct; indoor PM2.5, personal exposure and inhaled dose are not calculated."
  };
}
