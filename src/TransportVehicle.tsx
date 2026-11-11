import type { CSSProperties } from "react";
import { Bike, Bus, Boxes, Car, Package, Truck, type LucideIcon } from "lucide-react";
import type { ComponentTransportLegRecord, TransportRouteRecord } from "./manufacturingData";

export const VEHICLE_TYPES = [
  "2-wheeler",
  "3-wheeler",
  "4-wheeler",
  "Light commercial vehicle",
  "Mini truck",
  "Heavy-duty 4-wheeler",
  "Heavy truck",
  "Container truck",
  "Trailer / tractor",
  "Bus / staff vehicle",
  "Courier / delivery"
] as const;

type VehicleVisual = { Icon: LucideIcon; color: string };

export function getVehicleVisual(vehicleType: string): VehicleVisual {
  const value = (vehicleType || "").toLowerCase();
  if (/courier|delivery/.test(value)) return { Icon: Bike, color: "#B56BC5" };
  if (/2.?wheel|bike|motorcycle|scooter/.test(value)) return { Icon: Bike, color: "#D49A2D" };
  if (/3.?wheel|auto|rickshaw/.test(value)) return { Icon: Bus, color: "#16A6A0" };
  if (/heavy.?duty/.test(value)) return { Icon: Truck, color: "#C94D75" };
  if (/4.?wheel|pickup|car/.test(value)) return { Icon: Car, color: "#397FE0" };
  if (/bus|staff/.test(value)) return { Icon: Bus, color: "#9869D5" };
  if (/container/.test(value)) return { Icon: Boxes, color: "#7B8BA5" };
  if (/trailer|tractor/.test(value)) return { Icon: Package, color: "#C46A42" };
  if (/mini.?truck/.test(value)) return { Icon: Package, color: "#A17A35" };
  if (/light commercial|lcv|van/.test(value)) return { Icon: Bus, color: "#299A70" };
  if (/heavy|truck/.test(value)) return { Icon: Truck, color: "#D45E52" };
  return { Icon: Truck, color: "#607D9D" };
}

export function VehicleIcon({ vehicleType, size = 17 }: { vehicleType: string; size?: number }) {
  const { Icon, color } = getVehicleVisual(vehicleType);
  return <Icon size={size} strokeWidth={2.15} style={{ color, flex: "0 0 auto" }} aria-hidden="true" />;
}

export function VehicleBadge({ vehicleType }: { vehicleType: string }) {
  const { Icon, color } = getVehicleVisual(vehicleType);
  return <span className="transport-vehicle-chip" data-vehicle={vehicleType} style={{ "--vehicle-color": color } as CSSProperties}>
    <Icon size={16} strokeWidth={2.1} aria-hidden="true" />
    <span>{vehicleType}</span>
  </span>;
}

type TransportLegMarkerProps = {
  leg: ComponentTransportLegRecord;
  vendorName: string;
  selected: boolean;
  onSelect: () => void;
  routeRecord?: TransportRouteRecord;
};

const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function TransportLegMarker({ leg, vendorName, selected, onSelect, routeRecord }: TransportLegMarkerProps) {
  const { color } = getVehicleVisual(leg.vehicleType);
  const placement = leg.placement === "start" || !leg.anchorOperationId ? "Before route" : leg.placement === "before" ? "Before process" : "After process";
  return <span className={"transport-leg-marker" + (selected ? " is-selected" : "")} style={{ "--vehicle-color": color } as CSSProperties}>
    <button type="button" className="transport-leg-marker-button" onClick={onSelect} aria-expanded={selected}
      aria-label={"Open transport leg " + leg.fromLocation + " to " + leg.toLocation + " by " + leg.vehicleType}
      title={leg.fromLocation + " → " + leg.toLocation + " · " + leg.vehicleType}>
      <VehicleIcon vehicleType={leg.vehicleType} size={19} />
    </button>
    {selected && <span className="transport-leg-popover" role="dialog" aria-label="Saved transport directory record and component leg">
      <strong>TRANSPORT RECORD · {leg.id}</strong>
      <span>{leg.fromLocation} → {leg.toLocation}</span>
      <small>Transport Directory ID: {routeRecord?.id || leg.routeId}</small>
      <small>Vendor: {vendorName || "Vendor not linked"} · {leg.vehicleType} · {leg.tripDirection}</small>
      <small>Directory route: {routeRecord ? (routeRecord.active ? "Active" : "Inactive") : "Directory master not found"}</small>
      {routeRecord && <small>Directory fixed rate: {money(routeRecord.fixedAmount)} · {routeRecord.currency || "INR"}</small>}
      <small>Saved component rate snapshot: {money(leg.fixedAmount)}</small>
      <small>{placement} · {leg.tripCount} trip(s) · {leg.status || "Status not set"}</small>
      <b>{leg.tripCount} × {money(leg.fixedAmount)} = {money(leg.tripCount * leg.fixedAmount)}</b>
      {leg.pickupAt && <small>Pickup: {leg.pickupAt}</small>}
      {leg.deliveryAt && <small>Delivery: {leg.deliveryAt}</small>}
      {routeRecord?.notes && <small>Directory notes: {routeRecord.notes}</small>}
      {leg.notes && <small>Component-leg notes: {leg.notes}</small>}
    </span>}
  </span>;
}
