import test from "node:test";
import assert from "node:assert/strict";
import { calculateHouseholdTwin } from "../public/js/household-twin.js";

const base = {
  householdSize:4, travellers:2, monthlyKmPerTraveller:120,
  currentMode:"car", currentOccupancy:1, currentTravelSpend:2500,
  improvedMode:"bus", improvedOccupancy:30, improvedTravelSpend:1200, improvedElectricityReductionPct:10,
  stretchMode:"walk", stretchOccupancy:1, stretchTravelSpend:400, stretchElectricityReductionPct:20,
  monthlyKwh:250, electricityTariff:7, gridFactor:0.675, improvementBudget:1000,
  outdoorActivityMinutesPerWeek:150, aqi:180
};

test("returns exactly three named household scenarios",()=>{
  const r=calculateHouseholdTwin(base);
  assert.deepEqual(r.scenarios.map(x=>x.name),["Current household routine","Improved low-emission routine","Maximum practical low-emission routine"]);
});
test("allocates passenger distance across travelling household members",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.passengerKm,240);
  assert.equal(r.scenarios[0].passengerKm,240);
});
test("calculates current car tailpipe emissions using occupancy",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[0].transportTailpipeKgCo2,33.6);
});
test("allocates bus vehicle emissions over entered passenger occupancy",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[1].transportTailpipeKgCo2,6.304);
});
test("walking has zero direct tailpipe emissions",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[2].transportTailpipeKgCo2,0);
});
test("calculates electricity operational emissions separately",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[0].electricityOperationalKgCo2,168.75);
  assert.equal(r.scenarios[0].transportTailpipeKgCo2,33.6);
});
test("applies electricity reduction independently by scenario",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[1].electricityKwh,225);
  assert.equal(r.scenarios[2].electricityKwh,200);
});
test("calculates electricity bill from kWh and tariff",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[0].electricityBillRupees,1750);
  assert.equal(r.scenarios[1].electricityBillRupees,1575);
});
test("combines transport and electricity operational CO2 only",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[0].combinedOperationalKgCo2,202.35);
});
test("compares total monthly cost to current baseline",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[0].monthlyCostChangeRupeesVsCurrent,0);
  assert.equal(r.scenarios[1].monthlyCostChangeRupeesVsCurrent,-1475);
});
test("shows AQI only as context and never computes exposure or inhaled dose",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.airQualityContext.aqi,180);
  assert.equal(r.airQualityContext.exposureCalculated,false);
  assert.equal(r.airQualityContext.inhaledDoseCalculated,false);
});
test("allows missing AQI without inventing a value",()=>{
  const r=calculateHouseholdTwin({...base,aqi:""});
  assert.equal(r.airQualityContext.aqi,null);
});
test("rejects travellers greater than household size",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,travellers:5}),/Travelling household members/);
});
test("rejects zero household size",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,householdSize:0}),/Household size/);
});
test("rejects negative monthly travel distance",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,monthlyKmPerTraveller:-1}),/Monthly distance/);
});
test("rejects implausibly high monthly travel distance",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,monthlyKmPerTraveller:10001}),/Monthly distance/);
});
test("rejects unknown transport mode",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,improvedMode:"rocket"}),/Unsupported transport mode/);
});
test("rejects impossible vehicle occupancy values",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,currentOccupancy:0}),/Current vehicle occupancy/);
  assert.throws(()=>calculateHouseholdTwin({...base,currentOccupancy:101}),/Current vehicle occupancy/);
});
test("rejects negative travel spend",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,currentTravelSpend:-1}),/Current monthly travel spend/);
});
test("rejects negative electricity consumption",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,monthlyKwh:-1}),/Monthly electricity consumption/);
});
test("rejects invalid tariff and grid factor",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,electricityTariff:-1}),/Electricity tariff/);
  assert.throws(()=>calculateHouseholdTwin({...base,gridFactor:8}),/Grid emission factor/);
});
test("rejects electricity reductions above 90 percent",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,improvedElectricityReductionPct:95}),/Improved electricity reduction/);
});
test("requires stretch reduction to be at least improved reduction",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,improvedElectricityReductionPct:30,stretchElectricityReductionPct:20}),/Stretch electricity reduction/);
});
test("rejects negative improvement budget",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,improvementBudget:-100}),/Improvement budget/);
});
test("rejects invalid AQI rather than clamping it",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,aqi:700}),/AQI/);
});
test("rejects implausible outdoor activity duration",()=>{
  assert.throws(()=>calculateHouseholdTwin({...base,outdoorActivityMinutesPerWeek:11000}),/Outdoor activity minutes/);
});
test("uses a user-edited grid factor in electricity emissions",()=>{
  const r=calculateHouseholdTwin({...base,gridFactor:0.5});
  assert.equal(r.scenarios[0].electricityOperationalKgCo2,125);
});
test("budget status distinguishes baseline and over-budget increase",()=>{
  const r=calculateHouseholdTwin({...base,improvedTravelSpend:5000,improvementBudget:100});
  assert.equal(r.scenarios[0].budgetStatus,"baseline");
  assert.equal(r.scenarios[1].budgetStatus,"over-budget");
});
test("zero baseline operational emissions does not divide by zero",()=>{
  const r=calculateHouseholdTwin({...base,currentMode:"walk",currentTravelSpend:0,monthlyKwh:0,gridFactor:0});
  assert.equal(r.scenarios[0].operationalCo2ReductionPctVsCurrent,null);
});
test("exposes methodology and lifecycle limitation",()=>{
  const r=calculateHouseholdTwin(base);
  assert.ok(r.assumptions.some(x=>x.includes("tailpipe")));
  assert.match(r.scope,/not a full lifecycle footprint/i);
});


