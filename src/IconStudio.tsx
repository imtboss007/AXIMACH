import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, Layers3, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { tablerIconCatalogue } from "./tablerIconCatalogue";
import { MechanicalComponentIcon, MechanicalOperationIcon, mechanicalGlyphForOperation } from "./MechanicalOperationIcon";
import { activeRows, useManufacturingData } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type IconMeta = { name: string; category?: string; tags?: string[]; version?: string; unicode?: string; variant: "outline" | "filled" };
type IconAssignment = { iconName: string; iconVariant?: "outline" | "filled"; palette: string; finish: string; depth: number; tilt: number; updatedAt: string; customAsset?: string; revision?: number; history?: Array<{ iconName: string; iconVariant?: "outline" | "filled"; palette: string; finish: string; depth: number; tilt: number; updatedAt: string; customAsset?: string; revision?: number }> };
type Assignments = Record<string, IconAssignment>;

const ICONS: IconMeta[] = tablerIconCatalogue.map((item) => ({ name: item.name, category: item.variant, tags: item.name.split("-"), variant: item.variant }));
const iconKey = (item: Pick<IconMeta, "name" | "variant">) => `${item.variant}:${item.name}`;

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
const STYLE_VARIANTS_PER_ICON = palettes.length * finishes.length * DEPTHS.length * TILTS.length;
const STORAGE_ASSIGNMENTS = "aximach.icon-assignments.v1";
const STORAGE_FAVOURITES = "aximach.icon-favourites.v1";
const STORAGE_PRESETS = "aximach.icon-presets.v1";
const STORAGE_UPDATED_AT = "aximach.icon-preferences-updated-at.v1";
const SHARED_SETTINGS_PATH = "/api/ui-preferences";

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = window.localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}
type PreferenceBundle = { assignments: Assignments; favourites: string[]; presets: IconAssignment[]; updatedAt: string };
function readPreferenceBundle(): PreferenceBundle {
  return {
    assignments: safeRead<Assignments>(STORAGE_ASSIGNMENTS, {}),
    favourites: safeRead<string[]>(STORAGE_FAVOURITES, []),
    presets: safeRead<IconAssignment[]>(STORAGE_PRESETS, []),
    updatedAt: typeof window === "undefined" ? "" : window.localStorage.getItem(STORAGE_UPDATED_AT) || "1970-01-01T00:00:00.000Z"
  };
}
function writePreferenceBundle(bundle: PreferenceBundle) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_ASSIGNMENTS, JSON.stringify(bundle.assignments));
  window.localStorage.setItem(STORAGE_FAVOURITES, JSON.stringify(bundle.favourites));
  window.localStorage.setItem(STORAGE_PRESETS, JSON.stringify(bundle.presets));
  window.localStorage.setItem(STORAGE_UPDATED_AT, bundle.updatedAt);
  window.dispatchEvent(new Event("aximach-icon-assignments-updated"));
}
function iconServerConfig() {
  if (typeof window === "undefined") return null;
  let base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim();
  while (base.endsWith("/")) base = base.slice(0, -1);
  const key = window.localStorage.getItem("aximach.scheduler.key") || "";
  const localHttp = base === "http://localhost" || base.startsWith("http://localhost:")
    || base === "http://127.0.0.1" || base.startsWith("http://127.0.0.1:");
  if (!base || !key || (!base.startsWith("https://") && !localHttp)) return null;
  return { base, key };
}
async function putSharedPreferences(bundle: PreferenceBundle) {
  const cfg = iconServerConfig();
  if (!cfg) return { shared: false as const, preferences: bundle };
  const response = await fetch(cfg.base + SHARED_SETTINGS_PATH, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-aximach-key": cfg.key },
    body: JSON.stringify({ preferences: bundle })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not sync AXIMACH visual preferences.");
  return { shared: true as const, preferences: (data.preferences || bundle) as PreferenceBundle };
}
async function fetchSharedPreferences() {
  const cfg = iconServerConfig();
  if (!cfg) return { shared: false as const, preferences: readPreferenceBundle() };
  const response = await fetch(cfg.base + SHARED_SETTINGS_PATH, { headers: { "x-aximach-key": cfg.key } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not read shared AXIMACH visual preferences.");
  const remote = data.preferences as PreferenceBundle | null;
  const local = readPreferenceBundle();
  const remoteAt = Date.parse(remote?.updatedAt || "") || 0;
  const localAt = Date.parse(local.updatedAt || "") || 0;
  if (remote && remoteAt > localAt) {
    const next = {
      assignments: remote.assignments || {},
      favourites: remote.favourites || [],
      presets: remote.presets || [],
      updatedAt: remote.updatedAt
    };
    writePreferenceBundle(next);
    return { shared: true as const, preferences: next };
  }
  if (!remote || localAt > remoteAt) {
    const next = await putSharedPreferences({ ...local, updatedAt: local.updatedAt === "1970-01-01T00:00:00.000Z" ? new Date().toISOString() : local.updatedAt });
    writePreferenceBundle(next.preferences);
    return next;
  }
  return { shared: true as const, preferences: local };
}
async function persistShared(bundle: PreferenceBundle): Promise<"local" | "synced" | "error"> {
  if (!iconServerConfig()) return "local";
  try {
    const result = await putSharedPreferences(bundle);
    const current = readPreferenceBundle();
    if ((Date.parse(result.preferences.updatedAt || "") || 0) > (Date.parse(current.updatedAt || "") || 0)) writePreferenceBundle(result.preferences);
    return result.shared ? "synced" : "local";
  } catch {
    return "error";
  }
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

function iconClass(name: string, variant: "outline" | "filled" = "outline") { return `ti ti-${name}${variant === "filled" ? " ti-filled" : ""}`; }

function useIconAssignments() {
  const [assignments, setAssignments] = useState<Assignments>(() => readAssignments());
  useEffect(() => {
    const refresh = () => setAssignments(readAssignments());
    window.addEventListener("storage", refresh);
    window.addEventListener("aximach-icon-assignments-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("aximach-icon-assignments-updated", refresh);
    };
  }, []);
  return assignments;
}

function assignedIcon(assignment: IconAssignment, title: string, className: string) {
  const palette = palettes.find((item) => item.name === assignment.palette) || palettes[0];
  return <span className={className + " ax-icon-finish-" + normaliseWords(assignment.finish).replaceAll(" ", "-")} style={{ "--ax-icon-accent": palette.color, "--ax-icon-depth": assignment.depth, "--ax-icon-tilt": assignment.tilt + "deg" } as CSSProperties} title={title}>
    {assignment.customAsset ? <img className="ax-icon-custom-asset" src={assignment.customAsset} alt="" /> : <i className={iconClass(assignment.iconName, assignment.iconVariant)} aria-hidden="true" />}
  </span>;
}

export function ProcessIcon({ processName, fallback, processId, category, subcategory }: { processName: string; fallback: ReactNode; processId?: string; category?: string; subcategory?: string }) {
  const { data } = useManufacturingData();
  const assignments = useIconAssignments();
  const family = processFamilyForName(processName);
  const definition = activeRows(data.processDefinitions).find(row =>
    (processId ? row.id === processId : true) &&
    (!category || normaliseWords(row.category) === normaliseWords(category)) &&
    normaliseWords(row.processType) === normaliseWords(processName)
  );
  const stableId = processId || definition?.id;
  const subcategoryIndex = subcategory ? (definition?.subcategories.findIndex(item => normaliseWords(item) === normaliseWords(subcategory)) ?? -1) : -1;
  const subcategoryId = subcategoryIndex >= 0
    ? definition?.subcategoryIds?.[subcategoryIndex] || definition?.id + "-subprocess-" + String(subcategoryIndex+1).padStart(3,"0")
    : undefined;
  const assignment = (subcategoryId ? assignments["subcategory:" + subcategoryId] : undefined)
    || (stableId ? assignments["process:" + stableId] : undefined)
    || assignments["process:" + normaliseWords(processName)] || assignments[family];
  if (!assignment) return <span className="linked-node-icon linked-node-icon-3d">{mechanicalGlyphForOperation(processName) ? <MechanicalOperationIcon operation={processName} /> : <span className="linked-node-icon-fallback">{fallback}</span>}</span>;
  return assignedIcon(assignment, "Saved process identity: " + processName, "linked-node-icon linked-node-icon-3d ax-process-icon");
}

export function ComponentIcon({ componentId, componentName, className = "" }: { componentId?: string; componentName: string; className?: string }) {
  const assignments = useIconAssignments();
  const assignment = componentId ? assignments["component:" + componentId] : undefined;
  if (!assignment) return <MechanicalComponentIcon componentName={componentName} className={className} />;
  return assignedIcon(assignment, "Saved component identity: " + componentName, "ax-component-icon linked-node-icon-3d " + className);
}

export default function IconStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useManufacturingData();
  const processDefinitions = activeRows(data.processDefinitions);
  const components = activeRows(data.components);
  const [targetType, setTargetType] = useState<"process" | "component" | "subcategory" | "family" | "exact">("process");
  const [targetRecordId, setTargetRecordId] = useState("");
  const [targetSubcategoryId, setTargetSubcategoryId] = useState("");
  const [customAsset, setCustomAsset] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "favourites" | "assigned">("all");
  const [family, setFamily] = useState("CNC Turning");
  const [specificProcess, setSpecificProcess] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("outline:settings");
  const [paletteName, setPaletteName] = useState(palettes[0].name);
  const [finish, setFinish] = useState(finishes[0]);
  const [depth, setDepth] = useState(3);
  const [tilt, setTilt] = useState(0);
  const [page, setPage] = useState(0);
  const [favourites, setFavourites] = useState<string[]>(() => safeRead<string[]>(STORAGE_FAVOURITES, []));
  const [assignments, setAssignments] = useState<Assignments>(() => readAssignments());
  const [presets, setPresets] = useState<IconAssignment[]>(() => safeRead<IconAssignment[]>(STORAGE_PRESETS, []));
  const [notice, setNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState<"local" | "syncing" | "synced" | "error">("local");

  useEffect(() => { setPage(0); }, [search, tab]);
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const sync = async () => {
      if (busy) return;
      if (!iconServerConfig()) { if (!cancelled) setSyncStatus("local"); return; }
      busy = true;
      if (!cancelled) setSyncStatus("syncing");
      try {
        const result = await fetchSharedPreferences();
        if (cancelled) return;
        setAssignments(result.preferences.assignments || {});
        setFavourites(result.preferences.favourites || []);
        setPresets(result.preferences.presets || []);
        setSyncStatus(result.shared ? "synced" : "local");
      } catch {
        if (!cancelled) setSyncStatus("error");
      } finally { busy = false; }
    };
    const refreshLocal = () => {
      const next = readPreferenceBundle();
      setAssignments(next.assignments);
      setFavourites(next.favourites);
      setPresets(next.presets);
    };
    const refresh = () => { refreshLocal(); void sync(); };
    const active = () => { if (document.visibilityState !== "hidden") void sync(); };
    window.addEventListener("storage", refresh);
    window.addEventListener("aximach-icon-assignments-updated", refreshLocal);
    window.addEventListener("focus", active);
    window.addEventListener("online", active);
    document.addEventListener("visibilitychange", active);
    void sync();
    const timer = window.setInterval(() => { void sync(); }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("aximach-icon-assignments-updated", refreshLocal);
      window.removeEventListener("focus", active);
      window.removeEventListener("online", active);
      document.removeEventListener("visibilitychange", active);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ICONS.filter((item) => {
      if (tab === "favourites" && !favourites.includes(iconKey(item))) return false;
      if (tab === "assigned" && !Object.values(assignments).some((assignment) => assignment.iconName === item.name && (assignment.iconVariant || "outline") === item.variant)) return false;
      return !query || iconSearchText(item).includes(query);
    });
  }, [search, tab, favourites, assignments]);
  const pageSize = 72;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const selected = ICONS.find((item) => iconKey(item) === selectedIcon);
  const activePalette = palettes.find((item) => item.name === paletteName) || palettes[0];
  const variantStyle = { "--ax-icon-accent": activePalette.color, "--ax-icon-depth": depth, "--ax-icon-tilt": tilt + "deg" } as CSSProperties;
  const variantClass = `ax-icon-finish-${normaliseWords(finish).replaceAll(" ", "-")}`;
  const targetOptions = targetType === "component"
    ? components.map(item => ({ id: item.id, label: item.partNumber + " · " + item.name }))
    : targetType === "subcategory"
      ? processDefinitions.flatMap(item => item.subcategories.map((subcategory,index) => ({
          id: item.subcategoryIds?.[index] || item.id + "-subprocess-" + String(index+1).padStart(3,"0"),
          label: item.category + " · " + item.processType + " · " + subcategory
        })))
      : processDefinitions.map(item => ({ id: item.id, label: item.category + " · " + item.processType + (item.subcategories.length ? " · " + item.subcategories.slice(0, 3).join(", ") : "") }));
  const selectedTarget = targetType === "component" ? components.find(item => item.id === targetRecordId) : processDefinitions.find(item => item.id === targetRecordId);
  const selectedSubcategoryTarget = targetType === "subcategory"
    ? processDefinitions.flatMap(item => item.subcategories.map((subcategory,index) => ({
        id: item.subcategoryIds?.[index] || item.id + "-subprocess-" + String(index+1).padStart(3,"0"),
        label: item.category + " · " + item.processType + " · " + subcategory
      }))).find(item => item.id === targetSubcategoryId)
    : undefined;
  const selectedTargetLabel = targetType === "subcategory" ? selectedSubcategoryTarget?.label || ""
    : targetType === "component" && selectedTarget && "partNumber" in selectedTarget
      ? selectedTarget.partNumber + " · " + selectedTarget.name
      : selectedTarget && "processType" in selectedTarget ? selectedTarget.category + " · " + selectedTarget.processType : "";
  const specificKey = specificProcess.trim() ? "process:" + normaliseWords(specificProcess) : "";
  const assignmentKey = targetType === "component" && targetRecordId ? "component:" + targetRecordId
    : targetType === "subcategory" && targetSubcategoryId ? "subcategory:" + targetSubcategoryId
    : targetType === "process" && targetRecordId ? "process:" + targetRecordId
    : targetType === "exact" ? specificKey || "process:" + normaliseWords(specificProcess) : family;
  useEffect(() => { setCustomAsset(assignments[assignmentKey]?.customAsset || ""); }, [assignmentKey, assignments]);

  const toggleFavourite = (name: string) => {
    const next = favourites.includes(name) ? favourites.filter((item) => item !== name) : [...favourites, name];
    setFavourites(next);
    const bundle = { ...readPreferenceBundle(), favourites: next, updatedAt: new Date().toISOString() };
    writePreferenceBundle(bundle);
    setSyncStatus(iconServerConfig() ? "syncing" : "local");
    void persistShared(bundle).then(setSyncStatus);
  };
  const saveAssignment = () => {
    const selectedMeta = ICONS.find((item) => iconKey(item) === selectedIcon);
    if (!selectedMeta) return;
    const stamp = new Date().toISOString();
    const previous = assignments[assignmentKey];
    const history = [...(previous?.history || []), ...(previous ? [{ iconName: previous.iconName, iconVariant: previous.iconVariant, palette: previous.palette, finish: previous.finish, depth: previous.depth, tilt: previous.tilt, updatedAt: previous.updatedAt, customAsset: previous.customAsset, revision: previous.revision }] : [])].slice(-12);
    const assignment: IconAssignment = { iconName: selectedMeta.name, iconVariant: selectedMeta.variant, palette: paletteName, finish, depth, tilt, customAsset: customAsset || undefined, revision: (previous?.revision || 0) + 1, history, updatedAt: stamp };
    const next = { ...assignments, [assignmentKey]: assignment };
    setAssignments(next);
    const preset: IconAssignment = { iconName: assignment.iconName, iconVariant: assignment.iconVariant, palette: assignment.palette, finish: assignment.finish, depth: assignment.depth, tilt: assignment.tilt, updatedAt: assignment.updatedAt };
    const nextPresets = [preset, ...presets.filter((item) => item.iconName !== preset.iconName || item.iconVariant !== preset.iconVariant || item.palette !== preset.palette || item.finish !== preset.finish)].slice(0, 120);
    setPresets(nextPresets);
    const bundle = { assignments: next, favourites, presets: nextPresets, updatedAt: new Date().toISOString() };
    writePreferenceBundle(bundle);
    void persistShared(bundle).then(setSyncStatus);
    setNotice("Saved " + selectedMeta.name + " (" + selectedMeta.variant + ") for " + (selectedTargetLabel || (specificKey ? specificProcess.trim() : family)) + ". All views resolve this assignment through the same stable record ID.");
  };
  const restoreVersion = (version: NonNullable<IconAssignment["history"]>[number]) => {
    const current = assignments[assignmentKey];
    if (!current) return;
    const stamp = new Date().toISOString();
    const snapshot = { iconName: current.iconName, iconVariant: current.iconVariant, palette: current.palette, finish: current.finish, depth: current.depth, tilt: current.tilt, customAsset: current.customAsset, revision: current.revision, updatedAt: current.updatedAt };
    const restored: IconAssignment = { ...version, revision: (current.revision || 0) + 1, history: [...(current.history || []), snapshot].slice(-12), updatedAt: stamp };
    const next = { ...assignments, [assignmentKey]: restored };
    setAssignments(next);
    const bundle = { ...readPreferenceBundle(), assignments: next, updatedAt: stamp };
    writePreferenceBundle(bundle); setPaletteName(restored.palette); setFinish(restored.finish); setDepth(restored.depth); setTilt(restored.tilt); setCustomAsset(restored.customAsset || "");
    void persistShared(bundle).then(setSyncStatus);
    setNotice("Restored an earlier icon version for " + (selectedTargetLabel || specificProcess || family) + ".");
  };

  const handleAssetImport = (file?: File) => {
    if (!file) return;
    if (file.type === "image/png") {
      if (file.size > 1024 * 1024) { setNotice("PNG logo file must be 1 MB or smaller so connected devices can sync it reliably."); return; }
      const reader = new FileReader();
      reader.onload = () => { setCustomAsset(String(reader.result || "")); setNotice("PNG loaded into the logo preview. Save & apply to bind it to the selected master record."); };
      reader.onerror = () => setNotice("Could not read the PNG file.");
      reader.readAsDataURL(file);
      return;
    }
    if (file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
      setNotice("Only SVG and PNG logo files are supported.");
      return;
    }
    if (file.size > 256 * 1024) { setNotice("SVG logo file must be 256 KB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = new DOMParser().parseFromString(String(reader.result || ""), "image/svg+xml");
        if (parsed.querySelector("parsererror") || parsed.documentElement.tagName.toLowerCase() !== "svg") throw new Error("The file is not a valid SVG.");
        parsed.querySelectorAll("script,style,link,foreignObject,iframe,object,embed").forEach(node => node.remove());
        parsed.querySelectorAll("*").forEach(node => [...node.attributes].forEach(attribute => {
          const name = attribute.name.toLowerCase();
          const value = attribute.value.trim().toLowerCase();
          const externalLink = (name === "href" || name.endsWith(":href")) && value && !value.startsWith("#") && !value.startsWith("data:image/");
          if (name.startsWith("on") || name === "src" || externalLink || (name === "style" && value.includes("url("))) node.removeAttribute(attribute.name);
        }));
        const safeSvg = new XMLSerializer().serializeToString(parsed.documentElement);
        setCustomAsset("data:image/svg+xml;charset=utf-8," + encodeURIComponent(safeSvg));
        setNotice("SVG sanitised and loaded. Save & apply to attach the imported logo to the selected stable ID.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "SVG import failed.");
      }
    };
    reader.onerror = () => setNotice("Could not read the SVG file.");
    reader.readAsText(file);
  };

  const downloadLogo = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
    anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const exportLogo = async (format: "svg" | "png") => {
    const stem = (selectedTargetLabel || specificProcess || family || "AXIMACH-logo").replace(/[^a-z0-9_-]+/gi, "-");
    const tile = document.querySelector<HTMLElement>(".ax-icon-preview-tile");
    if (format === "svg") {
      let graphic = "";
      if (customAsset) {
        const safeData = customAsset.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        graphic = '<image href="' + safeData + '" x="16" y="16" width="96" height="96" preserveAspectRatio="xMidYMid meet"/>';
      } else {
        const glyphNode = tile?.querySelector<HTMLElement>("i");
        const pseudo = glyphNode ? window.getComputedStyle(glyphNode, "::before") : null;
        let glyph = pseudo?.content || "";
        glyph = glyph.replace(/^["']|["']$/g, "").replace(/\\([0-9a-f]{1,6})\s?/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
        const font = (pseudo?.fontFamily || "tabler-icons").replace(/["&<>]/g, "");
        const escaped = glyph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (glyph) graphic = '<text x="64" y="86" text-anchor="middle" font-family="' + font + '" font-size="76" fill="' + activePalette.color + '">' + escaped + '</text>';
      }
      if (!graphic) { setNotice("The selected icon could not be resolved for SVG export."); return; }
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' + graphic + '</svg>';
      downloadLogo(stem + ".svg", new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      setNotice("SVG logo exported.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) { setNotice("PNG export is not available in this browser."); return; }
    if (customAsset) {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Imported logo could not be rendered as PNG."));
        image.src = customAsset;
      });
      context.drawImage(image, 24, 24, 208, 208);
    } else {
      const glyphNode = tile?.querySelector<HTMLElement>("i");
      const pseudo = glyphNode ? window.getComputedStyle(glyphNode, "::before") : null;
      let glyph = pseudo?.content || "";
      glyph = glyph.replace(/^["']|["']$/g, "").replace(/\\([0-9a-f]{1,6})\s?/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
      if (!glyph) { setNotice("The selected icon could not be resolved for PNG export."); return; }
      context.fillStyle = activePalette.color;
      context.textAlign = "center"; context.textBaseline = "middle";
      context.font = "156px " + (pseudo?.fontFamily || "tabler-icons");
      context.fillText(glyph, 128, 128);
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) { setNotice("PNG logo export failed."); return; }
    downloadLogo(stem + ".png", blob);
    setNotice("PNG logo exported.");
  };

  const removeAssignment = (targetFamily: string) => {
    const next = { ...assignments };
    delete next[targetFamily];
    setAssignments(next);
    const bundle = { ...readPreferenceBundle(), assignments: next, updatedAt: new Date().toISOString() };
    writePreferenceBundle(bundle);
    setSyncStatus(iconServerConfig() ? "syncing" : "local");
    void persistShared(bundle).then(setSyncStatus);
    setNotice(`Cleared the custom icon for ${targetFamily}. AXIMACH default icon restored.`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="ax-icon-studio-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <motion.section className="ax-icon-studio" role="dialog" aria-modal="true" aria-labelledby="ax-icon-studio-title" initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
            <header className="ax-icon-studio-header">
              <div className="ax-icon-studio-brand"><span><Layers3 size={20}/></span><div><div className="eyebrow">AXIMACH / VISUAL SYSTEM</div><h2 id="ax-icon-studio-title">3D Icon Studio</h2><p>Build, import, customise and globally assign process and component logos by permanent master ID.</p></div></div>
              <button className="ax-icon-studio-close" onClick={onClose} aria-label="Close icon studio"><X size={18}/></button>
            </header>
            <div className="ax-icon-studio-stats">
              <div><strong>{ICONS.length.toLocaleString("en-IN")}</strong><span>Tabler glyphs indexed</span></div>
              <div><strong>{(ICONS.length * STYLE_VARIANTS_PER_ICON).toLocaleString("en-IN")}+</strong><span>3D style combinations</span></div>
              <div><strong>{Object.keys(assignments).length}</strong><span>Logo assignments</span></div>
              <div><strong>{presets.length.toLocaleString("en-IN")}</strong><span>Saved style presets</span></div>
            </div>
            <div className="ax-icon-studio-body">
              <section className="ax-icon-browser">
                <div className="ax-icon-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search 6,257 outline and filled glyphs: lathe, milling, gear, inspection…" autoFocus/><span>{filtered.length.toLocaleString("en-IN")}</span></div>
                <div className="ax-icon-tabs" role="tablist" aria-label="Icon catalogue views">
                  <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}><Layers3 size={14}/> All icons</button>
                  <button className={tab === "favourites" ? "active" : ""} onClick={() => setTab("favourites")}><Heart size={14}/> Saved favourites <b>{favourites.length}</b></button>
                  <button className={tab === "assigned" ? "active" : ""} onClick={() => setTab("assigned")}><Check size={14}/> Assigned</button>
                </div>
                <div className="ax-icon-grid" role="list">
                  {visible.map((item) => (
                    <div className={`ax-icon-option ${selectedIcon === iconKey(item) ? "selected" : ""}`} key={iconKey(item)}>
                      <button className="ax-icon-option-main" onClick={() => setSelectedIcon(iconKey(item))} aria-label={`Select ${item.name} ${item.variant}`} title={item.name}>
                        <span className="ax-icon-option-glyph"><i className={iconClass(item.name, item.variant)} aria-hidden="true"/></span>
                        <span>{item.name.replaceAll("-", " ")}</span>
                      </button>
                      <button className={`ax-icon-favourite ${favourites.includes(iconKey(item)) ? "is-favourite" : ""}`} onClick={() => toggleFavourite(iconKey(item))} aria-label={favourites.includes(iconKey(item)) ? "Remove favourite" : "Save favourite"}><Heart size={12} fill={favourites.includes(iconKey(item)) ? "currentColor" : "none"}/></button>
                    </div>
                  ))}
                  {!visible.length && <div className="ax-icon-empty"><Search size={24}/><strong>No icons found</strong><span>Try a different word or switch to All icons.</span></div>}
                </div>
                <footer className="ax-icon-pagination"><span>Showing {filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length.toLocaleString("en-IN")}</span><div><button disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))} aria-label="Previous icons"><ChevronLeft size={15}/></button><b>{page + 1} / {pageCount}</b><button disabled={page + 1 >= pageCount} onClick={() => setPage(Math.min(pageCount - 1, page + 1))} aria-label="Next icons"><ChevronRight size={15}/></button></div></footer>
              </section>
              <aside className="ax-icon-customiser">
                <div className="ax-icon-preview-label"><span>LIVE PREVIEW</span><small>DRAG / STYLE / SAVE</small></div>
                <motion.div className={`ax-icon-preview-tile ${variantClass}`} style={variantStyle} animate={{ rotateX: tilt * -0.45, rotateY: tilt, y: [0, -3, 0] }} transition={{ rotateX: { duration: 0.35 }, rotateY: { duration: 0.35 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}>
                  <span className="ax-icon-preview-gloss"/>{customAsset ? <img className="ax-icon-custom-asset" src={customAsset} alt="Imported logo preview"/> : <i className={iconClass(selected?.name || "settings", selected?.variant)} aria-hidden="true"/>}
                </motion.div>
                <div className="ax-icon-selected-name"><strong>{selected?.name.replaceAll("-", " ") || selectedIcon}</strong><span>{selected?.category || "Tabler outline glyph"}</span></div>
                                <label className="ax-icon-field">Logo target<select value={targetType} onChange={event => { setTargetType(event.target.value as typeof targetType); setTargetRecordId(""); setTargetSubcategoryId(""); setSpecificProcess(""); }}><option value="process">Process Directory record</option><option value="subcategory">Process sub-category record</option><option value="component">Component Master record</option><option value="family">Process family default</option><option value="exact">Exact process / operation name</option></select><ChevronDown size={13}/></label>
                {(targetType === "process" || targetType === "component" || targetType === "subcategory") && <SearchablePicker id="icon-studio-stable-target" label={targetType === "process" ? "Process definition *" : targetType === "subcategory" ? "Process sub-category *" : "Component master *"} value={targetType === "subcategory" ? targetSubcategoryId : targetRecordId} placeholder={targetType === "process" ? "Search category, process or subcategory…" : targetType === "subcategory" ? "Search process and sub-category…" : "Search part number or component name…"} options={targetOptions} onChange={targetType === "subcategory" ? setTargetSubcategoryId : setTargetRecordId}/>}
                {targetType === "family" && <label className="ax-icon-field">Default process family<select value={family} onChange={(event) => setFamily(event.target.value)}>{families.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label>}
                {targetType === "exact" && <label className="ax-icon-field">Exact process / operation<input value={specificProcess} onChange={(event) => setSpecificProcess(event.target.value)} placeholder="e.g. CNC Turning - Shaft OP10"/></label>}
                <div className="ax-icon-field-label"><span>Surface finish</span><small>{finish}</small></div>
                <div className="ax-icon-finish-options">{finishes.map((item) => <button key={item} className={finish === item ? "active" : ""} onClick={() => setFinish(item)}>{item}</button>)}</div>
                <div className="ax-icon-field-label"><span>Material / colour</span><small>{paletteName}</small></div>
                <div className="ax-icon-palette">{palettes.map((item) => <button key={item.name} title={item.name} aria-label={item.name} className={paletteName === item.name ? "active" : ""} style={{ background: item.color }} onClick={() => setPaletteName(item.name)}/>)}</div>
                <label className="ax-icon-slider"><span>Bevel depth <b>{depth}/4</b></span><input type="range" min="1" max="4" step="1" value={depth} onChange={(event) => setDepth(Number(event.target.value))}/></label>
                <label className="ax-icon-slider"><span>3D tilt <b>{tilt}°</b></span><input type="range" min="-18" max="18" step="9" value={tilt} onChange={(event) => setTilt(Number(event.target.value))}/></label>
                <div className="ax-icon-field-label"><span>Custom logo file</span><small>SVG / PNG import and export</small></div>
                <label className="ax-icon-import-control">Import SVG or PNG<input type="file" accept="image/svg+xml,image/png,.svg,.png" onChange={event => { handleAssetImport(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label>
                <div className="ax-icon-export-actions"><button type="button" onClick={() => void exportLogo("svg")}>Export SVG</button><button type="button" onClick={() => void exportLogo("png")}>Export PNG</button></div>
                <div className="ax-icon-field-label"><span>Saved style presets</span><small>{presets.length} saved</small></div>
                <div className="ax-icon-presets-list">
                  {presets.slice(0, 6).map((preset, index) => (
                    <button key={preset.iconName + (preset.iconVariant || "outline") + preset.palette + preset.finish + index} onClick={() => { setSelectedIcon(`${preset.iconVariant || "outline"}:${preset.iconName}`); setPaletteName(preset.palette); setFinish(preset.finish); setDepth(preset.depth); setTilt(preset.tilt); }}>
                      <i className={iconClass(preset.iconName, preset.iconVariant)} aria-hidden="true"/>
                      <span><strong>{preset.iconName.replaceAll("-", " ")}</strong><small>{preset.iconVariant || "outline"} · {preset.finish} · {preset.palette}</small></span>
                      <ChevronRight size={12}/>
                    </button>
                  ))}
                  {!presets.length && <span className="ax-icon-presets-empty">Save a process icon to create your first reusable style.</span>}
                </div>
                <div className="ax-icon-version-history"><div className="ax-icon-field-label"><span>Version history</span><small>{assignments[assignmentKey]?.revision ? "v" + assignments[assignmentKey].revision : "Not assigned"}</small></div>{(assignments[assignmentKey]?.history || []).slice().reverse().slice(0, 5).map((version, index) => <button type="button" key={version.updatedAt + ":" + index} onClick={() => restoreVersion(version)}>v{version.revision || "—"} · {version.iconName.replaceAll("-", " ")} <small>{new Date(version.updatedAt).toLocaleString("en-IN")}</small></button>)}</div>
                <button className="ax-icon-save" onClick={saveAssignment} disabled={((targetType === "process" || targetType === "component") && !targetRecordId) || (targetType === "subcategory" && !targetSubcategoryId) || (targetType === "exact" && !specificProcess.trim())}><Sparkles size={16}/> Save & apply to {selectedTargetLabel || (targetType === "exact" ? specificProcess.trim() : family)}</button>
                {assignments[assignmentKey] && <button className="ax-icon-reset" onClick={() => removeAssignment(assignmentKey)}>Restore AXIMACH default icon</button>}
                {notice && <div className="ax-icon-notice"><Check size={13}/>{notice}</div>}
              </aside>
            </div>
            <footer className="ax-icon-studio-bottom"><span><i/> {syncStatus === "synced" ? "Saved and synced across connected AXIMACH devices" : syncStatus === "syncing" ? "Saving visual preferences to the shared AXIMACH server…" : syncStatus === "error" ? "Saved on this device · shared sync failed" : "Saved on this device · shared server not configured"}</span><span>Icon glyphs: Tabler Icons · MIT license</span></footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
