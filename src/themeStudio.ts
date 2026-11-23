export type ThemePresetId =
  | "titanium-graphite" | "obsidian" | "midnight-navy" | "carbon-emerald"
  | "industrial-slate" | "arctic-light" | "platinum-light" | "precision-orange"
  | "steel-blue" | "custom";
export type AppearanceMode = "dark" | "light" | "system" | "custom";

export interface ThemeTokens {
  background: string;
  surface: string;
  panel: string;
  navigation: string;
  sidebar: string;
  border: string;
  text: string;
  mutedText: string;
  accent: string;
  secondaryAccent: string;
  selected: string;
  active: string;
  chartColors: string[];
  graphColors: string[];
}

export interface ThemePreference {
  preset: ThemePresetId;
  mode: AppearanceMode;
  custom: ThemeTokens;
}

type SurfaceSet = Omit<ThemeTokens, "chartColors" | "graphColors">;
interface PresetDefinition {
  id: ThemePresetId;
  label: string;
  description: string;
  accent: string;
  secondaryAccent: string;
  dark: SurfaceSet;
  light: SurfaceSet;
  chartColors: string[];
  graphColors: string[];
}

const definitions: PresetDefinition[] = [
  {
    id: "titanium-graphite", label: "Titanium Graphite", description: "Graphite surfaces, titanium text and electric blue",
    accent: "#54a8f4", secondaryAccent: "#62c9df",
    dark: {background:"#111820",surface:"#1b2630",panel:"#202c36",navigation:"#0d141b",sidebar:"#101a23",border:"#344451",text:"#edf4f8",mutedText:"#a9bac5",selected:"#243e52",active:"#65b8ff"},
    light: {background:"#edf1f4",surface:"#ffffff",panel:"#f8fafb",navigation:"#f8fafb",sidebar:"#e4eaee",border:"#cbd5dc",text:"#192b38",mutedText:"#576b78",selected:"#dcecf8",active:"#176db5"},
    chartColors:["#54a8f4","#62c9df","#52b78b","#e2ab55","#d87578","#9a87d8","#7a9bab"],
    graphColors:["#54a8f4","#62c9df","#52b78b","#e2ab55","#d87578","#9a87d8","#7a9bab"]
  },
  {
    id: "obsidian", label: "Obsidian", description: "Near-black surfaces, platinum and precision orange",
    accent: "#f08a43", secondaryAccent: "#d9e0e5",
    dark: {background:"#090c0f",surface:"#151a1f",panel:"#1c2329",navigation:"#050709",sidebar:"#101519",border:"#343d44",text:"#f1f4f5",mutedText:"#a6b0b7",selected:"#422b20",active:"#ff9a52"},
    light: {background:"#f0f1f1",surface:"#ffffff",panel:"#f9fafa",navigation:"#fbfbfb",sidebar:"#e3e6e7",border:"#cbd0d2",text:"#20282d",mutedText:"#5e6b71",selected:"#f9e2d3",active:"#bb571b"},
    chartColors:["#f08a43","#d9e0e5","#58a9a1","#dbb35a","#ce6871","#8c82c4","#7895a1"],
    graphColors:["#f08a43","#d9e0e5","#58a9a1","#dbb35a","#ce6871","#8c82c4","#7895a1"]
  },
  {
    id: "midnight-navy", label: "Midnight Navy", description: "Deep navy, cobalt and engineering silver",
    accent: "#568fe9", secondaryAccent: "#a9c6e9",
    dark: {background:"#0a1524",surface:"#142338",panel:"#1a2b42",navigation:"#07101d",sidebar:"#0e1c2d",border:"#2a4059",text:"#edf4ff",mutedText:"#a9bdd4",selected:"#1e3857",active:"#76aaff"},
    light: {background:"#edf3f9",surface:"#ffffff",panel:"#f8fbff",navigation:"#f8fbff",sidebar:"#e1eaf3",border:"#c8d6e4",text:"#182c43",mutedText:"#5d7188",selected:"#dce9fb",active:"#235dba"},
    chartColors:["#568fe9","#a9c6e9","#51b7a0","#e2ad58","#d97584","#a38bda","#668ca8"],
    graphColors:["#568fe9","#a9c6e9","#51b7a0","#e2ad58","#d97584","#a38bda","#668ca8"]
  },
  {
    id: "carbon-emerald", label: "Carbon Emerald", description: "Carbon green-black, emerald and brushed titanium",
    accent: "#45b78c", secondaryAccent: "#a3c8bb",
    dark: {background:"#0d1714",surface:"#17231e",panel:"#1d2d25",navigation:"#080f0c",sidebar:"#101b16",border:"#2c4639",text:"#edf7f1",mutedText:"#a7c0b3",selected:"#1d4033",active:"#59d5a2"},
    light: {background:"#edf4f0",surface:"#ffffff",panel:"#f8fbf9",navigation:"#f8fbf9",sidebar:"#e0ebe4",border:"#c7d8ce",text:"#1b3328",mutedText:"#5c7567",selected:"#d9f0e4",active:"#16764f"},
    chartColors:["#45b78c","#a3c8bb","#6fa7d6","#d8ab5b","#d47778","#9c8bd0","#7a9b8b"],
    graphColors:["#45b78c","#a3c8bb","#6fa7d6","#d8ab5b","#d47778","#9c8bd0","#7a9b8b"]
  },
  {
    id: "industrial-slate", label: "Industrial Slate", description: "Slate metal, cyan highlights and warm neutral text",
    accent: "#4ab7c8", secondaryAccent: "#a9c2cc",
    dark: {background:"#171e24",surface:"#222c34",panel:"#29353e",navigation:"#11171d",sidebar:"#1a242c",border:"#3c4b55",text:"#eef3f5",mutedText:"#b0bec5",selected:"#1f414a",active:"#69d6e4"},
    light: {background:"#eef2f4",surface:"#ffffff",panel:"#f9fbfc",navigation:"#fafcfd",sidebar:"#e2e9ed",border:"#cad6dc",text:"#23333c",mutedText:"#61737d",selected:"#d9eef1",active:"#16798a"},
    chartColors:["#4ab7c8","#a9c2cc","#5ca3d2","#d7a34e","#c96d78","#9588c9","#82a18f"],
    graphColors:["#4ab7c8","#a9c2cc","#5ca3d2","#d7a34e","#c96d78","#9588c9","#82a18f"]
  },
  {
    id: "arctic-light", label: "Arctic Light", description: "Clean white, cool grey and engineering blue",
    accent: "#246fc2", secondaryAccent: "#3ca6c5",
    dark: {background:"#111c28",surface:"#1b2a39",panel:"#223343",navigation:"#0b1520",sidebar:"#152333",border:"#344a5d",text:"#eff6fc",mutedText:"#afc2d1",selected:"#253f58",active:"#73b5fa"},
    light: {background:"#f2f6fa",surface:"#ffffff",panel:"#ffffff",navigation:"#ffffff",sidebar:"#e8eef4",border:"#d0dbe5",text:"#172c40",mutedText:"#586f82",selected:"#dfeefa",active:"#145fae"},
    chartColors:["#246fc2","#3ca6c5","#29966f","#d59a36","#c85c66","#8273c7","#6b899f"],
    graphColors:["#246fc2","#3ca6c5","#29966f","#d59a36","#c85c66","#8273c7","#6b899f"]
  },
  {
    id: "platinum-light", label: "Platinum Light", description: "Platinum, silver and deep navy precision surfaces",
    accent: "#375d86", secondaryAccent: "#8297ac",
    dark: {background:"#111923",surface:"#1d2936",panel:"#263342",navigation:"#0c131c",sidebar:"#162230",border:"#3a4a59",text:"#f1f5f8",mutedText:"#b3c0ca",selected:"#263d55",active:"#8fb8df"},
    light: {background:"#f0f1f3",surface:"#ffffff",panel:"#fbfbfc",navigation:"#ffffff",sidebar:"#e3e6e9",border:"#ccd2d8",text:"#202c37",mutedText:"#5e6d79",selected:"#e0e8f0",active:"#294f78"},
    chartColors:["#375d86","#8297ac","#3e9c8a","#d09a4a","#c56c73","#8d80bf","#6b9aa9"],
    graphColors:["#375d86","#8297ac","#3e9c8a","#d09a4a","#c56c73","#8d80bf","#6b9aa9"]
  },
  {
    id: "precision-orange", label: "Precision Orange", description: "Industrial dark with high-visibility orange accents",
    accent: "#f18b3d", secondaryAccent: "#6ebed1",
    dark: {background:"#141719",surface:"#20272b",panel:"#293237",navigation:"#090d0f",sidebar:"#171e22",border:"#3e4a50",text:"#f5f4f1",mutedText:"#b6bec0",selected:"#4b3425",active:"#ff9a4e"},
    light: {background:"#f2f3f2",surface:"#ffffff",panel:"#fbfcfb",navigation:"#ffffff",sidebar:"#e5e9e7",border:"#cdd4d1",text:"#29332f",mutedText:"#64726d",selected:"#f8e4d5",active:"#bd5919"},
    chartColors:["#f18b3d","#6ebed1","#4ba985","#ddb35b","#d56f70","#a18ac8","#8b9da1"],
    graphColors:["#f18b3d","#6ebed1","#4ba985","#ddb35b","#d56f70","#a18ac8","#8b9da1"]
  },
  {
    id: "steel-blue", label: "Steel Blue", description: "Steel surfaces, blue depth and neutral grey",
    accent: "#4e9bd3", secondaryAccent: "#9bbbd0",
    dark: {background:"#101a24",surface:"#1b2a37",panel:"#223441",navigation:"#0a131c",sidebar:"#142330",border:"#314756",text:"#edf4f8",mutedText:"#abc0ce",selected:"#1c3b52",active:"#75baf0"},
    light: {background:"#edf3f7",surface:"#ffffff",panel:"#f9fbfc",navigation:"#ffffff",sidebar:"#e0eaf0",border:"#c7d7e1",text:"#1a303e",mutedText:"#5d7482",selected:"#dcecf4",active:"#1a6798"},
    chartColors:["#4e9bd3","#9bbbd0","#49a38b","#d5a14c","#c96a76","#9180c6","#6d9eae"],
    graphColors:["#4e9bd3","#9bbbd0","#49a38b","#d5a14c","#c96a76","#9180c6","#6d9eae"]
  },
  {
    id: "custom", label: "Custom Theme", description: "Your own coordinated industrial colour system",
    accent: "#54a8f4", secondaryAccent: "#62c9df",
    dark: {background:"#111820",surface:"#1b2630",panel:"#202c36",navigation:"#0d141b",sidebar:"#101a23",border:"#344451",text:"#edf4f8",mutedText:"#a9bac5",selected:"#243e52",active:"#65b8ff"},
    light: {background:"#edf1f4",surface:"#ffffff",panel:"#f8fafb",navigation:"#f8fafb",sidebar:"#e4eaee",border:"#cbd5dc",text:"#192b38",mutedText:"#576b78",selected:"#dcecf8",active:"#176db5"},
    chartColors:["#54a8f4","#62c9df","#52b78b","#e2ab55","#d87578","#9a87d8","#7a9bab"],
    graphColors:["#54a8f4","#62c9df","#52b78b","#e2ab55","#d87578","#9a87d8","#7a9bab"]
  }
];