test("cost-saving scenarios remain within the improvement budget",()=>{
  const r=calculateHouseholdTwin(base);
  assert.equal(r.scenarios[1].budgetStatus,"within-budget");
  assert.equal(r.scenarios[2].budgetStatus,"within-budget");
});
test("only incremental monthly cost above the baseline consumes the improvement budget",()=>{
  const r=calculateHouseholdTwin({...base,improvedTravelSpend:5000,improvementBudget:500});
  assert.equal(r.scenarios[1].budgetStatus,"over-budget");
});

test("keeps separate outdoor activity plans for all three scenarios",()=>{
 const r=calculateHouseholdTwin({...base,currentOutdoorActivityMinutesPerWeek:180,improvedOutdoorActivityMinutesPerWeek:120,stretchOutdoorActivityMinutesPerWeek:90});
 assert.deepEqual(r.scenarios.map(x=>x.outdoorActivityMinutesPerWeek),[180,120,90]);
});
test("provides AQI-category activity planning without adding AQI to carbon calculations",()=>{
 const r=calculateHouseholdTwin({...base,aqi:350,currentOutdoorActivityMinutesPerWeek:150});
 assert.equal(r.airQualityContext.category,"Very Poor");
 assert.match(r.scenarios[0].activityGuidance.plan,/Avoid strenuous outdoor activity/);
 assert.equal(r.scenarios[0].combinedOperationalKgCo2,202.35);
 assert.equal(r.airQualityContext.exposureCalculated,false);
 assert.equal(r.airQualityContext.inhaledDoseCalculated,false);
});
test("does not invent an activity category or cleanest time when AQI is missing",()=>{
 const r=calculateHouseholdTwin({...base,aqi:""});
 assert.equal(r.airQualityContext.category,null);
 assert.match(r.scenarios[0].activityGuidance.plan,/checking current local air-quality information/);
 assert.match(r.scenarios[0].activityGuidance.plan,/No best time of day/);
});
test("rejects impossible occupancy for a two-wheeler",()=>{
 assert.throws(()=>calculateHouseholdTwin({...base,currentMode:"two-wheeler",currentOccupancy:3}),/cannot exceed 2/);
});
test("rejects impossible occupancy for a private car",()=>{
 assert.throws(()=>calculateHouseholdTwin({...base,currentOccupancy:9}),/cannot exceed 8/);
});


test("returns indoor-air action suggestions without inventing a measured indoor impact",()=>{
 const r=calculateHouseholdTwin(base);
 assert.match(r.scenarios[0].indoorAirActions[0],/without a suitable monitor/);
 assert.ok(r.scenarios[1].indoorAirActions.some(x=>/damp-wipe/i.test(x)));
 assert.ok(r.scenarios[2].indoorAirActions.some(x=>/HEPA/.test(x)));
 assert.ok(r.assumptions.some(x=>/not assigned a numerical exposure reduction/.test(x)));
});
