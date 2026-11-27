import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, Truck } from "lucide-react";
import { VehicleIcon, VEHICLE_TYPES } from "./TransportVehicle";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  placeholder?: string;
  disabled?: boolean;
};

/** Searchable, icon-led selector for the complete canonical transport catalogue. */
export default function VehicleTypePicker({
  id, label, value, onChange, options = [], placeholder = "Search vehicle type…", disabled = false
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const choices = useMemo(() => [...new Set([...VEHICLE_TYPES, ...options, value].filter(item => typeof item === "string" && item.trim()))], [options, value]);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? choices.filter(item => item.toLocaleLowerCase().includes(needle)) : choices;
  }, [choices, query]);
  const select = (item: string) => {
    onChange(item);
    setQuery("");
    setOpen(false);
  };
  return <div className="vehicle-type-picker">
    <label htmlFor={id}>{label}</label>
    <div className={"vehicle-type-picker-control" + (open ? " is-open" : "")}>
      <span className="vehicle-type-picker-current-icon" aria-hidden="true">
        {value ? <VehicleIcon vehicleType={value} size={20}/> : <Truck size={19}/>}
      </span>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id + "-options"}
        aria-label={label}
        value={open ? query : value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "Escape") { setQuery(""); setOpen(false); }
          if (event.key === "Enter" && matches.length) { event.preventDefault(); select(matches[0]); }
          if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true); }
        }}
      />
      <button type="button" aria-label={open ? "Close vehicle types" : "Show vehicle types"} aria-expanded={open}
        disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(""); setOpen(current => !current); }}>
        <ChevronDown size={15}/>
      </button>
    </div>
    {open && !disabled && <div className="vehicle-type-picker-menu" id={id + "-options"} role="listbox" aria-label="Transport vehicle types">
      <div className="vehicle-type-picker-count"><Search size={12}/><span>{matches.length} of {choices.length} vehicle types</span></div>
      {matches.length ? matches.map(item => {
        const visual = undefined;
        return <button type="button" role="option" aria-selected={item === value} key={item}
          onMouseDown={event => event.preventDefault()} onClick={() => select(item)}>
          <span className="vehicle-type-picker-option-icon"><VehicleIcon vehicleType={item} size={22}/></span>
          <span className="vehicle-type-picker-option-label">{item}</span>
          {item === value && <Check size={14} className="vehicle-type-picker-selected"/>}
        </button>;
      }) : <div className="vehicle-type-picker-empty">No matching vehicle type. Choose one of the supported types.</div>}
    </div>}
  </div>;
}
