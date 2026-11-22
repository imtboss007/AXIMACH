function fail(status,code,message){const error=new Error(message);error.status=status;error.code=code;return error;}
function cleanText(value,max){
 let cleaned="";
 for(const character of String(value??"")){
  const code=character.charCodeAt(0);
  cleaned+=(code<32||code===127)?" ":character;
 }
 return cleaned.split(" ").filter(Boolean).join(" ").trim().slice(0,max);
}
function publicResultUrl(value){
 try{
  const url=new URL(String(value||""));
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return "";
  let host=url.hostname.toLowerCase();
  if(host.startsWith("[")&&host.endsWith("]"))host=host.slice(1,-1);
  if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host==="::1"||
     (host.includes(":")&&(host.startsWith("fc")||host.startsWith("fd")||host.startsWith("fe80:"))))return "";
  const octets=host.split(".").map(Number);
  if(octets.length===4&&octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255)){
   const [a,b]=octets;
   if(a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168))return "";
  }
  url.hash="";
  return url.toString();
 }catch{return "";}
}
export async function searchSearxng(query,{env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
 const term=cleanText(query,241);
 if(term.length<3||term.length>240)throw fail(400,"invalid-query","Search query must contain between 3 and 240 characters.");
 const configured=String(env.AXIMACH_SEARXNG_URL||"").trim();
 if(!configured)throw fail(503,"not-configured","SearXNG is not configured. Set AXIMACH_SEARXNG_URL on the shared AXIMACH server and enable JSON output in SearXNG settings.");
 let endpoint;
 try{
  endpoint=new URL(configured);
  if(!["http:","https:"].includes(endpoint.protocol)||endpoint.username||endpoint.password)throw new Error("invalid");
  endpoint.search="";endpoint.hash="";
  let suffix=endpoint.pathname;
  while(suffix.endsWith("/"))suffix=suffix.slice(0,-1);
  if(!suffix.toLowerCase().endsWith("/search"))suffix+="/search";
  endpoint.pathname=suffix||"/search";
 }catch{throw fail(503,"invalid-configuration","AXIMACH_SEARXNG_URL must be a valid HTTP(S) SearXNG base URL without credentials.");}
 endpoint.searchParams.set("q",term);
 endpoint.searchParams.set("format","json");
 endpoint.searchParams.set("safesearch","1");
 endpoint.searchParams.set("pageno","1");
 let response;
 try{
  response=await fetchImpl(endpoint.toString(),{method:"GET",headers:{accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(12000)});
 }catch{throw fail(502,"provider-unavailable","AXIMACH could not reach the configured SearXNG service.");}
 if(!response.ok){
  if(response.status===403)throw fail(502,"json-disabled","SearXNG rejected JSON output. Enable the json format in the instance settings.yml and retry.");
  throw fail(502,"provider-error","SearXNG returned HTTP "+response.status+".");
 }
 let payload;
 try{payload=await response.json();}catch{throw fail(502,"invalid-response","SearXNG did not return valid JSON.");}
 if(!payload||!Array.isArray(payload.results))throw fail(502,"invalid-response","SearXNG response did not contain a results array.");
 const seen=new Set(),results=[];
 for(const item of payload.results){
  if(!item||typeof item!=="object")continue;
  const url=publicResultUrl(item.url),title=cleanText(item.title,240);
  if(!url||!title||seen.has(url))continue;
  seen.add(url);
  const engines=Array.isArray(item.engines)?item.engines:[];
  results.push({title,url,content:cleanText(item.content,1200),engine:cleanText(engines.join(", "),120),
   ...(item.publishedDate||item.published_date?{publishedDate:cleanText(item.publishedDate||item.published_date,80)}:{})});
  if(results.length===10)break;
 }
 return {provider:"SearXNG",query:term,retrievedAt:now().toISOString(),results};
}
