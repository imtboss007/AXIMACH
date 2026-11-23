import { useMemo, useState } from "react";
import type { SearchableOption } from "./SearchablePicker";
type Props = { id: string; label: string; options: SearchableOption[]; selected: string[]; onChange: (next: string[]) => void; placeholder?: string; emptyMeansAll?: boolean; disabled?: boolean; maxResults?: number; };

/** Searchable column multi-select with explicit Select all, Clear and Done actions. */
export default function SearchableMultiSelect({ id, label, options, selected, onChange, placeholder = "Search and select…", emptyMeansAll = false, disabled = false, maxResults = 100 }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options.slice(0, maxResults);
    return options
      .map((option, index) => ({ option, index, label: option.label.trim().toLocaleLowerCase() }))
      .filter(item => item.label.includes(needle))
      .sort((a, b) => {
        const rank = (label: string) => label === needle ? 0 : label.startsWith(needle) ? 1 : 2;
        return rank(a.label) - rank(b.label) || a.label.localeCompare(b.label) || a.index - b.index;
      })
      .slice(0, maxResults)
      .map(item => item.option);
  }, [options, query, maxResults]);
  const summary = emptyMeansAll && selected.length === 0 ? "All " + label.toLowerCase() : selected.length ? selected.map(idValue => options.find(option => option.id === idValue)?.label).filter(Boolean).join(", ") : "None selected";
  const toggle = (idValue: string) => onChange(selectedSet.has(idValue) ? selected.filter(value => value !== idValue) : [...selected, idValue]);
  return <div className={"ax-search-multi" + (disabled ? " is-disabled" : "")}>
    <label htmlFor={id}>{label}</label>
    <button type="button" id={id} className="ax-search-multi-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(value => !value)}><span>{summary}</span><i>⌄</i></button>
    {open && !disabled && <div className="ax-search-multi-menu">
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={placeholder} autoFocus aria-label={"Search " + label}/>
      <div className="ax-search-multi-actions"><button type="button" onClick={() => onChange(options.map(option => option.id))}>Select all</button><button type="button" onClick={() => onChange([])}>Clear</button><button type="button" onClick={() => { setOpen(false); setQuery(""); }}>Done</button></div>
      <div className="ax-search-multi-options" role="listbox" aria-multiselectable="true">
        {filtered.length ? filtered.map(option => <label key={option.id}><input type="checkbox" checked={emptyMeansAll ? selected.length === 0 || selectedSet.has(option.id) : selectedSet.has(option.id)} onChange={() => { if (emptyMeansAll && selected.length === 0) onChange(options.filter(item => item.id !== option.id).map(item => item.id)); else toggle(option.id); }}/><span>{option.label}</span></label>) : <small>No matching records.</small>}
      </div>
      {filtered.length === maxResults && <small className="ax-search-multi-hint">Showing first {maxResults}; type more to narrow.</small>}
    </div>}
  </div>;
}