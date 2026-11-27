// CPCB National AQI breakpoints. Concentration units: µg/m³ except CO (mg/m³).
// AQI sub-index is linearly interpolated within each CPCB concentration band.
export const CPCB_BANDS = {
  pm25: [[0,30,0,50],[30,60,51,100],[60,90,101,200],[90,120,201,300],[120,250,301,400],[250,Infinity,401,500]],
  pm10: [[0,50,0,50],[50,100,51,100],[100,250,101,200],[250,350,201,300],[350,430,301,400],[430,Infinity,401,500]],
  no2:  [[0,40,0,50],[40,80,51,100],[80,180,101,200],[180,280,201,300],[280,400,301,400],[400,Infinity,401,500]],
  o3:   [[0,50,0,50],[50,100,51,100],[100,168,101,200],[168,208,201,300],[208,748,301,400],[748,Infinity,401,500]],
  co:   [[0,1,0,50],[1,2,51,100],[2,10,101,200],[10,17,201,300],[17,34,301,400],[34,Infinity,401,500]],
  so2:  [[0,40,0,50],[40,80,51,100],[80,380,101,200],[380,800,201,300],[800,1600,301,400],[1600,Infinity,401,500]]
};

export const CPCB_CATEGORIES = [
  { min: 0, max: 50, label: "Good", advice: "Air quality is satisfactory; continue sensible exposure-reduction habits." },
  { min: 51, max: 100, label: "Satisfactory", advice: "Unusually sensitive people may experience minor discomfort." },
  { min: 101, max: 200, label: "Moderate", advice: "People with lung or heart disease, children and older adults should reduce prolonged or heavy outdoor exertion." },
  { min: 201, max: 300, label: "Poor", advice: "Reduce prolonged outdoor exertion; sensitive groups should take extra care." },
  { min: 301, max: 400, label: "Very Poor", advice: "Avoid strenuous outdoor activity and follow local public-health advisories." },
  { min: 401, max: 500, label: "Severe", advice: "Minimise outdoor exposure and follow official emergency/public-health guidance." }
];

export function cpcbCategory(value) {
  if (!Number.isFinite(value) || value < 0 || value > 500) return null;
  return CPCB_CATEGORIES.find(c => value >= c.min && value <= c.max) ?? null;
}

export function subIndex(pollutant, concentration) {
  const bands = CPCB_BANDS[pollutant];
  if (!bands || !Number.isFinite(concentration) || concentration < 0) return null;
  const severeBand = bands[bands.length-1];
  if (concentration >= severeBand[0]) return severeBand[2];
  for (const [bLow,bHigh,iLow,iHigh] of bands.slice(0,-1)) {
    if (concentration <= bHigh) {
      const bounded = Math.max(bLow, Math.min(concentration, bHigh));
      return Math.round(((iHigh-iLow)/(bHigh-bLow))*(bounded-bLow)+iLow);
    }
  }
  return 500;
}

export function calculateCpcbAqi(pollutants) {
  const values = Object.entries(pollutants ?? {})
    .map(([key, value]) => ({ pollutant:key, concentration:value, index:subIndex(key,value) }))
    .filter(x => x.index !== null && Number.isFinite(x.concentration));
  const hasParticle = values.some(x => x.pollutant === "pm25" || x.pollutant === "pm10");
  if (values.length < 3 || !hasParticle) {
    return { aqi:null, category:null, subIndices:values, valid:false, reason:"CPCB-style AQI needs at least three valid pollutant sub-indices, including PM2.5 or PM10." };
  }
  const worst = values.reduce((a,b) => b.index > a.index ? b : a);
  return { aqi:worst.index, category:cpcbCategory(worst.index), dominantPollutant:worst.pollutant, subIndices:values, valid:true };
}

export function mean(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null;
}
