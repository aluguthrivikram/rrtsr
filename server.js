import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateCpcbAqi, mean } from "./src/aqi.js";
import { buildRecommendations } from "./src/recommendations.js";
import { validateAssistantBody, cleanText } from "./src/validation.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(ROOT,"public");
const MIME = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
const cache = new Map();
const buckets = new Map();
const AI_LIMIT = Number(process.env.AI_RATE_LIMIT || 8);
const AI_WINDOW = Number(process.env.AI_RATE_WINDOW_MS || 600000);
const AIR_LIMIT = Number(process.env.AIR_RATE_LIMIT || 30);
const AIR_WINDOW = Number(process.env.AIR_RATE_WINDOW_MS || 60000);
const MAX_BODY = 12 * 1024;

function json(res,status,data) {
  const body = JSON.stringify(data);
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(body);
}
function headers(res) {
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy","same-origin");
  res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}
function rateLimit(req, route, limit, windowMs) {
  if (buckets.size > 5000) {
    const now = Date.now();
    for (const [entry, value] of buckets) if (value.reset <= now) buckets.delete(entry);
    if (buckets.size > 5000) buckets.clear();
  }
  const key = `${route}:${req.socket.remoteAddress || "unknown"}`;
  const now = Date.now(), current = buckets.get(key);
  if (!current || now >= current.reset) { buckets.set(key,{count:1,reset:now+windowMs}); return {ok:true}; }
  current.count++;
  return {ok:current.count<=limit, retryAfter:Math.max(1,Math.ceil((current.reset-now)/1000))};
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers.host || ""); } catch { return false; }
}
async function bodyJson(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Request body too large."),{status:413});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid JSON body."),{status:400}); }
}
async function fetchJson(url, timeout=12000) {
  const response = await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{"Accept":"application/json","User-Agent":"ClearSkies/2.0"}});
  if (!response.ok) throw new Error(`Upstream service returned ${response.status}.`);
  return response.json();
}
function cached(key, ttl) {
  const hit=cache.get(key);
  if (hit && hit.expires>Date.now()) return hit.value;
  return null;
}
function putCache(key,value,ttl) { cache.set(key,{value,expires:Date.now()+ttl}); }

