import test from "node:test";
import assert from "node:assert/strict";
import { searchSearxng } from "./lead-discovery.mjs";
import { getRequiredPermission, hasPermission } from "../auth.mjs";

const env={AXIMACH_SEARXNG_URL:"http://127.0.0.1:8080"};
test("SearXNG discovery requests JSON and returns at most ten public results",async()=>{
 let calledUrl="";
 const response=await searchSearxng("CNC machining OEM buyers India",{
  env,now:()=>new Date("2026-11-22T08:00:00.000Z"),
  fetchImpl:async(url,options)=>{
   calledUrl=url;assert.equal(options.method,"GET");assert.equal(options.redirect,"error");
   const parsed=new URL(url);assert.equal(parsed.searchParams.get("format"),"json");
   assert.equal(parsed.searchParams.get("safesearch"),"1");assert.equal(parsed.searchParams.get("pageno"),"1");
   return {ok:true,json:async()=>({results:Array.from({length:12},(_,i)=>({title:"Company "+i,url:"https://example.com/company/"+i,content:"Public result "+i,engines:["google"]}))})};
  }
 });
 assert.equal(new URL(calledUrl).pathname,"/search");assert.equal(response.results.length,10);
 assert.equal(response.provider,"SearXNG");assert.equal(response.retrievedAt,"2026-11-22T08:00:00.000Z");
});
test("SearXNG filters non-web, credential-bearing and local/private result URLs",async()=>{
 const response=await searchSearxng("industrial automation suppliers",{
  env,fetchImpl:async()=>({ok:true,json:async()=>({results:[
   {title:"Private",url:"http://192.168.1.20/"},{title:"Loopback",url:"http://localhost/private"},
   {title:"Script",url:"javascript:alert(1)"},{title:"Credentials",url:"https://user:pass@example.com/"},
   {title:"Public",url:"https://public.example.org/company"}
  ]})})
 });
 assert.deepEqual(response.results.map(row=>row.title),["Public"]);
});
test("SearXNG reports missing configuration and rejects short queries",async()=>{
 await assert.rejects(()=>searchSearxng("CNC",{env:{}}),error=>error.status===503&&error.code==="not-configured");
 await assert.rejects(()=>searchSearxng("  ",{env}),error=>error.status===400&&error.code==="invalid-query");
});
test("SearXNG explains when JSON output is disabled",async()=>{
 await assert.rejects(()=>searchSearxng("precision machining",{env,fetchImpl:async()=>({ok:false,status:403})}),
  error=>error.status===502&&error.code==="json-disabled"&&error.message.includes("settings.yml"));
});
test("lead discovery is a tenant-scoped read permission",()=>{
 assert.equal(getRequiredPermission("/api/lead-discovery/search","POST"),"data:read");
 assert.equal(hasPermission({role:"viewer"},"data:read"),true);
 assert.equal(hasPermission({role:"viewer"},"data:write"),false);
});
