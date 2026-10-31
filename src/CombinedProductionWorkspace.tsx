import { useState } from "react";
import { CalendarDays, Workflow } from "lucide-react";
import LinkedProcessWorkspace from "./LinkedProcessWorkspace";
import ProductionPlanningWorkspace from "./ProductionPlanningWorkspace";

type Props = { initialView: "planning" | "map"; onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };

export default function CombinedProductionWorkspace({ initialView, onBack, onNotice, notice, onSelectModule }: Props) {
  const [view, setView] = useState<"planning" | "map">(initialView);
  return <section className="combined-production-workspace">
    <header className="combined-production-header">
      <div><div className="eyebrow">AXIMACH / OPERATIONS CONTROL</div><h1>Production Planning / Process Map</h1><p>One workspace for component planning, process routes, vendor execution and delivery control.</p></div>
      <nav className="combined-production-tabs" aria-label="Production workspace views">
        <button type="button" className={view === "planning" ? "active" : ""} onClick={() => setView("planning")}><CalendarDays size={15}/> Production Planning</button>
        <button type="button" className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Workflow size={15}/> Process Map</button>
      </nav>
    </header>
    {view === "planning" ? <ProductionPlanningWorkspace onBack={onBack} onNotice={onNotice} onSelectModule={onSelectModule}/> : <LinkedProcessWorkspace onBack={onBack} onNotice={onNotice} notice={notice} onSelectModule={onSelectModule}/>}
  </section>;
}