export const THEME_PRESETS = definitions;
const presetIds = new Set(definitions.map(item => item.id));
const isHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function buildThemeTokens(preset: ThemePresetId, dark: boolean): ThemeTokens {
  const definition = definitions.find(item => item.id === preset) || definitions[0];
  const surfaces = dark ? definition.dark : definition.light;
  return {
    ...surfaces,
    chartColors: [...definition.chartColors],
    graphColors: [...definition.graphColors]
  };
}

export function createDefaultThemePreference(): ThemePreference {
  return {
    preset: "titanium-graphite",
    mode: "system",
    custom: buildThemeTokens("titanium-graphite", true)
  };
}

function sanitizeTokens(value: unknown): ThemeTokens {
  const fallback = buildThemeTokens("titanium-graphite", true);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<ThemeTokens>;
  const scalarKeys: Array<keyof Omit<ThemeTokens, "chartColors" | "graphColors">> = [
    "background","surface","panel","navigation","sidebar","border","text","mutedText",
    "accent","secondaryAccent","selected","active"
  ];
  const result = { ...fallback };
  for (const key of scalarKeys) if (isHex(candidate[key])) result[key] = candidate[key] as string;
  if (Array.isArray(candidate.chartColors) && candidate.chartColors.length >= 6) {
    result.chartColors = candidate.chartColors.slice(0, 7).map((item, index) => isHex(item) ? item : fallback.chartColors[index % fallback.chartColors.length]);
  }
  if (Array.isArray(candidate.graphColors) && candidate.graphColors.length >= 6) {
    result.graphColors = candidate.graphColors.slice(0, 7).map((item, index) => isHex(item) ? item : fallback.graphColors[index % fallback.graphColors.length]);
  }
  return result;
}

