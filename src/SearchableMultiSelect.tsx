import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFloatingMenuPosition } from "./useFloatingMenuPosition";
import type { SearchableOption } from "./SearchablePicker";
type Props = { id: string; label: string; options: SearchableOption[]; selected: string[]; onChange: (next: string[]) => void; placeholder?: string; emptyMeansAll?: boolean; disabled?: boolean; maxResults?: number; };

/** Searchable column multi-select with explicit Select all, Clear and Done actions. */
export default function SearchableMultiSelect({ id, label, options, selected, onChange, placeholder = "Search and select…", emptyMeansAll = false, disabled = false, maxResults = 100 }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPosition = useFloatingMenuPosition(anchorRef, open && !disabled, 310, 210);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [open]);
  const selectedSet = new Set(selected);
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); const rows = needle ? options.filter(option => option.label.toLocaleLowerCase().includes(needle)) : options; return rows.slice(0, maxResults); }, [options, query, maxResults]);
  const summary = emptyMeansAll && selected.length === 0 ? "All " + label.toLowerCase() : selected.length ? selected.map(idValue => options.find(option => option.id === idValue)?.label).filter(Boolean).join(", ") : "None selected";
  const toggle = (idValue: string) => onChange(selectedSet.has(idValue) ? selected.filter(value => value !== idValue) : [...selected, idValue]);
  return <div ref={anchorRef} className={"ax-search-multi" + (disabled ? " is-disabled" : "")}>
    <label htmlFor={id}>{label}</label>
    <button type="button" id={id} className="ax-search-multi-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={id + "-menu"} onClick={() => setOpen(value => !value)}><span>{summary}</span><i>⌄</i></button>
    {open && !disabled && menuPosition && createPortal(
      <div
        ref={menuRef}
        id={id + "-menu"}
        className="ax-search-multi-menu"
        style={{
          position: menuPosition.position,
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          maxHeight: menuPosition.maxHeight,
          boxSizing: "border-box",
          zIndex: 2147483300
        }}
      >
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setQuery(""); } }}
          placeholder={placeholder}
          autoFocus
          aria-label={"Search " + label}
        />
        <div className="ax-search-multi-actions"><button type="button" onClick={() => onChange(options.map(option => option.id))}>Select all</button><button type="button" onClick={() => onChange([])}>Clear</button><button type="button" onClick={() => { setOpen(false); setQuery(""); }}>Done</button></div>
        <div className="ax-search-multi-options" role="listbox" aria-multiselectable="true">
          {filtered.length ? filtered.map(option => <label key={option.id}><input type="checkbox" checked={emptyMeansAll ? selected.length === 0 || selectedSet.has(option.id) : selectedSet.has(option.id)} onChange={() => { if (emptyMeansAll && selected.length === 0) onChange(options.filter(item => item.id !== option.id).map(item => item.id)); else toggle(option.id); }}/><span>{option.label}</span></label>) : <small>No matching records.</small>}
        </div>
        {filtered.length === maxResults && <small className="ax-search-multi-hint">Showing first {maxResults}; type more to narrow.</small>}
      </div>,
      document.body
    )}
  </div>;
}