import { useMemo,useState } from "react";
import { ExternalLink,Globe,Plus,RefreshCw,Search,ShieldCheck } from "lucide-react";
import { getServerAuthHeaders,getServerAuthMode,readServerSession } from "./serverAuth";
import { makeId,nowIso,type CompanyRecord,type ProspectEvidenceRecord,type ProspectRecord,type ProspectStage } from "./manufacturingData";
type SearchResult={title:string;url:string;content:string;engine:string;publishedDate?:string};
type SearchResponse={provider:"SearXNG";query:string;retrievedAt:string;results:SearchResult[]};
type Props={companies:CompanyRecord[];prospects:ProspectRecord[];onSaveProspect:(row:ProspectRecord)=>void;onUpdateProspect:(row:ProspectRecord)=>void;onConvertProspect:(row:ProspectRecord)=>void};
const presets=["CNC machining OEM buyers India","precision components automotive Tier 1 suppliers India","aerospace precision machining procurement suppliers","industrial machinery precision parts sourcing OEM"];
const stages:ProspectStage[]=["New","Reviewed","Qualified","Disqualified","Converted"];
function connection(){
 let base=(window.localStorage.getItem("aximach.scheduler.url")||"").trim();
 while(base.endsWith("/"))base=base.slice(0,-1);
 const key=window.localStorage.getItem("aximach.scheduler.key")||"";
 const userMode=getServerAuthMode()==="users",session=readServerSession(base);
 if(!base||window.localStorage.getItem("aximach.storage.mode")==="local-only")throw new Error("Connect the shared AXIMACH data server before searching for public-web leads.");
 if(userMode&&!session)throw new Error("Sign in to the shared AXIMACH server with a company-scoped user account.");
 if(!userMode&&!key)throw new Error("The shared AXIMACH server API key is not available on this device.");
 return {base,headers:getServerAuthHeaders(key,base,session?.token,userMode)};
}
export default function LeadDiscoveryPanel({companies,prospects,onSaveProspect,onUpdateProspect,onConvertProspect}:Props){
 const [ownerCompanyId,setOwnerCompanyId]=useState("");
 const [query,setQuery]=useState(presets[0]);
 const [busy,setBusy]=useState(false),[searchError,setSearchError]=useState(""),[results,setResults]=useState<SearchResponse|null>(null),[savedMessage,setSavedMessage]=useState("");
 const selected=companies.find(company=>company.id===ownerCompanyId);
 const ownedProspects=useMemo(()=>prospects.filter(row=>!ownerCompanyId||row.ownerCompanyId===ownerCompanyId),[prospects,ownerCompanyId]);
 const search=async()=>{
  setSearchError("");setSavedMessage("");
  if(!ownerCompanyId){setSearchError("Select the AXIMACH company that owns this prospect search.");return;}
  if(query.trim().length<3){setSearchError("Enter at least three characters for the search.");return;}
  setBusy(true);
  try{
   const auth=connection();
   const response=await fetch(auth.base+"/api/lead-discovery/search",{method:"POST",headers:{...auth.headers,"content-type":"application/json"},body:JSON.stringify({query:query.trim(),ownerCompanyId})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(payload.error||"Public-web search failed.");
   setResults(payload as SearchResponse);
  }catch(error){setSearchError(error instanceof Error?error.message:"Public-web search failed.");setResults(null);}
  finally{setBusy(false);}
 };
 const saveResult=(result:SearchResult)=>{
  if(!results||!ownerCompanyId)return;
  const existing=prospects.find(row=>row.ownerCompanyId===ownerCompanyId&&row.evidence.some(item=>item.sourceUrl===result.url));
  const evidence:ProspectEvidenceRecord={id:makeId("prospect-evidence"),provider:"SearXNG",query:results.query,sourceUrl:result.url,sourceTitle:result.title,snippet:result.content,engine:result.engine,retrievedAt:results.retrievedAt,...(result.publishedDate?{publishedAt:result.publishedDate}:{})};
  if(existing){
   if(existing.evidence.some(item=>item.sourceUrl===result.url&&item.retrievedAt===results.retrievedAt)){setSavedMessage("This search result is already saved for the selected company.");return;}
   onSaveProspect({...existing,evidence:[...existing.evidence,evidence].slice(-20),updatedAt:nowIso()});
   setSavedMessage("New source evidence added to "+existing.businessName+".");
  }else{
   const row:ProspectRecord={id:makeId("prospect"),ownerCompanyId,businessName:result.title,stage:"New",evidence:[evidence],createdAt:nowIso(),updatedAt:nowIso()};
   onSaveProspect(row);setSavedMessage("Saved as an unqualified prospect. Verify the company before promotion.");
  }
 };
 const setStage=(row:ProspectRecord,stage:ProspectStage)=>onUpdateProspect({...row,stage,updatedAt:nowIso()});
 return <section className="lead-discovery">
  <header className="lead-discovery-head"><div><div className="eyebrow">PUBLIC WEB / COMPANY DISCOVERY</div><h2>Lead Discovery</h2><p>Find public company information and collect source evidence. Results stay as unqualified prospects until a person reviews them.</p></div><div className="lead-discovery-provider"><Globe size={16}/><span>SearXNG · self-hosted search</span></div></header>
  <div className="lead-discovery-safety"><ShieldCheck size={16}/><span>Search results are unverified. AXIMACH does not automatically create customers, extract private contact details or send outreach.</span></div>
  <div className="lead-discovery-search panel">
   <label className="customer-field"><span>Owning AXIMACH company *</span><select value={ownerCompanyId} onChange={event=>setOwnerCompanyId(event.target.value)}><option value="">Select company...</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
   <label className="customer-field"><span>Search the public web</span><input aria-label="Lead discovery query" value={query} onChange={event=>setQuery(event.target.value)} placeholder="e.g. CNC machining OEM buyers India"/></label>
   <div className="lead-discovery-presets">{presets.map(item=><button type="button" key={item} className="lead-preset" onClick={()=>setQuery(item)}>{item}</button>)}</div>
   <div className="lead-discovery-actions"><button type="button" className="button-primary" onClick={search} disabled={busy||!ownerCompanyId}><Search size={14}/>{busy?"Searching public sources...":"Search public web"}</button><span>{selected?"Results will be assigned to "+selected.name+".":"Choose an owning company before searching."}</span></div>
   {searchError&&<div className="lead-discovery-warning" role="alert">{searchError}</div>}
   {savedMessage&&<div className="lead-discovery-success" role="status">{savedMessage}</div>}
  </div>
  {results&&<section className="lead-discovery-results panel"><header><div><h3>{results.results.length} public search results</h3><p>Query: “{results.query}” · Retrieved {new Date(results.retrievedAt).toLocaleString()}</p></div><button className="button-quiet compact-button" onClick={search} disabled={busy}><RefreshCw size={13}/> Refresh</button></header>
   {results.results.length?results.results.map(result=>{
    const saved=prospects.some(row=>row.ownerCompanyId===ownerCompanyId&&row.evidence.some(item=>item.sourceUrl===result.url));
    return <article className="lead-result" key={result.url}><div className="lead-result-main"><strong>{result.title}</strong><p>{result.content||"No snippet supplied by search provider."}</p><a href={result.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12}/>{result.url}</a><small>{result.engine||"Search engine"}{result.publishedDate?" · "+result.publishedDate:""}</small></div><button type="button" className="button-quiet compact-button" onClick={()=>saveResult(result)}><Plus size={13}/>{saved?"Add evidence":"Save prospect"}</button></article>;
   }):<p className="lead-empty">No public results were returned for this query.</p>}
  </section>}
  <section className="lead-prospect-list panel"><header><div><h3>Saved prospects</h3><p>{ownedProspects.length} unqualified or reviewed records in the selected scope</p></div></header>
   {ownedProspects.length?ownedProspects.map(row=><article className="lead-prospect" key={row.id}><div className="lead-prospect-main"><strong>{row.businessName}</strong><small>{companies.find(company=>company.id===row.ownerCompanyId)?.name||"Owning company"} · {row.evidence.length} source item(s)</small>{row.evidence.slice(-2).map(item=><a key={item.id} href={item.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={11}/>{item.sourceTitle||item.sourceUrl}</a>)}</div><div className="lead-prospect-actions"><select aria-label={"Review stage for "+row.businessName} value={row.stage} disabled={row.stage==="Converted"} onChange={event=>setStage(row,event.target.value as ProspectStage)}>{stages.map(stage=><option key={stage} disabled={stage==="Converted"}>{stage}</option>)}</select>{row.stage==="Qualified"&&<button type="button" className="button-primary compact-button" onClick={()=>onConvertProspect(row)}>Promote to customer</button>}{row.stage==="Converted"&&<span className="lead-converted">Converted · On hold</span>}</div></article>):<div className="lead-empty">No prospects saved yet. Search public sources and save a result for review.</div>}
  </section>
 </section>;
}
