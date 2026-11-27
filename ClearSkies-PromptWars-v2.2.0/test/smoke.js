import { createServer } from "../server.js";
const server=createServer();
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
try {
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  if(!response.ok) process.exitCode=1;
  else console.log("Smoke check passed:",await response.text());
} finally { await new Promise(resolve=>server.close(resolve)); }
