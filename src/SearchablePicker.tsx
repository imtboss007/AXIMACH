import { useEffect, useId, useMemo, useState, type FocusEvent } from "react";

export type SearchableOption = { id: string; label: string };
type Props = { id: string; label: string; value: string; options: SearchableOption[]; onChange: (id: string) => void; placeholder?: string; disabled?: boolean; allowCustom?: boolean; maxResults?: number; };

/** Search-first picker that stores a selected record ID, never a display label. */
export default function SearchablePicker({ id, label, value, options, onChange, placeholder = "Type to search…", disabled = false, allowCustom = false, maxResults = 30 }: Props) {
  const reactId = useId().replace(/:/g, "");
  const listId = id + "-choices-" + reactId;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(option => option.id === value)?.label || (allowCustom ? value : "");
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options.slice(0, maxResults);
    return options.filter(option => option.label.toLocaleLowerCase().includes(needle)).sort((a, b) => { const left=a.label.trim().toLocaleLowerCase(), right=b.label.trim().toLocaleLowerCase(); const rank=(label:string)=>label===needle?0:label.startsWith(needle)?1:2; return rank(left)-rank(right)||left.localeCompare(right); }).slice(0, maxResults);
  }, [options, query, maxResults]);
  useEffect(() => { if (!open) setQuery(""); }, [value, open]);
  const select = (option: SearchableOption) => { onChange(option.id); setQuery(""); setOpen(false); };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    const typedValue = query.trim();
    if (allowCustom && typedValue) {
      const exact = options.find(option => option.label.trim().toLocaleLowerCase() === typedValue.toLocaleLowerCase());
      onChange(exact?.id || typedValue);
    }
    setOpen(false);
    setQuery("");
  };
  return <div className="searchable-picker" onBlur={handleBlur}>
    <label htmlFor={id}>{label}</label>
    <div className="searchable-picker-control">
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} value={open ? query : selectedLabel} disabled={disabled} placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); if (value && event.target.value !== selectedLabel) onChange(""); }}
        onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setQuery(""); } if (event.key === "Enter") { event.preventDefault(); if (matches[0]) select(matches[0]); else if (allowCustom && query.trim()) { onChange(query.trim()); setOpen(false); setQuery(""); } } }} />
      <span aria-hidden="true" className="searchable-picker-caret">⌄</span>
    </div>
    {open && !disabled && <div className="searchable-picker-menu" id={listId} role="listbox">
      {matches.length ? matches.map(option => <button type="button" role="option" aria-selected={option.id === value} key={option.id} onMouseDown={event => event.preventDefault()} onClick={() => select(option)}><span>{option.label}</span>{option.id === value && <b>Selected</b>}</button>) : <div className="searchable-picker-empty">{allowCustom ? "Press Enter to use this value." : "No exact or partial match."}</div>}
      {matches.length === maxResults && <small className="searchable-picker-hint">Showing first {maxResults}. Type more to narrow the results.</small>}
    </div>}
  </div>;
}