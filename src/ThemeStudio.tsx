import { useEffect, useState, type CSSProperties } from "react";
import {
  Check, Monitor, Moon, Palette, RotateCcw, Sun, X
} from "lucide-react";
import {
  buildThemeTokens, resolveThemePreference, THEME_PRESETS,
  type AppearanceMode, type ThemePreference, type ThemeTokens
} from "./aximachThemeStudio";

type Props = {
  open: boolean;
  preference: ThemePreference;
  systemDark: boolean;
  onChange: (preference: ThemePreference) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
};

const colourFields: Array<{key:keyof Omit<ThemeTokens,"chartColors"|"graphColors">;label:string}> = [
  {key:"accent",label:"Main accent"},
  {key:"secondaryAccent",label:"Secondary accent"},
  {key:"background",label:"Background"},
  {key:"surface",label:"Surface"},
  {key:"panel",label:"Panel"},
  {key:"navigation",label:"Navigation"},
  {key:"sidebar",label:"Sidebar"},
  {key:"border",label:"Borders"},
  {key:"text",label:"Text"},
  {key:"mutedText",label:"Muted text"},
  {key:"selected",label:"Selected state"},
  {key:"active",label:"Active state"}
];

const modes: Array<{id:AppearanceMode;label:string;icon:typeof Sun;description:string}> = [
  {id:"dark",label:"Dark",icon:Moon,description:"Dark appearance"},
  {id:"light",label:"Light",icon:Sun,description:"Light appearance"},
  {id:"system",label:"System",icon:Monitor,description:"Follow device setting"},
  {id:"custom",label:"Custom",icon:Palette,description:"Use editable custom colours"}
];

function updateColour(preference:ThemePreference,key:keyof Omit<ThemeTokens,"chartColors"|"graphColors">,value:string):ThemePreference {
  return {...preference,preset:"custom",mode:"custom",custom:{...preference.custom,[key]:value}};
}
function updatePalette(preference:ThemePreference,key:"chartColors"|"graphColors",index:number,value:string):ThemePreference {
  const next=[...preference.custom[key]];
  next[index]=value;
  return {...preference,preset:"custom",mode:"custom",custom:{...preference.custom,[key]:next}};
}

