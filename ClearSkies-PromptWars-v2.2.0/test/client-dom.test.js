import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");

test("every statically referenced client control exists in the served HTML", () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const references = new Set([
    ...[...app.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]),
    ...[...app.matchAll(/readValue\("([^"]+)"\)/g)].map(match => match[1]),
    ...[...app.matchAll(/value\("(twin-[^"]+)"\)/g)].map(match => match[1])
  ]);
  const missing = [...references].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], `Missing HTML controls: ${missing.join(", ")}`);
});

test("client input accessor reports a named missing control rather than null.value", () => {
  assert.match(app, /function readValue\(id\)[\s\S]*?if \(!element\) throw new Error\(`The page is missing the required input/);
  assert.match(html, /app\.js\?v=2\.2\.1/);
});
