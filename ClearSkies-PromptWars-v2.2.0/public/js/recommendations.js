export function buildRecommendations(profile={}) {
  const aqi = Number.isFinite(profile.aqi) ? profile.aqi : null;
  const budget = profile.budget || "low";
  const commute = profile.commute || "mixed";
  const vulnerable = Array.isArray(profile.vulnerable) ? profile.vulnerable : [];
  const severe = aqi !== null && aqi >= 301;
  const poor = aqi !== null && aqi >= 201;
  const sensitive = vulnerable.length > 0;
  const scheduleAdvice = profile.schedule === "morning"
    ? "Since your household is usually outdoors early, check the morning hourly trend before exercise or school travel."
    : profile.schedule === "evening"
      ? "Since your household is usually outdoors in the evening, check conditions near the time you leave rather than relying on a morning reading."
      : profile.schedule === "daytime"
        ? "Check conditions before the daytime commute and any outdoor errands."
        : "Check conditions close to each planned outdoor activity.";
  const householdNote = Number.isInteger(profile.householdSize) && profile.householdSize > 1
    ? ` For a household of ${profile.householdSize}, agree on one shared routine and coordinate trips where practical.`
    : "";
  const items = [
    { group:"Immediate actions", title:"Check the latest local advisory before outdoor plans", action:`Use the nearest official monitoring-station update where available. Treat model forecasts as estimates, not a station observation. ${scheduleAdvice}${householdNote}`, why:"AQI can vary by neighbourhood and time; a forecast grid cell is not a roadside monitor.", difficulty:"Easy", cost:"₹0", benefit:"Better-timed exposure decisions", priority:1 },
    { group:"Indoor air", title:"Reduce particle sources indoors", action:"Avoid indoor smoking, incense and unnecessary candles; use a kitchen exhaust that vents outdoors while cooking when safe and available.", why:"Combustion and cooking can add particles indoors.", difficulty:"Easy", cost:"₹0", benefit:"Reduces avoidable indoor pollution sources", priority:2 },
    { group:"Indoor air", title:"Use low-dust cleaning", action:"Damp-wipe surfaces and wet-mop instead of dry sweeping. Avoid aerosol sprays and strongly scented products.", why:"Damp methods reduce dust resuspension compared with dry sweeping.", difficulty:"Easy", cost:"Low", benefit:"Less settled dust re-entering room air", priority:3 },
    { group:"Daily routine", title:"Move strenuous exercise away from polluted periods", action: severe ? "Choose indoor, lower-intensity activity and avoid strenuous outdoor exercise while conditions remain very poor or severe." : "Check the hourly trend and choose a cleaner time and route; reduce strenuous outdoor exertion if air quality worsens.", why:"Breathing rate rises during exertion, increasing inhaled pollution dose.", difficulty:"Easy", cost:"₹0", benefit:"Can reduce time spent breathing polluted outdoor air", priority:4 },
    { group:"Low-emission transport", title:"Replace one suitable solo trip", action: commute==="car" || commute==="two-wheeler" ? "Try a bus, shared auto, carpool or combined errands for one suitable trip; compare travel time and safety first." : "Combine errands and use public transport or a shared ride when practical; walk/cycle only on suitable routes and when air quality allows.", why:"Fewer separate vehicle-kilometres can reduce transport tailpipe emissions.", difficulty:"Medium", cost:budget==="low"?"Potentially lower than solo travel":"Varies by route", benefit:"Estimated transport emissions reduction; not a direct AQI change", priority:5 },
    { group:"Indoor air", title:"Consider a correctly sized particle filter", action:"If affordable, choose a room-appropriate mechanical HEPA air cleaner, check clean-air delivery rate/room size, and replace filters as specified. Avoid ozone generators.", why:"A properly sized mechanical particle filter can reduce airborne particles in the treated room.", difficulty:"Medium", cost:budget==="low"?"Optional purchase; not required":"Upfront purchase + filters", benefit:"Particle reduction in treated indoor space", priority:6 },
    { group:"Weekly goals", title:"Review your household's pollution sources", action:"Check cooking ventilation, dampness, dust entry points, vehicle trips and electricity use once a week. Choose one change you can sustain.", why:"Small repeatable changes are easier to maintain than a large one-time pledge.", difficulty:"Easy", cost:"₹0", benefit:"Builds a measurable household routine", priority:7 }
  ];
  if (sensitive) items.unshift({ group:"Immediate actions", title:"Plan around household members who may be more sensitive", action:"Keep children, older adults and people with existing heart or lung conditions away from heavy-traffic edges and strenuous outdoor activity during poor-air periods. Follow clinician and official local advice.", why:"These groups may be more affected by air pollution.", difficulty:"Easy", cost:"₹0", benefit:"More cautious exposure planning", priority:0 });
  if (poor) items[0].action += " Current selected AQI is in the Poor-or-worse range; prioritise reducing prolonged outdoor exertion.";
  if (severe) items[3].action = "Avoid outdoor exertion; keep activities indoors where indoor air is cleaner, and follow official public-health instructions.";
  return items.sort((a,b)=>a.priority-b.priority);
}
