export function cleanText(value, maxLength=1200) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"").trim().slice(0,maxLength);
}
export function validateAssistantBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok:false, error:"Request body must be a JSON object." };
  const question = cleanText(body.question,1200);
  if (question.length < 3) return { ok:false, error:"Please enter a question with at least 3 characters." };
  const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
  const city = cleanText(profile.city,100);
  const budget = ["low","medium","flexible"].includes(profile.budget) ? profile.budget : "low";
  const householdSize = Number(profile.householdSize);
  if (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 20) return { ok:false, error:"Household size must be between 1 and 20." };
  const commute = ["two-wheeler","car","bus","auto","walk","mixed"].includes(profile.commute) ? profile.commute : "mixed";
  const vulnerable = Array.isArray(profile.vulnerable) ? profile.vulnerable.filter(x=>["children","older-adults","respiratory"].includes(x)).slice(0,3) : [];
  return { ok:true, value:{ question, profile:{ city, budget, householdSize, commute, vulnerable, schedule:cleanText(profile.schedule,100), home:cleanText(profile.home,80), filtration:cleanText(profile.filtration,80), aqi: profile.aqi !== null && profile.aqi !== undefined && profile.aqi !== "" && Number.isFinite(Number(profile.aqi))
      ? Math.max(0,Math.min(500,Number(profile.aqi))) : null, aqiSource:cleanText(profile.aqiSource,80) } } };
}
