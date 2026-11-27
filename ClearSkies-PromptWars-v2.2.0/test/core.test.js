import test from "node:test";
import assert from "node:assert/strict";
import { cpcbCategory, subIndex, calculateCpcbAqi, mean } from "../src/aqi.js";
import { estimateTripImpact, compareScenarios } from "../src/impact.js";
import { buildRecommendations } from "../src/recommendations.js";
import { cleanText, validateAssistantBody } from "../src/validation.js";

test("CPCB category boundaries follow Indian six-category scale",()=>{
  assert.equal(cpcbCategory(50).label,"Good");
  assert.equal(cpcbCategory(51).label,"Satisfactory");
  assert.equal(cpcbCategory(101).label,"Moderate");
  assert.equal(cpcbCategory(201).label,"Poor");
  assert.equal(cpcbCategory(301).label,"Very Poor");
  assert.equal(cpcbCategory(401).label,"Severe");
  assert.equal(cpcbCategory(501),null);
});
test("pollutant sub-index interpolates within CPCB PM2.5 bands",()=>{
  assert.equal(subIndex("pm25",30),50);
  assert.equal(subIndex("pm25",60),100);
  assert.equal(subIndex("pm25",90),200);
  assert.equal(subIndex("unknown",20),null);
  assert.equal(subIndex("pm25",-1),null);
});
test("CPCB AQI uses maximum valid pollutant sub-index and requires minimum inputs",()=>{
  const result=calculateCpcbAqi({pm25:85,pm10:100,no2:20});
  assert.equal(result.valid,true);
  assert.equal(result.dominantPollutant,"pm25");
  assert.equal(result.aqi,184);
  assert.equal(calculateCpcbAqi({pm25:20,pm10:30}).valid,false);
});
test("mean ignores null and non-number values",()=>assert.equal(mean([1,2,null,3]),2));
test("impact calculator is deterministic and exposes assumptions",()=>{
  const result=estimateTripImpact({monthlyKm:100,currentMode:"car",alternativeMode:"bus",currentOccupancy:1,alternativeOccupancy:30});
  assert.ok(result.monthlyKgCo2Avoided>0);
  assert.equal(result.annualKgCo2Avoided,result.monthlyKgCo2Avoided*12);
  assert.equal(result.assumptions.currentFactorGPerVehicleKm,140);
});
test("impact calculator rejects invalid input and handles negative savings",()=>{
  assert.throws(()=>estimateTripImpact({monthlyKm:-1,currentMode:"car",alternativeMode:"bus"}),RangeError);
  const result=estimateTripImpact({monthlyKm:100,currentMode:"walk",alternativeMode:"bus",currentOccupancy:1,alternativeOccupancy:1});
  assert.ok(result.monthlyKgCo2Avoided<0);
});
test("scenario comparison returns current, improved and maximum practical",()=>{
  const scenarios=compareScenarios({monthlyKm:50,currentMode:"car",alternativeMode:"bus",currentOccupancy:1,alternativeOccupancy:30});
  assert.deepEqual(scenarios.map(x=>x.name),["Current routine","Improved routine","Walking / cycling (if suitable)"]);
});
test("recommendations prioritise vulnerable households and severe conditions",()=>{
  const items=buildRecommendations({aqi:420,commute:"car",vulnerable:["children"],budget:"low"});
  assert.match(items[0].title,/sensitive|household/i);
  assert.ok(items.some(x=>x.action.includes("Avoid outdoor exertion")));
});
test("budget and commute context change recommendation details",()=>{
  const low=buildRecommendations({budget:"low",commute:"car"});
  const flexible=buildRecommendations({budget:"flexible",commute:"walk"});
  assert.match(low.find(x=>x.title.includes("particle filter")).cost,/Optional/);
  assert.match(flexible.find(x=>x.title.includes("particle filter")).cost,/purchase/);
});
test("cleanText strips control characters and enforces maximum length",()=>{
  assert.equal(cleanText("hi\u0000there"),"hithere");
  assert.equal(cleanText("abcdef",3),"abc");
});
test("assistant input validation rejects malformed or oversized questions",()=>{
  assert.equal(validateAssistantBody(null).ok,false);
  assert.equal(validateAssistantBody({question:"ok",profile:{householdSize:2}}).ok,false);
  assert.equal(validateAssistantBody({question:"How can I improve air?",profile:{householdSize:2}}).ok,true);
  assert.equal(validateAssistantBody({question:"Valid question",profile:{householdSize:99}}).ok,false);
});
test("assistant profile is constrained to supported enum values",()=>{
  const parsed=validateAssistantBody({question:"What should I do?",profile:{householdSize:3,budget:"invented",commute:"invented",vulnerable:["children","malicious"]}});
  assert.equal(parsed.value.profile.budget,"low");
  assert.equal(parsed.value.profile.commute,"mixed");
  assert.deepEqual(parsed.value.profile.vulnerable,["children"]);
});


test("open-ended CPCB severe bands do not invent upper concentration breakpoints",()=>{
  assert.equal(subIndex("pm25",250),401);
  assert.equal(subIndex("pm25",900),401);
  assert.equal(subIndex("pm10",430),401);
});


test("severe AQI override targets the exercise recommendation even when sensitive-group advice is inserted",()=>{
  const items=buildRecommendations({aqi:420,commute:"car",vulnerable:["children"]});
  const exercise=items.find(x=>x.title==="Move strenuous exercise away from polluted periods");
  const cleaning=items.find(x=>x.title==="Use low-dust cleaning");
  assert.match(exercise.action,/Avoid outdoor exertion/);
  assert.doesNotMatch(cleaning.action,/Avoid outdoor exertion/);
});
test("poor AQI advisory is attached to the advisory card, not a shifted array position",()=>{
  const items=buildRecommendations({aqi:250,vulnerable:["older-adults"]});
  const advisory=items.find(x=>x.title==="Check the latest local advisory before outdoor plans");
  const sensitive=items.find(x=>x.title==="Plan around household members who may be more sensitive");
  assert.match(advisory.action,/Poor-or-worse range/);
  assert.doesNotMatch(sensitive.action,/Poor-or-worse range/);
});


test("assistant validation preserves missing, null and empty AQI instead of converting to zero",()=>{
  for (const aqi of [undefined,null,""]) {
    const body={question:"How can we improve indoor air?",profile:{householdSize:4,aqi}};
    const parsed=validateAssistantBody(body);
    assert.equal(parsed.ok,true);
    assert.equal(parsed.value.profile.aqi,null);
  }
});
test("assistant validation accepts a genuine numeric zero AQI",()=>{
  const parsed=validateAssistantBody({question:"How can we improve indoor air?",profile:{householdSize:4,aqi:0}});
  assert.equal(parsed.value.profile.aqi,0);
});
