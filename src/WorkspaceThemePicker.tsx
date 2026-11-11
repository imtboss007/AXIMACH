import type { WorkspaceTheme } from "./workspaceTheme";

type Props={value:WorkspaceTheme;onChange:(value:WorkspaceTheme)=>void;};
export default function WorkspaceThemePicker({value,onChange}:Props){
 return <label className="ax-workspace-theme-picker" title="Change this workspace colour theme">
  <span>Theme</span>
  <select value={value} onChange={event=>onChange(event.target.value as WorkspaceTheme)} aria-label="Workspace colour theme">
   <option value="light">Light</option>
   <option value="medium">Medium</option>
   <option value="dark">Dark</option>
   <option value="ocean">Ocean</option>
  </select>
 </label>;
}
