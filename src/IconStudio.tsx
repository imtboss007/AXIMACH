import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, Layers3, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import iconMetadata from "@tabler/icons/icons.json";

type IconMeta = { name: string; category?: string; tags?: string[]; version?: string; unicode?: string };
type IconAssignment = { iconName: string; palette: string; finish: string; depth: number; tilt: number; updatedAt: string };
type Assignments = Record<string, IconAssignment>;

const rawMetadata: unknown = iconMetadata;
const ICONS = (Array.isArray(rawMetadata) ? rawMetadata : Object.values((rawMetadata || {}) as Record<string, unknown>))
  .filter((item): item is IconMeta => Boolean(item && typeof item === "object" && "name" in item && typeof (item as IconMeta).name === "string"))
  .sort((a, b) => a.name.localeCompare(b.name));

const families = [
  "General", "CNC Turning", "VMC / Milling", "Wire EDM", "Grinding", "Welding",
  "Heat Treatment", "Surface Finish", "Inspection / Quality", "Assembly",
  "Transport / Dispatch", "Packaging", "Maintenance", "Material Handling"
];

const palettes = [
  { name: "Precision Blue", color: "#438df3" },
  { name: "Titanium", color: "#b5c4d8" },
  { name: "Copper", color: "#d98254" },
  { name: "Emerald", color: "#36b98a" },
  { name: "Amethyst", color: "#987bf0" },
  { name: "Safety Amber", color: "#e9a83d" },
  { name: "Graphite", color: "#718096" },
  { name: "Arctic", color: "#79c9e9" }
];
const finishes = ["Anodised", "Brushed metal", "Carbon", "Ceramic", "Liquid glass"];
const DEPTHS = [1, 2, 3, 4];
const TILTS = [-18, -9, 0, 9, 18];
const STORAGE_ASSIGNMENTS = "aximach.icon-assignments.v1";
const STORAGE_FAVOURITES = "aximach.icon-favourites.v1";
const STORAGE_PRESETS = "aximach.icon-presets.v1";

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}
function readAssignments(): Assignments { return safeRead<Assignments>(STORAGE_ASSIGNMENTS, {}); }
function normaliseWords(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function processFamilyForName(value: string) {
  const name = normaliseWords(value);
  if (/turn|lathe|turning/.test(name)) return "CNC Turning";
  if (/vmc|milling|mill|machining centre/.test(name)) return "VMC / Milling";
  if (/wire edm|edm|spark erosion/.test(name)) return "Wire EDM";
  if (/grind|grinding|honing|lapping/.test(name)) return "Grinding";
  if (/weld|welding|brazing/.test(name)) return "Welding";
  if (/heat treat|hardening|tempering|anneal/.test(name)) return "Heat Treatment";
  if (/coat|plating|anod|paint|finish|polish/.test(name)) return "Surface Finish";
  if (/inspect|quality|metrology|cmm|measurement|testing/.test(name)) return "Inspection / Quality";
  if (/assembl|fitment|sub assembl/.test(name)) return "Assembly";
  if (/transport|dispatch|shipping|logistic|delivery/.test(name)) return "Transport / Dispatch";
  if (/pack|packing/.test(name)) return "Packaging";
  if (/maint|repair|service/.test(name)) return "Maintenance";
  if (/material|stock|store|handling|warehouse/.test(name)) return "Material Handling";
  return "General";
}

function iconSearchText(item: IconMeta) {
  return [item.name, item.category || "", ...(Array.isArray(item.tags) ? item.tags : [])].join(" ").toLowerCase();
}

function iconClass(name: string) { return `ti ti-${name}`; }

export function ProcessIcon({ processName, fallback }: { processName: string; fallback: ReactNode }) {
  const [assignments, setAssignments] = useState<Assignments>(() => readAssignments());
  const family = processFamilyForName(processName);
  useEffect(() => {
    const refresh = () => setAssignments(readAssignments());
    window.addEventListener("storage", refresh);
    window.addEventListener("aximach-icon-assignments-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("aximach-icon-assignments-updated", refresh);
    };
  }, []);
  const assignment = assignments[family];
  if (!assignment) return <span className="linked-node-icon linked-node-icon-3d"><span className="linked-node-icon-fallback">{fallback}</span></span>;
  const palette = palettes.find((item) => item.name === assignment.palette) || palettes[0];
  return (
    <span className={`linked-node-icon linked-node-icon-3d ax-process-icon ax-icon-finish-${normaliseWords(assignment.finish).replaceAll(" ", "-")}`} style={{ "--ax-icon-accent": palette.color, "--ax-icon-depth": assignment.depth, "--ax-icon-tilt": assignment.tilt + "deg" } as CSSProperties} title={`Saved ${family} icon: ${assignment.iconName}`}>
      <i className={iconClass(assignment.iconName)} aria-hidden="true" />
    </span>
  );
}

export default function IconStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "favourites" | "assigned">("all");
  const [family, setFamily] = useState("CNC Turning");
  const [selectedIcon, setSelectedIcon] = useState("settings");
  const [paletteName, setPaletteName] = useState(palettes[0].name);
  const [finish, setFinish] = useState(finishes[0]);
  const [depth, setDepth] = useState(3);
  const [tilt, setTilt] = useState(0);
  const [page, setPage] = useState(0);
  const [favourites, setFavourites] = useState<string[]>(() => safeRead<string[]>(STORAGE_FAVOURITES, []));
  const [assignments, setAssignments] = useState<Assignments>(() => readAssignments());
  const [presets, setPresets] = useState<IconAssignment[]>(() => safeRead<IconAssignment[]>(STORAGE_PRESETS, []));
  const [notice, setNotice] = useState("");

  useEffect(() => { setPage(0); }, [search, tab]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ICONS.filter((item) => {
      if (tab === "favourites" && !favourites.includes(item.name)) return false;
      if (tab === "assigned" && !Object.values(assignments).some((assignment) => assignment.iconName === item.name)) return false;
      return !query || iconSearchText(item).includes(query);
    });
  }, [search, tab, favourites, assignments]);
  const pageSize = 72;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const selected = ICONS.find((item) => item.name === selectedIcon);
  const activePalette = palettes.find((item) => item.name === paletteName) || palettes[0];
  const variantStyle = { "--ax-icon-accent": activePalette.color, "--ax-icon-depth": depth, "--ax-icon-tilt": tilt + "deg" } as CSSProperties;
  const variantClass = `ax-icon-finish-${normaliseWords(finish).replaceAll(" ", "-")}`;

  const toggleFavourite = (name: string) => {
    const next = favourites.includes(name) ? favourites.filter((item) => item !== name) : [...favourites, name];
    setFavourites(next);
    window.localStorage.setItem(STORAGE_FAVOURITES, JSON.stringify(next));
  };
  const saveAssignment = () => {
    const assignment: IconAssignment = { iconName: selectedIcon, palette: paletteName, finish, depth, tilt, updatedAt: new Date().toISOString() };
    const next = { ...assignments, [family]: assignment };
    setAssignments(next);
    window.localStorage.setItem(STORAGE_ASSIGNMENTS, JSON.stringify(next));
    const nextPresets = [assignment, ...presets.filter((preset) => preset.iconName !== assignment.iconName || preset.palette !== assignment.palette || preset.finish !== assignment.finish)].slice(0, 120);
    setPresets(nextPresets);
    window.localStorage.setItem(STORAGE_PRESETS, JSON.stringify(nextPresets));
    window.dispatchEvent(new Event("aximach-icon-assignments-updated"));
    setNotice(`Saved ${selectedIcon} for ${family}. Matching process nodes now use this 3D icon.`);
  };
  const removeAssignment = (targetFamily: string) => {
    const next = { ...assignments };
    delete next[targetFamily];
    setAssignments(next);
    window.localStorage.setItem(STORAGE_ASSIGNMENTS, JSON.stringify(next));
    window.dispatchEvent(new Event("aximach-icon-assignments-updated"));
    setNotice(`Cleared the custom icon for ${targetFamily}. AXIMACH default icon restored.`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="ax-icon-studio-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <motion.section className="ax-icon-studio" role="dialog" aria-modal="true" aria-labelledby="ax-icon-studio-title" initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
            <header className="ax-icon-studio-header">
              <div className="ax-icon-studio-brand"><span><Layers3 size={20}/></span><div><div className="eyebrow">AXIMACH / VISUAL SYSTEM</div><h2 id="ax-icon-studio-title">3D Icon Studio</h2><p>Search, customise, assign and save manufacturing process icons.</p></div></div>
              <button className="ax-icon-studio-close" onClick={onClose} aria-label="Close icon studio"><X size={18}/></button>
            </header>
            <div className="ax-icon-studio-stats">
              <div><strong>{ICONS.length.toLocaleString("en-IN")}</strong><span>Tabler glyphs indexed</span></div>
              <div><strong>5,000+</strong><span>3D style combinations</span></div>
              <div><strong>{Object.keys(assignments).length}</strong><span>Process families assigned</span></div>
              <div><strong>{presets.length.toLocaleString("en-IN")}</strong><span>Saved style presets</span></div>
            </div>
            <div className="ax-icon-studio-body">
              <section className="ax-icon-browser">
                <div className="ax-icon-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search 6,000+ icons: lathe, milling, gear, inspection…" autoFocus/><span>{filtered.length.toLocaleString("en-IN")}</span></div>
                <div className="ax-icon-tabs" role="tablist" aria-label="Icon catalogue views">
                  <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}><Layers3 size={14}/> All icons</button>
                  <button className={tab === "favourites" ? "active" : ""} onClick={() => setTab("favourites")}><Heart size={14}/> Saved favourites <b>{favourites.length}</b></button>
                  <button className={tab === "assigned" ? "active" : ""} onClick={() => setTab("assigned")}><Check size={14}/> Assigned</button>
                </div>
                <div className="ax-icon-grid" role="list">
                  {visible.map((item) => (
                    <div className={`ax-icon-option ${selectedIcon === item.name ? "selected" : ""}`} key={item.name}>
                      <button className="ax-icon-option-main" onClick={() => setSelectedIcon(item.name)} aria-label={`Select ${item.name}`} title={item.name}>
                        <span className="ax-icon-option-glyph"><i className={iconClass(item.name)} aria-hidden="true"/></span>
                        <span>{item.name.replaceAll("-", " ")}</span>
                      </button>
                      <button className={`ax-icon-favourite ${favourites.includes(item.name) ? "is-favourite" : ""}`} onClick={() => toggleFavourite(item.name)} aria-label={favourites.includes(item.name) ? "Remove favourite" : "Save favourite"}><Heart size={12} fill={favourites.includes(item.name) ? "currentColor" : "none"}/></button>
                    </div>
                  ))}
                  {!visible.length && <div className="ax-icon-empty"><Search size={24}/><strong>No icons found</strong><span>Try a different word or switch to All icons.</span></div>}
                </div>
                <footer className="ax-icon-pagination"><span>Showing {filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length.toLocaleString("en-IN")}</span><div><button disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))} aria-label="Previous icons"><ChevronLeft size={15}/></button><b>{page + 1} / {pageCount}</b><button disabled={page + 1 >= pageCount} onClick={() => setPage(Math.min(pageCount - 1, page + 1))} aria-label="Next icons"><ChevronRight size={15}/></button></div></footer>
              </section>
              <aside className="ax-icon-customiser">
                <div className="ax-icon-preview-label"><span>LIVE PREVIEW</span><small>DRAG / STYLE / SAVE</small></div>
                <motion.div className={`ax-icon-preview-tile ${variantClass}`} style={variantStyle} animate={{ rotateX: tilt * -0.45, rotateY: tilt, y: [0, -3, 0] }} transition={{ rotateX: { duration: 0.35 }, rotateY: { duration: 0.35 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}>
                  <span className="ax-icon-preview-gloss"/><i className={iconClass(selectedIcon)} aria-hidden="true"/>
                </motion.div>
                <div className="ax-icon-selected-name"><strong>{selected?.name.replaceAll("-", " ") || selectedIcon}</strong><span>{selected?.category || "Tabler outline glyph"}</span></div>
                <label className="ax-icon-field">Assign to process family<select value={family} onChange={(event) => setFamily(event.target.value)}>{families.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label>
                <div className="ax-icon-field-label"><span>Surface finish</span><small>{finish}</small></div>
                <div className="ax-icon-finish-options">{finishes.map((item) => <button key={item} className={finish === item ? "active" : ""} onClick={() => setFinish(item)}>{item}</button>)}</div>
                <div className="ax-icon-field-label"><span>Material / colour</span><small>{paletteName}</small></div>
                <div className="ax-icon-palette">{palettes.map((item) => <button key={item.name} title={item.name} aria-label={item.name} className={paletteName === item.name ? "active" : ""} style={{ background: item.color }} onClick={() => setPaletteName(item.name)}/>)}</div>
                <label className="ax-icon-slider"><span>Bevel depth <b>{depth}/4</b></span><input type="range" min="1" max="4" step="1" value={depth} onChange={(event) => setDepth(Number(event.target.value))}/></label>
                <label className="ax-icon-slider"><span>3D tilt <b>{tilt}°</b></span><input type="range" min="-18" max="18" step="9" value={tilt} onChange={(event) => setTilt(Number(event.target.value))}/></label>
                <button className="ax-icon-save" onClick={saveAssignment}><Sparkles size={16}/> Save & apply to {family}</button>
                {assignments[family] && <button className="ax-icon-reset" onClick={() => removeAssignment(family)}>Restore AXIMACH default icon</button>}
                {notice && <div className="ax-icon-notice"><Check size={13}/>{notice}</div>}
              </aside>
            </div>
            <footer className="ax-icon-studio-bottom"><span><i/> Saved on this device · available in the process map after saving</span><span>Icon glyphs: Tabler Icons · MIT license</span></footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
