import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export type SearchableOption = { id: string; label: string };
type Props = {
  id: string;
  label: string;
  value: string;
  options: SearchableOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

/** Keyboard-accessible searchable single-record picker. Stable record IDs are returned to the caller. */
export default function SearchablePicker({ id, label, value, options, onChange, placeholder = "Type to search…", disabled = false }: Props) {
  const reactId = useId().replace(/:/g, "");
  const listId = id + "-choices-" + reactId;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(option => option.id === value)?.label || "";
  const filtered = useMemo(() => options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())), [options,query]);
  useEffect(() => {
    if (value) { setQuery(""); setOpen(false); }
  }, [value]);

  const choose = (option:SearchableOption) => {
    onChange(option.id);
    setQuery("");
    setOpen(false);
  };
  const handleInput = (nextValue:string) => {
    setQuery(nextValue);
    setOpen(true);
    if(value) onChange("");
  };

  return <div className={"searchable-picker"+(open?" searchable-picker-open":"")}>
    <label htmlFor={id}>{label}</label>
    <div className="searchable-picker-control">
      <Search size={14} aria-hidden="true"/>
      <input id={id} role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={open} value={open?query:selectedLabel} disabled={disabled} placeholder={placeholder}
        onFocus={()=>{setOpen(true);setQuery("");}}
        onChange={event=>handleInput(event.target.value)}
        onKeyDown={event=>{if(event.key==="Escape"){setOpen(false);setQuery("");}else if(event.key==="Enter"&&filtered.length===1){event.preventDefault();choose(filtered[0]);}else if(event.key==="ArrowDown"){setOpen(true);}}}
        onBlur={()=>{setOpen(false);setQuery("");}}/>
      {value&&!disabled&&<button type="button" className="searchable-picker-clear" aria-label={"Clear "+label} title="Clear selection" onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange("");setQuery("");setOpen(true);document.getElementById(id)?.focus();}}><X size={13}/></button>}
      <ChevronDown size={14} aria-hidden="true"/>
    </div>
    {open&&!disabled&&<div className="searchable-picker-menu" id={listId} role="listbox" onMouseDown={event=>event.preventDefault()}>
      <div className="searchable-picker-menu-meta"><span>{filtered.length} matching records</span>{value&&<button type="button" onClick={()=>{onChange("");setQuery("");setOpen(true);}}>Clear selection</button>}</div>
      <div className="searchable-picker-options">
        {filtered.slice(0,100).map(option=><button type="button" role="option" aria-selected={option.id===value} key={option.id} onClick={()=>choose(option)}>{option.label}{option.id===value?<span>Selected</span>:null}</button>)}
        {!filtered.length&&<small>No matching saved records. Check the spelling or add the record in its master module.</small>}
        {filtered.length>100&&<small>Showing first 100 matches. Refine your search to narrow the list.</small>}
      </div>
    </div>}
  </div>;
}
