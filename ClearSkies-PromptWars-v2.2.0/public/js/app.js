import { buildRecommendations } from "/js/recommendations.js";
import { estimateTripImpact, compareScenarios } from "/js/impact.js";
import { calculateHouseholdTwin } from "/js/household-twin.js";

const $ = id => document.getElementById(id);
// Fail with the exact missing control name instead of an opaque
// "Cannot read properties of null (reading 'value')" browser error.
function readValue(id) {
 const element = $(id);
 if (!element) throw new Error(`The page is missing the required input "${id}". Reload the latest ClearSkies files and clear the browser cache.`);
 return element.value;
}
const state = { air:null, profile:null, demo:false, aiBusy:false };
const STORAGE_PROFILE="clearskies.profile.v2", STORAGE_CHECKLIST="clearskies.checklist.v1";
let toastTimer;
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function safeNumber(value,fallback=null){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function profileFromForm(){
 const form=$("profile-form");
 return {
  city:readValue("city").trim(),householdSize:safeNumber(readValue("household-size"),4),
  budget:readValue("budget"),commute:readValue("commute"),schedule:readValue("schedule"),
  home:readValue("home-type"),vulnerable:[...form.querySelectorAll('input[name="vulnerable"]:checked')].map(x=>x.value),
  filtration:readValue("filtration"),aqi:state.air?.cpcbIndicative?.value??null,
  aqiSource:state.air?.provider??"Not loaded"
 };
}
function saveProfile(){state.profile=profileFromForm();localStorage.setItem(STORAGE_PROFILE,JSON.stringify(state.profile));$("profile-status").textContent="Profile saved on this device.";renderPlan();toast("Household profile saved.");}
function restoreProfile(){
 try{const p=JSON.parse(localStorage.getItem(STORAGE_PROFILE)||"null");if(!p)return;
  $("city").value=p.city||"Visakhapatnam";$("household-size").value=p.householdSize||4;
  $("budget").value=p.budget||"low";$("commute").value=p.commute||"mixed";$("schedule").value=p.schedule||"variable";
  $("home-type").value=p.home||"Apartment";$("filtration").value=p.filtration||"none";
  for(const input of document.querySelectorAll('input[name="vulnerable"]'))input.checked=(p.vulnerable||[]).includes(input.value);
 }catch{localStorage.removeItem(STORAGE_PROFILE);}
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function renderPlan(){
 state.profile=profileFromForm();
 const recommendations=buildRecommendations(state.profile);
 const container=$("recommendation-groups");container.replaceChildren();
 const groups=new Map();
 for(const item of recommendations){if(!groups.has(item.group))groups.set(item.group,[]);groups.get(item.group).push(item);}
 for(const [name,items] of groups){
  const group=el("section","recommendation-group");group.append(el("h3","",name));
  for(const item of items){
   const card=el("article","recommendation");card.append(el("h4","",item.title),el("p","",item.action),el("p","",`Why: ${item.why}`));
   const meta=el("div","rec-meta");for(const value of [`Difficulty: ${item.difficulty}`,`Cost: ${item.cost}`,`Benefit: ${item.benefit}`])meta.append(el("span","",value));
   card.append(meta);group.append(card);
  }
  container.append(group);
 }
}
function renderPollutants(pollutants={}){
 const names={pm25:["PM2.5","µg/m³"],pm10:["PM10","µg/m³"],no2:["NO₂","µg/m³"],so2:["SO₂","µg/m³"],co:["CO","mg/m³"],o3:["O₃","µg/m³"]};
 const container=$("pollutants");container.replaceChildren();
 for(const [key,[label,unit]] of Object.entries(names)){
  const card=el("div","pollutant");const val=pollutants[key];
  card.append(el("span","",label),el("strong","",val===null||val===undefined?"—":`${Number(val).toFixed(key==="co"?3:1)}`),el("span","",unit));
  container.append(card);
 }
}
function renderAir(data){
 state.air=data;state.demo=Boolean(data.demo);
 const aqi=data.cpcbIndicative?.value;
 $("aqi-value").textContent=aqi??"—";
 $("aqi-category").textContent=data.cpcbIndicative?.category??"Indicative AQI unavailable";
 $("aqi-explanation").textContent=data.cpcbIndicative?`Highest available CPCB-breakpoint sub-index: ${data.cpcbIndicative.dominantPollutant?.toUpperCase()||"not specified"}. ${data.demo?"This is sample demo data, not a live measurement.":"Model-derived estimate; not an official station AQI."}`:"Not enough valid pollutant averages to calculate a CPCB-style indicator. Concentrations remain available below.";
 $("air-mode").textContent=data.demo?"DEMO DATA":"MODEL ESTIMATE";
 $("air-location").textContent=data.location?.name?`${data.location.name}${data.location.admin1?", "+data.location.admin1:""}`:"Demo location";
 $("air-updated").textContent=`Data time: ${data.updatedAt?new Date(data.updatedAt).toLocaleString():"sample"}`;
 $("air-caveat").textContent=data.aqiNotice||"Demo values are illustrative only.";
 renderPollutants(data.pollutants);
 $("air-status").textContent=data.demo?"Demo mode is active. These values are illustrative and must not be used for health decisions.":`Retrieved from ${data.provider}. CAMS model values are estimates, not a monitoring-station reading.`;
 state.profile=profileFromForm();renderPlan();
}
async function loadAir(){
 const city=readValue("city").trim();if(city.length<2){toast("Enter a city or district first.");return;}
 const btn=$("refresh-air");btn.disabled=true;btn.textContent="Loading…";$("air-status").textContent="Looking up location and pollutant data…";
 try{
  const response=await fetch(`/api/air-quality?city=${encodeURIComponent(city)}`,{headers:{Accept:"application/json"}});
  const data=await response.json();if(!response.ok)throw new Error(data.detail||data.error||"Air data unavailable.");
  renderAir(data);
 }catch(error){$("air-status").textContent=`Air-quality lookup failed: ${error.message} You can retry or explicitly load sample demo data.`;toast("Air data unavailable.");}
 finally{btn.disabled=false;btn.textContent="Refresh air data ↻";}
}
function loadDemo(){
 const data={demo:true,provider:"ClearSkies built-in sample",location:{name:readValue("city").trim()||"Sample city",admin1:""},updatedAt:new Date().toISOString(),pollutants:{pm25:78,pm10:132,no2:34,so2:12,co:.7,o3:48},cpcbIndicative:{value:158,category:"Moderate",dominantPollutant:"pm25"},aqiNotice:"DEMO DATA ONLY — sample values are invented for interface demonstration and are not real measurements. Do not use for health decisions."};
 renderAir(data);toast("Demo data loaded and clearly labelled.");
}
async function askAssistant(event){
 event.preventDefault();if(state.aiBusy)return;
 const question=readValue("question").trim();if(question.length<3){toast("Please enter a longer question.");return;}
 const profile=profileFromForm();state.aiBusy=true;$("ask-button").disabled=true;$("ask-button").textContent="Thinking…";$("assistant-output").textContent="Preparing a practical answer…";
 try{
  const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({question,profile})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Assistant request failed.");
  const label=data.mode==="gemini"?"GEMINI RESPONSE":"BUILT-IN GUIDANCE";
  const output=$("assistant-output");output.replaceChildren(el("div","answer-label",label),el("div","",data.answer||"No answer returned."));
  if(data.notice)output.append(el("p","small-note",data.notice));
  $("ai-state").textContent=data.mode==="gemini"?"Gemini available":"Local fallback active";
 }catch(error){$("assistant-output").textContent=`The assistant could not complete this request: ${error.message}. Try again or use the action plan above.`;}
 finally{state.aiBusy=false;$("ask-button").disabled=false;$("ask-button").textContent="Ask ClearSkies ↗";}
}
function calculateImpact(event){
 event.preventDefault();
 try{
  const input={monthlyKm:readValue("monthly-km"),currentMode:readValue("current-mode"),alternativeMode:readValue("alternative-mode"),currentOccupancy:readValue("current-occupancy"),alternativeOccupancy:readValue("alternative-occupancy")};
  const result=estimateTripImpact(input),scenarios=compareScenarios(input);
  $("monthly-saved").textContent=`${result.monthlyKgCo2Avoided.toFixed(2)} kg`;
  $("annual-saved").textContent=`${result.annualKgCo2Avoided.toFixed(2)} kg CO₂/year (tailpipe estimate)`;
  const monthlyMoney=safeNumber(readValue("current-cost"),0)-safeNumber(readValue("alternative-cost"),0);
  $("monthly-money").textContent=`Estimated monthly travel savings: ₹${monthlyMoney.toFixed(0)}`;
  $("annual-money").textContent=`Estimated annual travel savings: ₹${(monthlyMoney*12).toFixed(0)}`;
  const chart=$("scenario-chart");chart.replaceChildren();
  const max=Math.max(0.01,...scenarios.map(x=>x.monthlyEmissionsKg));
  for(const item of scenarios){
   const row=el("div","scenario-row");row.append(el("span","",item.name));
   const track=el("div","bar-track"),bar=el("div","bar-fill");bar.style.width=`${Math.max(0,Math.min(100,item.monthlyEmissionsKg/max*100))}%`;track.append(bar);
   row.append(track,el("span","scenario-value",`${item.monthlyEmissionsKg.toFixed(2)} kg`));chart.append(row);
  }
  chart.setAttribute("aria-label",scenarios.map(x=>`${x.name}: ${x.monthlyEmissionsKg.toFixed(2)} kilograms tailpipe CO2 per month`).join(". "));
  $("impact-explanation").textContent=`Compared with your current vehicle, the selected alternative changes the estimate by ${result.monthlyKgCo2Avoided.toFixed(2)} kg tailpipe CO₂/month (${result.annualKgCo2Avoided.toFixed(2)} kg/year). Vehicle-km affected: ${result.vehicleKmAvoided.toFixed(1)} km/month. Assumptions: ${result.assumptions.currentOccupancy} people in current vehicle and ${result.assumptions.alternativeOccupancy} in alternative. Negative savings means the selected alternative is estimated to emit more per passenger. This is not a city AQI reduction.`;
 }catch(error){toast(error.message);}
}

function calculateTwin(event){
 event.preventDefault();
 try{
  const value=id=>readValue(id);
  const result=calculateHouseholdTwin({
   householdSize:value("twin-household"),travellers:value("twin-travellers"),monthlyKmPerTraveller:value("twin-km"),
   currentMode:value("twin-current-mode"),currentOccupancy:value("twin-current-occupancy"),currentTravelSpend:value("twin-current-spend"),
   improvedMode:value("twin-improved-mode"),improvedOccupancy:value("twin-improved-occupancy"),improvedTravelSpend:value("twin-improved-spend"),improvedElectricityReductionPct:value("twin-improved-reduction"),
   stretchMode:value("twin-stretch-mode"),stretchOccupancy:value("twin-stretch-occupancy"),stretchTravelSpend:value("twin-stretch-spend"),stretchElectricityReductionPct:value("twin-stretch-reduction"),
   monthlyKwh:value("twin-kwh"),electricityTariff:value("twin-tariff"),gridFactor:value("twin-grid-factor"),improvementBudget:value("twin-budget"),
   currentOutdoorActivityMinutesPerWeek:value("twin-current-activity"),
   improvedOutdoorActivityMinutesPerWeek:value("twin-improved-activity"),
   stretchOutdoorActivityMinutesPerWeek:value("twin-stretch-activity"),aqi:value("twin-aqi")
  });
  const container=$("twin-results");container.replaceChildren();
  const heading=el("h3","","Monthly household comparison");container.append(heading);
  const grid=el("div","twin-result-grid");
  for(const scenario of result.scenarios){
   const card=el("article","twin-result-card");
   card.append(el("h4","",scenario.name));
   card.append(el("p","twin-total",`${scenario.combinedOperationalKgCo2.toFixed(2)} kg CO₂`),el("p","small-note","Combined operational emissions / month (transport tailpipe + electricity operational only)"));
   card.append(el("p","scenario-routine",scenario.householdRoutine));
   const rows=[
    ["Transport tailpipe CO₂",`${scenario.transportTailpipeKgCo2.toFixed(2)} kg`],
    ["Electricity operational CO₂",`${scenario.electricityOperationalKgCo2.toFixed(2)} kg`],
    ["Electricity use",`${scenario.electricityKwh.toFixed(1)} kWh`],
    ["Electricity reduction vs current",`${scenario.electricityReductionPct.toFixed(1)}%`],
    ["Travel spending",`₹${scenario.travelSpendRupees.toFixed(0)}`],
    ["Electricity bill",`₹${scenario.electricityBillRupees.toFixed(0)}`],
    ["Total monthly cost",`₹${scenario.totalMonthlyCostRupees.toFixed(0)}`],
    ["Cost change vs current",`${scenario.monthlyCostChangeRupeesVsCurrent>=0?"+":"−"}₹${Math.abs(scenario.monthlyCostChangeRupeesVsCurrent).toFixed(0)}`],
    ["CO₂ change vs current",`${scenario.operationalCo2ChangeKgVsCurrent>=0?"+":"−"}${Math.abs(scenario.operationalCo2ChangeKgVsCurrent).toFixed(2)} kg`],
    ["CO₂ reduction vs current",scenario.operationalCo2ReductionPctVsCurrent===null?"Not defined (zero baseline)":`${scenario.operationalCo2ReductionPctVsCurrent.toFixed(1)}%`],
    ["Weekly outdoor activity plan",`${scenario.outdoorActivityMinutesPerWeek} min`]
   ];
   const dl=el("dl","twin-metrics");
   for(const [label,val] of rows){dl.append(el("dt","",label),el("dd","",val));}
   card.append(dl);
   card.append(el("p","budget-status",scenario.budgetStatus==="baseline"?"Baseline":scenario.budgetStatus==="within-budget"?"Within improvement budget":"Above improvement budget"));
   const activity=el("div","activity-plan");
   activity.append(el("strong","",`Outdoor activity · AQI ${scenario.activityGuidance.category}`),el("p","",scenario.activityGuidance.plan));
   const indoor=el("div","activity-plan");indoor.append(el("strong","","Indoor-air routine (not a measured impact)"));
   const indoorList=el("ul","");for(const action of scenario.indoorAirActions)indoorList.append(el("li","",action));indoor.append(indoorList);
   card.append(activity,indoor);
   grid.append(card);
  }
  container.append(grid);
  const context=el("div","twin-context");
  context.append(el("p","small-note",`Household: ${result.householdSize}; travelling members: ${result.travellers}; passenger distance: ${result.passengerKm.toFixed(1)} passenger-km/month. ${result.airQualityContext.interpretation}`));
  context.append(el("p","small-note",`User-entered AQI: ${result.airQualityContext.aqi===null?"not supplied":result.airQualityContext.aqi} (${result.airQualityContext.category||"category unavailable"}). AQI is not included in any CO₂ equation. Personal exposure calculated: no. Inhaled dose calculated: no.`));
  container.append(context);
  const assumptions=el("details","method-details");assumptions.append(el("summary","","Calculation assumptions and boundaries"));
  const list=el("ul","");for(const line of result.assumptions)list.append(el("li","",line));
  assumptions.append(list,el("p","small-note",result.scope));container.append(assumptions);
 }catch(error){toast(error.message);$("twin-results").textContent=error.message;}
}

function restoreChecklist(){
 let saved=[];try{saved=JSON.parse(localStorage.getItem(STORAGE_CHECKLIST)||"[]");}catch{}
 document.querySelectorAll("#checklist input").forEach(input=>input.checked=saved.includes(input.value));updateProgress();
}
function updateProgress(){
 const inputs=[...document.querySelectorAll("#checklist input")],done=inputs.filter(x=>x.checked).length;
 $("progress-label").textContent=`${done} of ${inputs.length} complete`;
 localStorage.setItem(STORAGE_CHECKLIST,JSON.stringify(inputs.filter(x=>x.checked).map(x=>x.value)));
}
async function shareCard(){
 const text=$("share-copy").textContent;
 try{
  if(navigator.share){await navigator.share({title:"ClearSkies clean-air reminder",text});$("share-status").textContent="Share sheet opened.";}
  else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);$("share-status").textContent="Action card copied to clipboard.";}
  else{$("share-status").textContent="Copy is unavailable in this browser. Select the action-card text to copy it.";}
 }catch(error){if(error.name!=="AbortError")$("share-status").textContent="Could not share. You can select and copy the text above.";}
}
function init(){
 restoreProfile();restoreChecklist();
 $("profile-form").addEventListener("submit",e=>{e.preventDefault();saveProfile();});
 $("refresh-air").addEventListener("click",loadAir);$("demo-air").addEventListener("click",loadDemo);
 $("build-plan").addEventListener("click",()=>{saveProfile();});
 $("assistant-form").addEventListener("submit",askAssistant);
 document.querySelectorAll(".prompt-chip").forEach(button=>button.addEventListener("click",()=>{$("question").value=button.dataset.question;$("question").focus();}));
 $("impact-form").addEventListener("submit",calculateImpact);
 $("twin-form").addEventListener("submit",calculateTwin);
 document.querySelectorAll("#checklist input").forEach(input=>input.addEventListener("change",updateProgress));
 $("reset-checklist").addEventListener("click",()=>{document.querySelectorAll("#checklist input").forEach(x=>x.checked=false);updateProgress();});
 $("share-button").addEventListener("click",shareCard);
 $("menu-toggle").addEventListener("click",()=>{const nav=$("mobile-nav"),open=$("menu-toggle").getAttribute("aria-expanded")==="true";$("menu-toggle").setAttribute("aria-expanded",String(!open));nav.hidden=open;});
 document.querySelectorAll("#mobile-nav a").forEach(a=>a.addEventListener("click",()=>{$("mobile-nav").hidden=true;$("menu-toggle").setAttribute("aria-expanded","false");}));
 fetch("/api/health").then(r=>r.json()).then(data=>{$("ai-state").textContent=data.aiConfigured?"Gemini configured · fallback ready":"Local fallback active · Gemini optional";}).catch(()=>$("ai-state").textContent="Local guidance available");
 renderPlan();
}
document.addEventListener("DOMContentLoaded",init);