async function geocode(city) {
  const key=`geo:${city.toLowerCase()}`, hit=cached(key,86400000);
  if (hit) return hit;
  const url=new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search=new URLSearchParams({name:city,count:"1",language:"en",format:"json"});
  const data=await fetchJson(url);
  const place=data.results?.[0];
  if (!place) throw new Error("No matching location was found. Try a nearby city or district.");
  const result={name:place.name,admin1:place.admin1||"",country:place.country||"",latitude:place.latitude,longitude:place.longitude,timezone:place.timezone||"auto"};
  putCache(key,result,86400000); return result;
}
function latestMean(hourly, key, count, nowIndex) {
  const vals=(hourly?.[key]||[]).slice(Math.max(0,nowIndex-count+1),nowIndex+1);
  return vals.length>=Math.ceil(count*.65) ? mean(vals.filter(v=>v!==null)) : null;
}
async function airQuality(city) {
  const place=await geocode(city);
  const cacheKey=`air:${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
  const hit=cached(cacheKey,900000); if(hit) return {...hit,cache:"hit"};
  const url=new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.search=new URLSearchParams({
    latitude:String(place.latitude),longitude:String(place.longitude),
    hourly:"pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
    past_days:"1",forecast_days:"1",timezone:"UTC"
  });
  const data=await fetchJson(url);
  const times=data.hourly?.time||[];
  if (!times.length) throw new Error("The air-quality provider returned no hourly observations.");
  const now=Date.now();
  let index=times.length-1;
  for(let i=times.length-1;i>=0;i--){ if(Date.parse(times[i]+"Z")<=now){index=i;break;} }
  const pm25=latestMean(data.hourly,"pm2_5",24,index);
  const pm10=latestMean(data.hourly,"pm10",24,index);
  const no2=latestMean(data.hourly,"nitrogen_dioxide",24,index);
  const so2=latestMean(data.hourly,"sulphur_dioxide",24,index);
  const coRaw=latestMean(data.hourly,"carbon_monoxide",8,index);
  const o3=latestMean(data.hourly,"ozone",8,index);
  const pollutants={pm25,pm10,no2,so2,co:coRaw===null?null:coRaw/1000,o3};
  const valid=Object.fromEntries(Object.entries(pollutants).filter(([,v])=>v!==null));
  const calculated=calculateCpcbAqi(valid);
  const stamp=times[index];
  const result={
    location:place,
    provider:"Open-Meteo Air Quality API · CAMS model",
    sourceUrl:"https://open-meteo.com/en/docs/air-quality-api",
    updatedAt:new Date(stamp+"Z").toISOString(),
    modelled:true,
    pollutants,
    averaging:"PM2.5, PM10, NO₂ and SO₂: trailing 24 hourly model values; CO and O₃: trailing 8 hourly model values.",
    cpcbIndicative:calculated.valid?{value:calculated.aqi,category:calculated.category.label,dominantPollutant:calculated.dominantPollutant,subIndices:calculated.subIndices}:null,
    aqiNotice:"This is a model-derived indicative estimate using CPCB concentration breakpoints, not an official CPCB/CAAQMS station AQI. Model resolution and averaging differ from regulatory monitoring."
  };
  putCache(cacheKey,result,900000); return result;
}
function fallbackAnswer(question, profile) {
  const recommendations=buildRecommendations({...profile,aqi:profile.aqi});
  return [
    "Here is a practical starting point based on the details you provided:",
    ...recommendations.slice(0,4).map((r,i)=>`${i+1}. ${r.title}: ${r.action} Why: ${r.why}`),
    "",
    "Data note: I have not independently verified your local AQI. Check the latest official CPCB/State Pollution Control Board advisory. This is general information, not a medical diagnosis."
  ].join("\n");
}
async function assistant(body) {
  const parsed=validateAssistantBody(body);
  if(!parsed.ok) return {status:400,data:{error:parsed.error}};
  const {question,profile}=parsed.value;
  if(!process.env.GEMINI_API_KEY) return {status:200,data:{mode:"fallback",answer:fallbackAnswer(question,profile),notice:"Gemini is not configured. Local guidance is active."}};
  const model=cleanText(process.env.GEMINI_MODEL||"gemini-2.5-flash",80);
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const system=`You are ClearSkies, a cautious clean-air assistant for Indian households. Use the profile only as user-provided context, never as verified live data. Do not diagnose, prescribe, promise health outcomes, or invent AQI/pollutant readings. Do not suggest unsafe chemical cleaning, ozone generators, or plants as substitutes for filtration. Explain practical steps, why they matter, cost/difficulty, and assumptions. Be mindful of affordability and Indian travel/cooking/home contexts. Distinguish exposure reduction from emissions reduction. If pollution is severe, recommend checking official CPCB/state advisories and seeking medical advice for symptoms.`;
  const prompt=`Household context (user supplied): ${JSON.stringify(profile)}\nQuestion: ${question}\nGive concise, structured, actionable advice with headings: Do now; Indoor air; Travel/routine; Why it matters; Limits and sources to check.`;
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:850}}),signal:AbortSignal.timeout(18000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(`Gemini provider error ${response.status}`);
  const answer=data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
  if(!answer) throw new Error("Gemini returned an empty response.");
  return {status:200,data:{mode:"gemini",answer}};
}

async function handler(req,res) {
  headers(res);
  const url=new URL(req.url,"http://localhost");
  if(!sameOrigin(req)){json(res,403,{error:"Cross-origin request rejected."});return;}
  if(req.method==="GET" && url.pathname==="/api/health"){json(res,200,{ok:true,service:"ClearSkies",version:"2.2.1",aiConfigured:Boolean(process.env.GEMINI_API_KEY)});return;}
  if(req.method==="GET" && url.pathname==="/api/air-quality"){
    const limited=rateLimit(req,"air",AIR_LIMIT,AIR_WINDOW);
    if(!limited.ok){res.setHeader("Retry-After",String(limited.retryAfter));json(res,429,{error:"Too many air-quality requests. Please wait and retry."});return;}
    const city=cleanText(url.searchParams.get("city"),100);
    if(city.length<2){json(res,400,{error:"Enter a city or district name."});return;}
    try{json(res,200,await airQuality(city));}
    catch(e){json(res,503,{error:"Air-quality data is temporarily unavailable.",detail:e.message.includes("No matching")?e.message:"Try again later or use the clearly labelled demo data."});}
    return;
  }
  if(req.method==="POST" && url.pathname==="/api/assistant"){
    const limited=rateLimit(req,"ai",AI_LIMIT,AI_WINDOW);
    if(!limited.ok){res.setHeader("Retry-After",String(limited.retryAfter));json(res,429,{error:"Assistant rate limit reached. Please wait before asking again."});return;}
    try{
      const body=await bodyJson(req);
      try{const result=await assistant(body);json(res,result.status,result.data);}
      catch(e){json(res,200,{mode:"fallback",answer:fallbackAnswer(cleanText(body?.question,1200),body?.profile||{}),notice:"The AI service is unavailable; local guidance is shown instead."});}
    }catch(e){json(res,e.status||400,{error:e.status===413?"Request body too large.":"Invalid request."});}
    return;
  }
  if(req.method!=="GET"){json(res,405,{error:"Method not allowed."});return;}
  let pathname=decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname);
  const safe=normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const file=join(PUBLIC,safe);
  if(!file.startsWith(PUBLIC)){json(res,403,{error:"Forbidden."});return;}
  try{
    const data=await readFile(file);
    res.writeHead(200,{"Content-Type":MIME[extname(file)]||"application/octet-stream","Cache-Control":extname(file)===".html"?"no-cache":"public, max-age=3600"});
    res.end(data);
  }catch{json(res,404,{error:"Not found."});}
}
export function createServer(){return http.createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent)json(res,500,{error:"Unexpected server error."});});});}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const server=createServer();
  const host=process.env.HOST||"127.0.0.1",port=Number(process.env.PORT||3000);
  server.listen(port,host,()=>console.log(`ClearSkies listening at http://${host}:${port}`));
}