function ColourControl({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
  const [draft,setDraft]=useState(value.toUpperCase());
  useEffect(()=>setDraft(value.toUpperCase()),[value]);
  return <label className="ax-theme-colour-control">
    <span>{label}</span>
    <span className="ax-theme-colour-inputs">
      <input type="color" value={value} onChange={event=>onChange(event.target.value)} aria-label={label+" colour picker"} />
      <input type="text" value={draft} maxLength={7} spellCheck={false}
        aria-label={label+" HEX value"} pattern="^#[0-9A-Fa-f]{6}$"
        onChange={event=>{const nextValue=event.target.value;setDraft(nextValue);if(/^#[0-9a-f]{6}$/i.test(nextValue))onChange(nextValue);}}
        onBlur={()=>{if(!/^#[0-9a-f]{6}$/i.test(draft))setDraft(value.toUpperCase());}} />
    </span>
  </label>;
}

export default function ThemeStudio({open,preference,systemDark,onChange,onApply,onCancel,onReset}:Props) {
  if(!open)return null;
  const resolved=resolveThemePreference(preference,systemDark);
  const tokens=resolved.tokens;
  const previewStyle={
    "--ax-preview-bg":tokens.background,
    "--ax-preview-surface":tokens.surface,
    "--ax-preview-panel":tokens.panel,
    "--ax-preview-nav":tokens.navigation,
    "--ax-preview-border":tokens.border,
    "--ax-preview-text":tokens.text,
    "--ax-preview-muted":tokens.mutedText,
    "--ax-preview-accent":tokens.accent,
    "--ax-preview-secondary":tokens.secondaryAccent,
    "--ax-preview-selected":tokens.selected
  } as CSSProperties;

  const choosePreset=(id:ThemePreference["preset"])=>{
    onChange({
      ...preference,
      preset:id,
      mode:id==="custom"?"custom":preference.mode==="custom"?"system":preference.mode
    });
  };
  const chooseMode=(mode:AppearanceMode)=>{
    onChange({
      ...preference,
      preset:mode==="custom"?"custom":preference.preset==="custom"?"titanium-graphite":preference.preset,
      mode
    });
  };

  return <div className="overlay-shell ax-theme-studio-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel();}}
    onKeyDown={event=>{if(event.key==="Escape")onCancel();}}>
    <section className="ax-theme-studio" role="dialog" aria-modal="true" aria-labelledby="ax-theme-studio-title">
      <header className="ax-theme-studio-header">
        <div className="ax-theme-studio-mark"><Palette size={20}/></div>
        <div className="ax-theme-studio-heading">
          <div className="eyebrow"><span className="eyebrow-mark"/> AXIMACH VISUAL SYSTEM</div>
          <h2 id="ax-theme-studio-title">Theme Studio</h2>
          <p>Change the complete application appearance. Your preview is temporary until applied.</p>
        </div>
        <button className="close-round" onClick={onCancel} aria-label="Close Theme Studio"><X size={18}/></button>
      </header>

      <div className="ax-theme-studio-body">
        <main className="ax-theme-studio-controls">
          <section className="ax-theme-section">
            <div className="ax-theme-section-heading">
              <div><strong>Ready-made themes</strong><small>Ten coordinated industrial appearances</small></div>
              <span>{resolved.label}</span>
            </div>
            <div className="ax-theme-preset-grid">
              {THEME_PRESETS.map(item=>{
                const dark=buildThemeTokens(item.id,true);
                const light=buildThemeTokens(item.id,false);
                const selected=preference.preset===item.id;
                return <button type="button" key={item.id} className={"ax-theme-preset"+(selected?" is-selected":"")}
                  aria-pressed={selected} onClick={()=>choosePreset(item.id)}>
                  <span className="ax-theme-preset-art" style={{background:dark.background,borderColor:dark.border}}>
                    <i style={{background:dark.navigation}}/>
                    <i style={{background:dark.panel}}/>
                    <i style={{background:dark.accent}}/>
                    <i style={{background:dark.secondaryAccent}}/>
                    <i style={{background:light.background,borderColor:light.border}}/>
                  </span>
                  <span className="ax-theme-preset-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  {selected&&<span className="ax-theme-preset-check"><Check size={13}/></span>}
                </button>;
              })}
            </div>
          </section>

          <section className="ax-theme-section">
            <div className="ax-theme-section-heading"><div><strong>Appearance mode</strong><small>Choose dark, light, system, or editable custom colours</small></div></div>
            <div className="ax-theme-mode-grid">
              {modes.map(item=>{const Icon=item.icon;return <button type="button" key={item.id}
                className={"ax-theme-mode"+(preference.mode===item.id?" is-selected":"")}
                aria-pressed={preference.mode===item.id} onClick={()=>chooseMode(item.id)}>
                <Icon size={16}/><span><strong>{item.label}</strong><small>{item.description}</small></span>
                {preference.mode===item.id&&<Check size={14}/>}
              </button>;})}
            </div>
          </section>

          {preference.mode==="custom"&&<section className="ax-theme-section ax-theme-custom">
            <div className="ax-theme-section-heading"><div><strong>Custom colour controls</strong><small>HEX entry and native colour picker for each token</small></div>
              <button type="button" className="button-quiet compact-button" onClick={onReset}><RotateCcw size={13}/> Reset colours</button>
            </div>
            <div className="ax-theme-subheading">APPLICATION COLOURS</div>
            <div className="ax-theme-colour-grid">
              {colourFields.map(field=><ColourControl key={field.key} label={field.label} value={tokens[field.key]}
                onChange={value=>onChange(updateColour(preference,field.key,value))}/>)}
            </div>
            <div className="ax-theme-subheading">CHART COLOURS</div>
            <div className="ax-theme-colour-grid ax-theme-palette-grid">
              {tokens.chartColors.map((value,index)=><ColourControl key={"chart-"+index} label={"Chart "+(index+1)} value={value}
                onChange={next=>onChange(updatePalette(preference,"chartColors",index,next))}/>)}
            </div>
            <div className="ax-theme-subheading">GRAPH COLOURS</div>
            <div className="ax-theme-colour-grid ax-theme-palette-grid">
              {tokens.graphColors.map((value,index)=><ColourControl key={"graph-"+index} label={"Graph "+(index+1)} value={value}
                onChange={next=>onChange(updatePalette(preference,"graphColors",index,next))}/>)}
            </div>
          </section>}
        </main>

        <aside className="ax-theme-preview" style={previewStyle}>
          <div className="ax-theme-preview-head"><span>LIVE PREVIEW</span><b>{resolved.label}</b></div>
          <div className="ax-theme-preview-shell">
            <div className="ax-theme-preview-nav"><span>AX</span><strong>AXIMACH</strong><i/><i/><i/></div>
            <div className="ax-theme-preview-content">
              <small>MANUFACTURING COMMAND</small>
              <strong>Production overview</strong>
              <p>Theme preview · no manufacturing data changed</p>
              <div className="ax-theme-preview-metrics"><span/><span/><span/></div>
              <div className="ax-theme-preview-chart">
                {tokens.chartColors.slice(0,5).map((colour,index)=><i key={index} style={{height:(35+index*10)+"%",background:colour}}/>)}
              </div>
              <div className="ax-theme-preview-graph">
                {tokens.graphColors.slice(0,5).map((colour,index)=><i key={index} style={{background:colour,transform:"translateY("+(index%2?8:0)+"px)"}}/>)}
              </div>
              <div className="ax-theme-preview-actions"><button>Selected panel</button><button>Action</button></div>
            </div>
          </div>
          <div className="ax-theme-preview-note">Preview applies across the existing application while this dialog is open. Cancel restores the saved appearance.</div>
        </aside>
      </div>

      <footer className="ax-theme-studio-footer">
        <span><i/> Changes are preview-only until Apply is selected</span>
        <div><button type="button" className="button-quiet" onClick={onCancel}>Cancel preview</button>
          <button type="button" className="button-primary" onClick={onApply}><Check size={14}/> Apply theme</button></div>
      </footer>
    </section>
  </div>;
}