export function readThemePreference(): ThemePreference {
  const fallback = createDefaultThemePreference();
  try {
    const saved = window.localStorage.getItem("aximach.theme-studio.v1");
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ThemePreference>;
      const preset = presetIds.has(parsed.preset as ThemePresetId) ? parsed.preset as ThemePresetId : fallback.preset;
      const modes: AppearanceMode[] = ["dark","light","system","custom"];
      const mode = modes.includes(parsed.mode as AppearanceMode) ? parsed.mode as AppearanceMode : fallback.mode;
      return { preset, mode, custom: sanitizeTokens(parsed.custom) };
    }
    const legacy = window.localStorage.getItem("aximach.ui.appearance");
    if (legacy === "dark") return { ...fallback, mode: "dark" };
    if (legacy === "midnight") return { ...fallback, preset: "midnight-navy", mode: "dark" };
    if (legacy === "ocean") return { ...fallback, preset: "steel-blue", mode: "dark" };
    if (legacy === "light") return { ...fallback, preset: "arctic-light", mode: "light" };
  } catch {
    return fallback;
  }
  return fallback;
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem("aximach.theme-studio.v1", JSON.stringify(preference));
  } catch {
    // Theme continues to apply in this session when local storage is unavailable.
  }
}

function luminance(hex: string): number {
  if (!isHex(hex)) return 0;
  const channels = [1,3,5].map(start => parseInt(hex.slice(start,start+2),16) / 255).map(value =>
    value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4));
  return channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
}

