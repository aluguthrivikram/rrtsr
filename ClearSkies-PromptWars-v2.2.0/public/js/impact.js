// Tailpipe CO2 factors (g CO2 / vehicle-km) transcribed from India EV Digest 2023,
// citing CPCB/MoHUA appraisal material: 2W 29, 3W 78, private 4W 140, bus 788.
// Passenger allocation uses explicit occupancy assumptions; lifecycle emissions excluded.
export const FACTORS = Object.freeze({
  "two-wheeler": { gPerVehicleKm:29, occupancy:1.2, label:"Two-wheeler" },
  car: { gPerVehicleKm:140, occupancy:1.5, label:"Private car" },
  auto: { gPerVehicleKm:78, occupancy:2, label:"Auto-rickshaw" },
  bus: { gPerVehicleKm:788, occupancy:30, label:"Public bus" },
  walk: { gPerVehicleKm:0, occupancy:1, label:"Walk / cycle" }
});

export function estimateTripImpact({ monthlyKm, currentMode, alternativeMode, currentOccupancy, alternativeOccupancy }) {
  const km = Number(monthlyKm);
  if (!Number.isFinite(km) || km < 0 || km > 10000) throw new RangeError("Monthly kilometres must be between 0 and 10,000.");
  const current = FACTORS[currentMode], alternative = FACTORS[alternativeMode];
  if (!current || !alternative) throw new TypeError("Choose supported transport modes.");
  const co = Number(currentOccupancy ?? current.occupancy);
  const ao = Number(alternativeOccupancy ?? alternative.occupancy);
  if (![co,ao].every(x => Number.isFinite(x) && x >= 1 && x <= 100)) throw new RangeError("Occupancy must be between 1 and 100.");
  const baseline = (current.gPerVehicleKm / co) * km;
  const scenario = (alternative.gPerVehicleKm / ao) * km;
  const avoided = baseline - scenario;
  return {
    monthlyKgCo2Avoided: avoided / 1000,
    annualKgCo2Avoided: avoided * 12 / 1000,
    vehicleKmAvoided: currentMode === alternativeMode ? 0 : (currentMode === "walk" ? 0 : km),
    baselineKg: baseline / 1000,
    alternativeKg: scenario / 1000,
    monthlyKm: km,
    assumptions: {
      currentMode, alternativeMode, currentOccupancy:co, alternativeOccupancy:ao,
      currentFactorGPerVehicleKm:current.gPerVehicleKm,
      alternativeFactorGPerVehicleKm:alternative.gPerVehicleKm,
      scope:"Tailpipe CO2 only; not full lifecycle CO2e. Per-passenger allocation divides vehicle emissions by assumed occupancy."
    }
  };
}

export function compareScenarios(input) {
  const current = estimateTripImpact({...input, alternativeMode:input.currentMode});
  const improved = estimateTripImpact(input);
  const maximum = estimateTripImpact({...input, alternativeMode:"walk"});
  return [
    { name:"Current routine", monthlyKgCo2Avoided:0, monthlyEmissionsKg:current.baselineKg },
    { name:"Improved routine", monthlyKgCo2Avoided:improved.monthlyKgCo2Avoided, monthlyEmissionsKg:improved.alternativeKg },
    { name:"Walking / cycling (if suitable)", monthlyKgCo2Avoided:maximum.monthlyKgCo2Avoided, monthlyEmissionsKg:maximum.alternativeKg }
  ];
}
