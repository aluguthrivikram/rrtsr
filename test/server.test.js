import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.js";

let server, base;
test("HTTP integration: health, static assets, security headers, API validation and same-origin protection",async t=>{
  server=createServer();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>server.close(resolve)));

  const health=await fetch(`${base}/api/health`);
  assert.equal(health.status,200);
  assert.equal((await health.json()).service,"ClearSkies");
  assert.equal(health.headers.get("x-frame-options"),"DENY");
  assert.match(health.headers.get("content-security-policy"),/default-src 'self'/);

  const page=await fetch(`${base}/`);
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/Breathe smarter/);
  assert.match(html,/twin-current-activity/);
  assert.match(html,/twin-improved-activity/);
  assert.match(html,/twin-stretch-activity/);
  assert.match(html,/Keep the measures separate/);
  const css=await fetch(`${base}/css/styles.css`);
  assert.equal(css.status,200);
  assert.match(css.headers.get("content-type"),/text\/css/);
  const js=await fetch(`${base}/js/app.js`);
  assert.equal(js.status,200);
  assert.match(js.headers.get("content-type"),/javascript/);
  const twinModule=await fetch(`${base}/js/household-twin.js`);
  assert.equal(twinModule.status,200);
  assert.match(await twinModule.text(),/calculateHouseholdTwin/);
  const appModule=await fetch(`${base}/js/app.js`);
  assert.equal(appModule.status,200);
  assert.match(await appModule.text(),/currentOutdoorActivityMinutesPerWeek/);

  const invalid=await fetch(`${base}/api/assistant`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"x",profile:{householdSize:2}})});
  assert.equal(invalid.status,400);

  const fallback=await fetch(`${base}/api/assistant`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"How do I reduce indoor dust?",profile:{householdSize:4,budget:"low",commute:"bus",vulnerable:[]}})});
  assert.equal(fallback.status,200);
  const fallbackBody=await fallback.json();
  assert.equal(fallbackBody.mode,"fallback");
  assert.match(fallbackBody.answer,/indoor|air|pollution/i);

  const cross=await fetch(`${base}/api/assistant`,{method:"POST",headers:{"Content-Type":"application/json","Origin":"https://attacker.example"},body:JSON.stringify({question:"How can I reduce pollution?",profile:{householdSize:2}})});
  assert.equal(cross.status,403);

  const tooLarge=await fetch(`${base}/api/assistant`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"x".repeat(15000),profile:{householdSize:2}})});
  assert.equal(tooLarge.status,413);
});