export interface ResolvedTheme {
  appearance: "light" | "dark";
  dark: boolean;
  label: string;
  tokens: ThemeTokens;
  cssVariables: Record<string, string>;
}

export function resolveThemePreference(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  const customMode = preference.mode === "custom" || preference.preset === "custom";
  const tokens = customMode ? sanitizeTokens(preference.custom) : buildThemeTokens(
    preference.preset,
    preference.mode === "dark" ? true : preference.mode === "light" ? false : systemDark
  );
  const dark = customMode ? luminance(tokens.background) < .42
    : preference.mode === "dark" ? true
    : preference.mode === "light" ? false
    : systemDark;
  const preset = definitions.find(item => item.id === preference.preset) || definitions[0];
  const cssVariables: Record<string,string> = {
    "--ink": tokens.text, "--muted": tokens.mutedText, "--muted2": tokens.mutedText,
    "--line": tokens.border, "--line-strong": tokens.border, "--panel": tokens.panel,
    "--canvas": tokens.background, "--blue": tokens.accent, "--blue2": tokens.secondaryAccent,
    "--blue-soft": tokens.selected, "--navy": tokens.navigation, "--cyan": tokens.secondaryAccent,
    "--ax-theme-background": tokens.background, "--ax-theme-surface": tokens.surface,
    "--ax-theme-panel": tokens.panel, "--ax-theme-navigation": tokens.navigation,
    "--ax-theme-sidebar": tokens.sidebar, "--ax-theme-border": tokens.border,
    "--ax-theme-text": tokens.text, "--ax-theme-muted": tokens.mutedText,
    "--ax-theme-accent": tokens.accent, "--ax-theme-secondary": tokens.secondaryAccent,
    "--ax-theme-selected": tokens.selected, "--ax-theme-active": tokens.active,
    "--ax-theme-color-scheme": dark ? "dark" : "light"
  };
  tokens.chartColors.forEach((color,index) => { cssVariables[`--ax-theme-chart-${index+1}`] = color; });
  tokens.graphColors.forEach((color,index) => { cssVariables[`--ax-theme-graph-${index+1}`] = color; });
  return { appearance: dark ? "dark" : "light", dark, label: customMode ? "Custom Theme" : preset.label, tokens, cssVariables };
}
