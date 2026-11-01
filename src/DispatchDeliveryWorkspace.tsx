import { useEffect, useState } from "react";
import WipDispatchWorkspace from "./WipDispatchWorkspace";
type ProcessSelection = { companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string };
type Props = { initialMode: "wip" | "dispatch"; initialSelection?: ProcessSelection | null; onInitialSelectionApplied?: () => void; onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void; onOpenOperation: (selection: ProcessSelection) => void };
export default function DispatchDeliveryWorkspace(props: Props) {
  const [mode,setMode] = useState<"wip" | "dispatch">(props.initialMode);
  useEffect(() => setMode(props.initialMode),[props.initialMode]);
  return <WipDispatchWorkspace mode={mode} onChangeMode={setMode} initialSelection={props.initialSelection} onInitialSelectionApplied={props.onInitialSelectionApplied} onBack={props.onBack} onNotice={props.onNotice} notice={props.notice} onSelectModule={props.onSelectModule} onOpenOperation={props.onOpenOperation}/>;
}
