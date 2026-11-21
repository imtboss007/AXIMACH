const DEFINITIONS = [
  // Existing AXIMACH runtime
  ["react","React","Frontend","runtime","in-app","Existing application UI foundation.","https://github.com/facebook/react","MIT"],
  ["vite","Vite","Developer workflow","runtime","in-app","Existing build and development server.","https://github.com/vitejs/vite","MIT"],
  ["motion","Motion","UI and motion","runtime","in-app","Existing animation and interaction runtime.","https://github.com/motiondivision/motion","MIT"],
  ["lucide","Lucide React","UI and motion","runtime","in-app","Existing icon system.","https://github.com/lucide-icons/lucide","ISC"],
  ["tabler","Tabler Icons","UI and motion","runtime","in-app","Existing secondary icon inventory.","https://github.com/tabler/tabler-icons","MIT"],
  ["exceljs","ExcelJS","Data exchange","runtime","in-app","Existing XLSX export support.","https://github.com/exceljs/exceljs","MIT"],
  ["pptxgenjs","PptxGenJS","Data exchange","runtime","in-app","Existing PPTX export support.","https://github.com/gitbrent/PptxGenJS","MIT"],
  ["playwright","Playwright","Testing and quality","runtime","in-app","Existing browser smoke and workflow test runner.","https://github.com/microsoft/playwright","Apache-2.0"],
  ["echarts","Apache ECharts","Analytics and forms","runtime","adding","Adopted for interactive saved-record analytics and integration coverage visualisation.","https://github.com/apache/echarts","Apache-2.0"],
  ["zod","Zod","Analytics and forms","runtime","adding","Adopted for runtime validation of connector registry and untrusted integration payloads.","https://github.com/colinhacks/zod","MIT"],

  // Design, UI and experience references
  ["unslop","Unslop","Design and UI","skill","reference","Visual quality and anti-generic UI review; development-time skill only."],
  ["gstack","gstack","Developer workflow","skill","reference","Engineering planning, code review, QA and release workflow."],
  ["ruflo","Ruflo","AI and agents","framework","candidate","Evaluate for agent-team coordination only where LangGraph leaves a distinct gap."],
  ["unlumen-ui","Unlumen UI","Design and UI","component-catalogue","verify","Selectively adapt components after exact source and licence review."],
  ["magic-ui","Magic UI","Design and UI","component-catalogue","candidate","Selective visual components; reuse current Motion runtime."],
  ["smoothui","SmoothUI","Design and UI","component-catalogue","verify","Verify source and Tailwind compatibility before selective reuse."],
  ["generative-ui","Generative UI","AI and agents","pattern","candidate","Schema-constrained dynamic UI rendered with approved AXIMACH components."],
  ["skiper-ui","Skiper UI","Design and UI","component-catalogue","verify","Canonical repository, component licence and dependencies need verification."],
  ["animmaster-lib","Animmaster Lib","Design and UI","component-catalogue","verify","Reference only until exact source, paid-tier terms and component rights are confirmed."],
  ["threeui","ThreeUI","3D and workflow graphs","component-catalogue","verify","Ambiguous project name; resolve exact upstream before code reuse."],
  ["impeccable","Impeccable","Design and UI","skill","reference","Design critique for hierarchy, density, clarity and consistency."],
  ["taste-skill","Taste Skill","Design and UI","skill","reference","Art direction and visual quality guidance."],
  ["ui-ux-pro-max","UI UX Pro Max","Design and UI","skill","reference","Design-system and layout reference generation."],
  ["ui-skills","UI Skills","Design and UI","skill","reference","Focused frontend implementation and accessibility skills."],
  ["emil-kowalski-skills","Emil Kowalski Skills","Design and UI","skill","reference","Interaction and motion-design review."],
  ["hallmark","Hallmark","Design and UI","reference-project","verify","Exact project identity and licence need verification."],
  ["react-bits","React Bits","Design and UI","component-catalogue","candidate","Selective visual effects and micro-interactions."],
  ["cult-ui","Cult UI","Design and UI","component-catalogue","candidate","Selective interaction patterns; not a second global design system."],
  ["origin-ui","Origin UI","Design and UI","component-catalogue","candidate","Form, control and layout patterns for selective adaptation."],
  ["aceternity-ui","Aceternity UI","Design and UI","component-catalogue","candidate","Use sparingly for overview experiences, not dense factory forms."],
  ["motion-primitives","Motion Primitives","Design and UI","component-catalogue","candidate","Motion patterns adapted to the installed Motion runtime."],
  ["gsap","GSAP","Design and UI","library","candidate","Specialist timeline animations only when Motion is insufficient."],
  ["mantine","Mantine","Design and UI","component-framework","candidate","Reference or isolated utility; avoid replacing AXIMACH's existing design system."],
  ["volt-agent-design-md","VoltAgent / awesome-design-md","Design and UI","reference-index","reference","Design references and design-context discovery."],

  // Data UI and visualisation
  ["tanstack-table","TanStack Table","Analytics and forms","library","candidate","High-volume manufacturing registers with sorting, grouping and filtering."],
  ["tanstack-virtual","TanStack Virtual","Analytics and forms","library","candidate","Virtualised rendering for measured large-list performance bottlenecks."],
  ["react-flow","React Flow (xyflow)","3D and workflow graphs","library","candidate","Process graph editing if current Route Flow's tested interactions require it."],
  ["react-three-fiber","React Three Fiber","3D and workflow graphs","library","candidate","Advanced interactive factory, cell and machine scenes."],
  ["drei","React Three Drei","3D and workflow graphs","library","candidate","Helpers only alongside a justified React Three Fiber scene."],
  ["react-hook-form","React Hook Form","Analytics and forms","library","candidate","Complex engineering, supplier, invoice and quality forms."],
  ["react-grid-layout","React Grid Layout","Analytics and forms","library","candidate","Configurable user dashboards when persisted identity/preferences are ready."],

  // AI and agent stack
  ["langgraph","LangGraph","AI and agents","framework","candidate","Stateful agent workflows with checkpoints and human-approval pauses.","https://github.com/langchain-ai/langgraph"],
  ["openhands","OpenHands","Developer workflow","agent","candidate","Isolated development-time coding tasks; review patches before accepting.","https://github.com/OpenHands/OpenHands"],
  ["copilotkit","CopilotKit","AI and agents","ui-framework","candidate","Record-aware copilot UI and approved tool invocation."],
  ["a2ui","A2UI","AI and agents","protocol","candidate","Declarative, allowlisted agent-generated UI."],
  ["ag-ui","AG-UI","AI and agents","protocol","candidate","Agent-to-UI event stream.","https://github.com/ag-ui-protocol/ag-ui"],
  ["vercel-ai-sdk","Vercel AI SDK","AI and agents","sdk","candidate","Model streaming and typed tool-call adapter."],
  ["voltagent","VoltAgent","AI and agents","framework","candidate","Evaluate as an alternative/adjunct agent runtime, not a duplicate orchestrator."],
  ["companyscope-mcp","CompanyScope MCP","Company and lead intelligence","mcp-connector","verify","Company research connector; exact upstream and data terms to verify."],
  ["agent-reach","Agent Reach","Company and lead intelligence","connector","verify","Company/prospect discovery candidate; verify exact source and data rights."],
  ["opengtm","OpenGTM","Company and lead intelligence","connector","verify","GTM and company discovery candidate."],
  ["openprospector","OpenProspector","Company and lead intelligence","connector","verify","Prospect discovery candidate."],
  ["openenrich","OpenEnrich","Company and lead intelligence","connector","verify","Company/contact enrichment candidate."],
  ["open-hunter","Open Hunter","Company and lead intelligence","connector","verify","Prospecting candidate; confirm canonical source."],
  ["open-outreach","OpenOutreach","Company and lead intelligence","workflow","verify","Consent-aware outreach with human review and suppression lists."],
  ["medi-gen-ai","Medi Gen AI","AI and agents","domain-tool","verify","Domain-specific candidate; verify scope, safety and licence."],
  ["treg","Treg","AI and agents","tool","verify","Resolve exact project identity and purpose before use."],

  // Backend, persistence and orchestration
  ["supabase","Supabase","Backend and data","platform","candidate","Postgres, authentication and storage candidate; require tested tenant RLS and migration.","https://github.com/supabase/supabase"],
  ["dexie","Dexie.js","Backend and data","library","candidate","IndexedDB local/offline store; only add with an explicit cache/migration design.","https://github.com/dexie/Dexie.js"],
  ["powersync","PowerSync","Backend and data","sync-engine","candidate","Offline-to-Postgres sync candidate; do not run alongside a competing sync engine.","https://github.com/powersync-ja/powersync"],
  ["temporal","Temporal","Backend and data","workflow-engine","candidate","Durable retries and long-running business workflows.","https://github.com/temporalio/temporal"],
  ["nx","Nx","Developer workflow","monorepo-tool","candidate","Affected builds/tests if AXIMACH splits into multiple apps and packages.","https://github.com/nrwl/nx"],
  ["turborepo","Turborepo","Developer workflow","monorepo-tool","candidate","Alternative monorepo task orchestration; choose one, not Nx plus Rush by default.","https://github.com/vercel/turborepo"],
  ["rushstack","Microsoft Rushstack","Developer workflow","monorepo-tool","candidate","Package governance alternative if multi-package complexity warrants it.","https://github.com/microsoft/rushstack"],
  ["backstage","Backstage","Developer workflow","developer-portal","candidate","Internal service catalogue only if AXIMACH grows into separately owned services.","https://github.com/backstage/backstage"],

  // Quality, observability and contracts
  ["vitest","Vitest","Testing and quality","test-runner","candidate","React/component unit tests; retain the current Node test runner where suitable.","https://github.com/vitest-dev/vitest"],
  ["renovate","Renovate","Testing and quality","automation","candidate","Dependency update proposals gated by CI.","https://github.com/renovatebot/renovate"],
  ["spectral","Stoplight Spectral","Testing and quality","api-linter","candidate","Lint maintained OpenAPI contracts.","https://github.com/stoplightio/spectral"],
  ["promptfoo","Promptfoo","Testing and quality","evaluation","candidate","Prompt, model and agent-tool regression/evaluation tests."],
  ["langfuse","Langfuse","Testing and quality","observability","candidate","LLM traces, prompt versions, latency and cost observability."],
  ["agent-consent-patterns","Agent Consent Patterns","AI and agents","skill","reference","Scoped grants, action previews, revocation, receipts and human approvals."],

  // Web research and crawling
  ["searxng","SearXNG","Web research","self-hosted-service","configurable","Self-hosted metasearch gateway.","https://github.com/searxng/searxng","AGPL-3.0-or-later",["AXIMACH_SEARXNG_URL"]],
  ["openserp","OpenSERP","Web research","search-service","verify","Search abstraction candidate; compare maintenance and licence against SearXNG."],
  ["crawl4ai","Crawl4AI","Web research","crawler-service","configurable","Permitted public-web extraction service.", "https://github.com/unclecode/crawl4ai","Apache-2.0",["AXIMACH_CRAWL4AI_URL"]],
  ["scrapling","Scrapling","Web research","crawler-library","candidate","Adaptive extraction for permitted public pages."],
  ["scrapegraphai","ScrapeGraphAI","Web research","extraction-framework","candidate","Schema-oriented extraction; validate all extracted fields."],
  ["crawlee","Crawlee","Web research","crawler-framework","candidate","Controlled crawling framework."],
  ["scrapy","Scrapy","Web research","crawler-framework","candidate","Scheduled structured crawling framework."],
  ["browser-use","Browser Use","Web research","browser-agent","candidate","Operator-supervised browser research for authorised sites."],
  ["anycrawl","AnyCrawl","Web research","crawler-service","verify","Verify exact upstream, licence and hosting model."],
  ["apify","Apify","Web research","hosted-provider","provider","Optional hosted actors; commercial terms and source permissions apply."],

  // Lead research and enrichment
  ["company-contact-scraper","Company Contact Scraper","Company and lead intelligence","scraper","verify","Public company-contact extraction only where permitted."],
  ["geoleadscraper","GeoLeadScraper","Company and lead intelligence","scraper","verify","Location-based business discovery."],
  ["dataforge","DataForge","Company and lead intelligence","data-tool","verify","Resolve exact project identity, schema and licence."],
  ["keelead","KeeLead","Company and lead intelligence","lead-tool","verify","Resolve exact project and data provenance."],
  ["bricks","Bricks","Company and lead intelligence","tool","verify","Ambiguous name; exact source required."],
  ["openbower","OpenBower","Company and lead intelligence","tool","verify","Ambiguous name; exact source required."],
  ["leadgen","Leadgen","Company and lead intelligence","tool","verify","Generic name; exact source required."],
  ["reacher","Reacher / check-if-email-exists","Company and lead intelligence","verification-service","candidate","Email validation is not contact consent."],
  ["radial-lead-scraper","Radial Lead Scraper","Company and lead intelligence","scraper","verify","Verify repository, terms and data source."],
  ["blitzprospector","BlitzProspector","Company and lead intelligence","prospector","verify","Verify repository, terms and data source."],
  ["scout-varun","Scout (varun-io-eng/Scout)","Company and lead intelligence","tool","verify","Inspect this named repository; do not conflate with other Scout projects."],
  ["scout","Scout","Company and lead intelligence","tool","verify","Unqualified name; resolve exact upstream before use."],
  ["apollo","Apollo","Company and lead intelligence","hosted-provider","provider","Optional commercial provider; paid plans, export rights and privacy terms require approval."],
  ["world-company-database","World Company Database","Company and lead intelligence","dataset","verify","Verify source coverage, update date and redistribution rights."],
  ["awesome-gtm","Awesome GTM","Company and lead intelligence","reference-index","reference","Curated discovery index, not a runtime service."],
  ["awesome-ai-leadgen","Awesome AI Lead Generation","Company and lead intelligence","reference-index","reference","Curated discovery index, not a runtime service."],

  // Geo, finance, property and compliance
  ["pelias","Pelias","Geospatial","geocoder","candidate","Self-hostable geocoding adapter."],
  ["photon","Photon","Geospatial","geocoder","candidate","OSM geocoding alternative; compare with Pelias."],
  ["overpass","Overpass API","Geospatial","data-api","candidate","OpenStreetMap feature queries; comply with service limits and attribution."],
  ["osmnx","OSMnx","Geospatial","python-library","candidate","Road-network and spatial analysis."],
  ["locus","Locus","Geospatial","tool","verify","Exact product/repository and role need confirmation."],
  ["openbb","OpenBB","Finance and compliance","research-platform","candidate","Financial research framework; provider licensing still applies."],
  ["opensanctions","OpenSanctions","Finance and compliance","screening-dataset","candidate","Human-reviewed screening with false-positive controls and source evidence."],
  ["opencomps","OpenComps","Finance and compliance","dataset","verify","Verify exact source, methodology and licensing."],
  ["awesome-real-estate-apis","Awesome Real Estate APIs","Finance and compliance","reference-index","reference","API discovery index, not a property-data provider."],
  ["global-property-price-data","Global Property Price Data","Finance and compliance","dataset","verify","Validate coverage, observation date and data rights."],
  ["house-prices-global","House Prices Global","Finance and compliance","dataset","verify","Validate geography, methodology and time coverage."],
  ["openavmkit","OpenAVMKit","Finance and compliance","valuation-tool","verify","Validate source data, jurisdiction and valuation methodology."],
  ["indian-banking-dashboard","Indian Banking Dashboard","Finance and compliance","dashboard","verify","Verify publisher, update date and methodology."],
  ["bankpulse","BankPulse – BFSI Analytics","Finance and compliance","analytics-tool","verify","Verify exact project/source and data methodology."],

  // Knowledge and prompt resources
  ["affine","AFFiNE","Knowledge and prompts","knowledge-platform","candidate","Optional collaborative knowledge workspace; not AXIMACH transaction storage."],
  ["appflowy","AppFlowy","Knowledge and prompts","knowledge-platform","candidate","Alternative self-hosted workspace; avoid running in parallel with AFFiNE without need."],
  ["anythingllm","AnythingLLM","Knowledge and prompts","knowledge-platform","candidate","Private document retrieval over approved SOPs/manuals."],
  ["khoj","Khoj","Knowledge and prompts","knowledge-platform","candidate","Self-hosted knowledge assistant candidate."],
  ["swarmvault","SwarmVault","Knowledge and prompts","memory-tool","verify","Verify exact source, security model and intended use."],
  ["open-prompt-gallery","Open Prompt Gallery","Knowledge and prompts","prompt-index","reference","Prompt discovery only; review and test prompts before use."],
  ["prompts-chat","prompts.chat","Knowledge and prompts","prompt-index","reference","Prompt library, not executable authority."],
  ["youmind","YouMind","Knowledge and prompts","hosted-workspace","provider","Optional knowledge/research provider; data policy and plan limits need review."],
  ["prompthero","PromptHero","Knowledge and prompts","prompt-index","reference","Prompt discovery; respect creator and reuse terms."]
];

const ENV_CONFIG = Object.freeze({
  "searxng": ["AXIMACH_SEARXNG_URL"],
  "crawl4ai": ["AXIMACH_CRAWL4AI_URL"]
});

export function getIntegrationCatalog(env = process.env) {
  const items = DEFINITIONS.map(([id,name,family,kind,stage,role,upstream,license,environmentKeys]) => {
    const requiredEnv = ENV_CONFIG[id] || environmentKeys || [];
    const configured = requiredEnv.length > 0 && requiredEnv.every(key => Boolean(String(env[key] || "").trim()));
    return {
      id, name, family, kind, stage, role,
      ...(upstream ? { upstream } : {}),
      ...(license ? { license } : {}),
      ...(requiredEnv.length ? { requiredEnv } : {}),
      ...(requiredEnv.length ? { configured, status: configured ? "configured-unverified" : "not-configured" } : { configured: stage === "in-app" || stage === "adding", status: stage })
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    total: items.length,
    items
  };
}
