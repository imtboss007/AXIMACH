import { useEffect, useId, useState } from "react";

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

/** Search-first record picker. Labels are for display only; selected persistent IDs are stored. */
export default function SearchablePicker({ id, label, value, options, onChange, placeholder = "Type to search…", disabled = false }: Props) {
  const reactId = useId().replace(/:/g, "");
  const listId = id + "-choices-" + reactId;
  const [query, setQuery] = useState("");
  const selectedLabel = options.find(option => option.id === value)?.label || "";
  useEffect(() => { if (value) setQuery(""); }, [value]);

  const handleChange = (nextValue: string) => {
    const match = options.find(option => option.label.trim().toLocaleLowerCase() === nextValue.trim().toLocaleLowerCase());
    if (match) {
      onChange(match.id);
      setQuery("");
      return;
    }
    setQuery(nextValue);
    if (value) onChange("");
    if (!nextValue) onChange("");
  };

  return <label className="searchable-picker" htmlFor={id}>
    {label}
    <input id={id} list={listId} value={query || selectedLabel} disabled={disabled} placeholder={placeholder}
      onChange={event => handleChange(event.target.value)}
      onBlur={() => { if (query) setQuery(""); }}/>
    <datalist id={listId}>{options.map(option => <option key={option.id} value={option.label}/>)}</datalist>
    {query && !options.some(option => option.label.toLocaleLowerCase() === query.trim().toLocaleLowerCase()) && <small className="searchable-picker-hint">Choose a matching saved record from the suggestions.</small>}
  </label>;
}
