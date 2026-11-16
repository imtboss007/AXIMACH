import type { ManufacturingData, ProcessDefinitionRecord, VendorRecord } from "./manufacturingData";
import { VEHICLE_TYPES } from "./TransportVehicle";

export const AXIMACH_DEMO_ID_PREFIX = "DEMO-";
const id = (kind: string, key: string) => AXIMACH_DEMO_ID_PREFIX + kind + "-" + key.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
const date = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

type Step = { category: string; name: string; sub: string; machine: string; vendor: string; tol: "Standard" | "Precision" | "Close" | "Ultra Precision"; planned: number; actual: number; inspect?: boolean };
type Part = { key: string; co: "ASTER" | "MERIDIAN"; name: string; material: string; qty: number; price: number; tol: "Standard" | "Precision" | "Close" | "Ultra Precision"; steps: Step[] };

export function createAxMachTwoCompanyDemo(): ManufacturingData {
  const stamp = new Date().toISOString();
  const companies: ManufacturingData["companies"] = [
    { id: id("COMPANY", "ASTER"), name: "ASTER MOTION COMPONENTS PVT LTD", gstin: "", contactPerson: "Arun Demo", phone: "", email: "arun@aster-demo.invalid", address: "Bengaluru — DEMO", notes: "SYNTHETIC DEMO COMPANY — not a real customer.", createdAt: stamp, updatedAt: stamp },
    { id: id("COMPANY", "MERIDIAN"), name: "MERIDIAN FLUID SYSTEMS PVT LTD", gstin: "", contactPerson: "Meera Demo", phone: "", email: "meera@meridian-demo.invalid", address: "Coimbatore — DEMO", notes: "SYNTHETIC DEMO COMPANY — not a real customer.", createdAt: stamp, updatedAt: stamp }
  ];
  const factories: ManufacturingData["factories"] = companies.map((c, i) => ({ id: id("FACTORY", i ? "MERIDIAN" : "ASTER"), companyId: c.id, name: i ? "Meridian Demo Works" : "Aster Demo Works", address: c.address || "", contactPhone: "", createdAt: stamp, updatedAt: stamp }));
  const vendorSpecs = [
    ["CNC", "ASTER CNC & VMC SERVICES", "Ravi Demo", "CNC Turning; VMC Milling; Drilling", "CNC Lathe; VMC"],
    ["HEAT", "SOUTHERN HEAT TREAT DEMO", "Kiran Demo", "Vacuum Hardening; Carburising", "Heat-treatment furnace"],
    ["FAB", "PRECISION LASER & FAB DEMO", "Nila Demo", "Laser Cutting; Forming; MIG Welding; Powder Coating", "Fiber laser; press brake; MIG"],
    ["GRIND", "ACCURATE GRINDING DEMO", "Sanjay Demo", "Cylindrical Grinding; Surface Grinding; Internal Grinding; Deburring", "Cylindrical grinder; surface grinder"],
    ["QA", "METROLOGY & QUALITY DEMO LAB", "Leena Demo", "CMM Inspection; Dimensional Inspection; Pressure Testing; Final Inspection", "CMM; gauges; pressure rig"],
    ["LOG", "DEMO INDUSTRIAL LOGISTICS", "Manoj Demo", "Transport; Pickup; Delivery", "Road; air; rail; sea; inland waterway; multimodal"]
  ];
  const vendors: VendorRecord[] = vendorSpecs.map(([code, company, contact, processes, machines]) => ({
    id: id("VENDOR", code), company, contact, role: "Demo coordinator", phone: "", whatsappNumber: "",
    email: code.toLowerCase() + "@vendor-demo.invalid", address: "DEMO LOCATION — not a real supplier",
    processes, processDefinitionIds: [], machines, materials: "Synthetic demo only",
    notes: "SYNTHETIC DEMO VENDOR — do not contact.", status: "Demo only — not verified",
    sourceContactId: "", whatsappSyncedAt: "", vendorType: "Demo supplier", transportRoutes: [], additionalPhones: [],
    createdAt: stamp, updatedAt: stamp
  }));
  const parts: Part[] = [
    { key: "AST-1001", co: "ASTER", name: "Precision spindle sleeve", material: "EN24 / 42CrMo4", qty: 100, price: 1850, tol: "Ultra Precision", steps: [
      { category: "Turning", name: "CNC finish turning", sub: "OD/ID finish turning", machine: "CNC Lathe", vendor: "CNC", tol: "Precision", planned: 420, actual: 390 },
      { category: "Heat Treatment", name: "Vacuum hardening", sub: "Hardening and tempering", machine: "Vacuum furnace", vendor: "HEAT", tol: "Precision", planned: 260, actual: 250 },
      { category: "Grinding", name: "Cylindrical grinding", sub: "OD finish grinding", machine: "Cylindrical grinder", vendor: "GRIND", tol: "Ultra Precision", planned: 380, actual: 410 },
      { category: "Quality", name: "CMM inspection", sub: "Runout and bore measurement", machine: "CMM", vendor: "QA", tol: "Ultra Precision", planned: 120, actual: 110, inspect: true }
    ]},
    { key: "AST-1002", co: "ASTER", name: "Motor mounting bracket", material: "IS 2062 mild steel", qty: 250, price: 640, tol: "Standard", steps: [
      { category: "Laser Cutting", name: "Fiber laser cutting", sub: "Profile cutting", machine: "Fiber laser", vendor: "FAB", tol: "Standard", planned: 90, actual: 85 },
      { category: "Forming", name: "Press brake bending", sub: "Two-flange forming", machine: "Press brake", vendor: "FAB", tol: "Standard", planned: 75, actual: 70 },
      { category: "Welding", name: "MIG welding", sub: "Bracket seam welding", machine: "MIG station", vendor: "FAB", tol: "Standard", planned: 110, actual: 105 },
      { category: "Finishing", name: "Powder coating", sub: "Surface preparation and coating", machine: "Coating line", vendor: "FAB", tol: "Standard", planned: 95, actual: 100 },
      { category: "Quality", name: "Final inspection", sub: "Hole pattern and visual check", machine: "Inspection bench", vendor: "QA", tol: "Standard", planned: 35, actual: 30, inspect: true }
    ]},
    { key: "AST-1003", co: "ASTER", name: "Ground transmission gear shaft", material: "20MnCr5", qty: 80, price: 2450, tol: "Precision", steps: [
      { category: "Turning", name: "CNC shaft turning", sub: "Bearing seats and shoulders", machine: "CNC Lathe", vendor: "CNC", tol: "Precision", planned: 480, actual: 460 },
      { category: "Gear Cutting", name: "Gear hobbing", sub: "Spur gear tooth generation", machine: "Gear hobbing machine", vendor: "CNC", tol: "Precision", planned: 520, actual: 540 },
      { category: "Heat Treatment", name: "Carburising", sub: "Case hardening", machine: "Heat-treatment furnace", vendor: "HEAT", tol: "Precision", planned: 330, actual: 320 },
      { category: "Grinding", name: "Journal grinding", sub: "Bearing journal finish grind", machine: "Cylindrical grinder", vendor: "GRIND", tol: "Precision", planned: 260, actual: 275 },
      { category: "Metrology", name: "Gear inspection", sub: "Tooth profile and runout verification", machine: "Gear tester", vendor: "QA", tol: "Precision", planned: 150, actual: 140, inspect: true }
    ]},
    { key: "MER-2001", co: "MERIDIAN", name: "Hydraulic manifold block", material: "Aluminium 6082-T6", qty: 60, price: 3250, tol: "Precision", steps: [
      { category: "VMC Machining", name: "CNC face milling", sub: "Datum face machining", machine: "VMC", vendor: "CNC", tol: "Precision", planned: 550, actual: 530 },
      { category: "VMC Machining", name: "Deep-hole drilling", sub: "Cross-port drilling", machine: "VMC drilling setup", vendor: "CNC", tol: "Precision", planned: 420, actual: 440 },
      { category: "Threading", name: "CNC tapping", sub: "Threaded port finishing", machine: "Tapping setup", vendor: "CNC", tol: "Precision", planned: 210, actual: 205 },
      { category: "Deburring", name: "Precision deburring", sub: "Port edge and intersection deburring", machine: "Bench deburring", vendor: "GRIND", tol: "Precision", planned: 130, actual: 125 },
      { category: "Quality", name: "Pressure inspection", sub: "Bore, thread and leak verification", machine: "Pressure test rig", vendor: "QA", tol: "Precision", planned: 180, actual: 175, inspect: true }
    ]},
    { key: "MER-2002", co: "MERIDIAN", name: "Fixture base plate", material: "EN8", qty: 120, price: 1420, tol: "Standard", steps: [
      { category: "Sawing", name: "Band saw cutting", sub: "Raw blank preparation", machine: "Band saw", vendor: "CNC", tol: "Standard", planned: 110, actual: 105 },
      { category: "VMC Machining", name: "Face milling", sub: "Top and bottom face machining", machine: "VMC", vendor: "CNC", tol: "Standard", planned: 260, actual: 250 },
      { category: "VMC Machining", name: "Drilling and tapping", sub: "Mounting hole pattern", machine: "VMC", vendor: "CNC", tol: "Standard", planned: 180, actual: 190 },
      { category: "Grinding", name: "Surface grinding", sub: "Reference face finish", machine: "Surface grinder", vendor: "GRIND", tol: "Precision", planned: 220, actual: 215 },
      { category: "Quality", name: "Flatness inspection", sub: "Flatness and hole-location check", machine: "Surface plate", vendor: "QA", tol: "Standard", planned: 80, actual: 75, inspect: true }
    ]}
  ];

  const companyByCode = new Map(companies.map(c => [c.name.startsWith("ASTER") ? "ASTER" : "MERIDIAN", c]));
  const factoryByCompany = new Map(factories.map(f => [f.companyId, f]));
  const vendorByCode = new Map(vendorSpecs.map(([code], i) => [code, vendors[i]]));
  const parentSpecs = [
    { code: "ASTER" as const, key: "ASTER-DRIVE-ASSEMBLY", partNumber: "ASM-A-001", name: "Precision drive assembly" },
    { code: "MERIDIAN" as const, key: "MERIDIAN-FLUID-ASSEMBLY", partNumber: "ASM-B-001", name: "Hydraulic control assembly" }
  ];
  const componentIdByCompany = new Map(parentSpecs.map(spec => [spec.code, id("COMPONENT", spec.key)]));
  const components: ManufacturingData["components"] = parentSpecs.map(spec => {
    const owned = parts.filter(part => part.co === spec.code);
    return {
      id: componentIdByCompany.get(spec.code)!, companyId: companyByCode.get(spec.code)!.id,
      partNumber: spec.partNumber, name: spec.name, revision: "A", material: "Multi-material assembly",
      drawingReference: spec.partNumber + "-DEMO-ASSEMBLY.pdf",
      notes: "SYNTHETIC DEMO parent component. Child parts and their routes are stored separately.",
      salePrice: owned.reduce((sum, part) => sum + part.price, 0), salePriceUnit: "set", orderUnit: "Set", quantityPerUnit: 1,
      overhead: 35, toolingCost: 50, reworkCost: 20, scrapCost: 15, rejectedQty: 0, gstRate: 18,
      createdAt: stamp, updatedAt: stamp
    };
  });
  const componentParts: ManufacturingData["componentParts"] = [];
  const purchaseOrders: ManufacturingData["purchaseOrders"] = [];
  const operations: ManufacturingData["operations"] = [];
  const plannedCosts: ManufacturingData["plannedCosts"] = [];
  const materials: ManufacturingData["materials"] = [];
  const bomLines: ManufacturingData["bomLines"] = [];
  const materialCostEntries: ManufacturingData["materialCostEntries"] = [];
  const materialProcessLinks: ManufacturingData["materialProcessLinks"] = [];
  const inventoryTransactions: ManufacturingData["inventoryTransactions"] = [];
  const quotations: ManufacturingData["quotations"] = [];
  const paymentTransactions: ManufacturingData["paymentTransactions"] = [];
  const inspectionMeasurements: ManufacturingData["inspectionMeasurements"] = [];
  const routeRelationships: ManufacturingData["routeRelationships"] = [];
  const poMap = new Map<string, ManufacturingData["purchaseOrders"][number]>();
  const lineByPart = new Map<string, { poId: string; poLineId: string; componentId: string; companyId: string; factoryId: string }>();
  const mainOperationIdsByPart = new Map<string, string[]>();
  const quoteStatuses = ["Received", "Selected", "Rejected", "Expired"] as const;
  const inventoryTypes = ["Opening balance", "Receipt", "Issue to production", "WIP transfer", "Return", "Rejected", "Scrap", "Finished goods receipt", "Dispatch", "Adjustment"] as const;
  const relationshipTypes = ["main", "alternate", "rework", "dependency", "parallel", "merge", "split", "follow-on", "feedback", "conditional", "successor"] as const;

  for (const [partIndex, part] of parts.entries()) {
    const company = companyByCode.get(part.co)!;
    const factory = factoryByCompany.get(company.id)!;
    const componentId = componentIdByCompany.get(part.co)!;
    const partId = id("PART", part.key);
    const poId = id("PO", part.co);
    const lineId = id("LINE", part.key);
    let po = poMap.get(company.id);
    if (!po) {
      po = { id: poId, number: "DEMO-PO-" + (part.co === "ASTER" ? "001" : "002"), companyId: company.id, factoryId: factory.id,
        issueDate: date(), targetDelivery: date(35), status: "Open", notes: "DEMO ONLY — synthetic part-level purchase order.",
        lines: [], createdAt: stamp, updatedAt: stamp };
      poMap.set(company.id, po);
      purchaseOrders.push(po);
    }
    po.lines.push({ id: lineId, componentId, partId, allocationLevel: "part", quantity: part.qty, targetDelivery: date(35),
      unitPrice: part.price, notes: "Synthetic child-part PO line. No live purchase commitment exists.",
      jobStatus: partIndex % 2 ? "Finished" : "In progress", updatedAt: stamp });
    lineByPart.set(part.key, { poId, poLineId: lineId, componentId, companyId: company.id, factoryId: factory.id });

    const primaryMaterialId = id("MATERIAL", part.key + "-PRIMARY");
    const consumableMaterialId = id("MATERIAL", part.key + "-CONSUMABLE");
    const primaryDensity = /aluminium/i.test(part.material) ? 2700 : 7850;
    const plateLike = /bracket|manifold|block|base plate|mounting/i.test(part.name);
    const shapeType = plateLike ? "plate" : "round-bar";
    const dimensions: Record<string, number> = plateLike ? { length: 180, width: 110, thickness: 18 } : { length: 165, diameter: 52 };
    const dimensionUnits: Record<string, string> = Object.fromEntries(Object.keys(dimensions).map(key => [key, "mm"]));
    const volumeMm3 = plateLike ? dimensions.length! * dimensions.width! * dimensions.thickness! : Math.PI * Math.pow(dimensions.diameter!, 2) * dimensions.length! / 4;
    const weightPerPieceKg = volumeMm3 * primaryDensity / 1_000_000_000;
    const totalWeightKg = weightPerPieceKg * part.qty * 1.025;
    const materialRate = 420;
    const materialCost = totalWeightKg * materialRate;
    materials.push(
      { id: primaryMaterialId, code: "MAT-" + part.key + "-RAW", name: part.material, grade: part.material, unit: "kg",
        specification: "Synthetic material specification; verify against released drawing.", preferredVendorId: id("VENDOR", "CNC"),
        ratePerUnit: materialRate, notes: "DEMO raw material rate.", materialType: /aluminium/i.test(part.material) ? "Aluminium" : "Steel",
        shapeType, dimensions, dimensionUnit: "mm", densityKgM3: primaryDensity, densityUnit: "kg/m3", priceUnit: "kg", createdAt: stamp, updatedAt: stamp },
      { id: consumableMaterialId, code: "MAT-" + part.key + "-CONS", name: "Synthetic process consumable", grade: "Demo grade", unit: "kg",
        specification: "Synthetic consumable for route demonstration only.", preferredVendorId: id("VENDOR", "FAB"),
        ratePerUnit: 120, notes: "DEMO consumable rate.", materialType: "Consumable", densityKgM3: 900, densityUnit: "kg/m3",
        priceUnit: "kg", createdAt: stamp, updatedAt: stamp }
    );
    componentParts.push({
      id: partId, companyId: company.id, componentId, partNumber: part.key, name: part.name, revision: "A",
      drawingReference: part.key + "-DEMO-DRAWING.pdf", shapeType, dimensions, dimensionUnits,
      materialId: primaryMaterialId, materialIds: [primaryMaterialId, consumableMaterialId],
      vendorIds: [...new Set(part.steps.map(step => vendorByCode.get(step.vendor)!.id))],
      notes: "SYNTHETIC DEMO child part; not a released drawing or manufacturing instruction.", createdAt: stamp, updatedAt: stamp
    });
    const bomPrimaryId = id("BOM", part.key + "-PRIMARY");
    const bomConsumableId = id("BOM", part.key + "-CONSUMABLE");
    bomLines.push(
      { id: bomPrimaryId, componentId, partId, materialId: primaryMaterialId, revision: "A", quantityPerPart: 1.25, unit: "kg", scrapPercent: 2.5,
        notes: "DEMO raw material BOM; verify against released drawing.", createdAt: stamp, updatedAt: stamp },
      { id: bomConsumableId, componentId, partId, materialId: consumableMaterialId, revision: "A", quantityPerPart: 0.1, unit: "kg", scrapPercent: 0,
        notes: "DEMO process consumable BOM.", createdAt: stamp, updatedAt: stamp }
    );
    for (const [materialIndex, material] of [primaryMaterialId, consumableMaterialId].entries()) {
      const isPrimary = materialIndex === 0;
      materialCostEntries.push({
        id: id("MATERIAL-ALLOCATION", part.key + "-" + materialIndex), scope: "process-map", companyId: company.id, poId, poLineId: lineId,
        componentId, partId, partNumber: part.key, partName: part.name, materialId: material,
        materialName: isPrimary ? part.material : "Synthetic process consumable", materialGrade: isPrimary ? part.material : "Demo grade",
        densityKgM3: isPrimary ? primaryDensity : 900, shapeType: isPrimary ? shapeType : "other",
        dimensions: isPrimary ? dimensions : { length: 1, width: 1, thickness: 1 },
        dimensionUnits: isPrimary ? dimensionUnits : { length: "mm", width: "mm", thickness: "mm" },
        quantity: part.qty, weightPerPieceKg: isPrimary ? weightPerPieceKg : 0.01,
        totalWeightKg: isPrimary ? totalWeightKg : part.qty * 0.01, priceUnit: "kg",
        materialRate: isPrimary ? materialRate : 120, materialCost: isPrimary ? materialCost : part.qty * 1.2,
        cuttingType: isPrimary ? "Saw cutting" : "", cuttingBasis: "Per piece", cuttingRate: isPrimary ? 2 : 0,
        cutsPerPiece: 1, cuttingHours: 0.1, cuttingCost: isPrimary ? part.qty * 2 : 0, wastagePercent: isPrimary ? 2.5 : 0,
        vendorId: id("VENDOR", isPrimary ? "CNC" : "FAB"), givenDate: date(-1) + "T08:00", deliveryDate: date(1) + "T12:00",
        actualDeliveryDate: "", poReference: "DEMO-PO-" + (part.co === "ASTER" ? "001" : "002"),
        notes: "SYNTHETIC DEMO MATERIAL PROCUREMENT — do not use as a live quote or certificate.",
        currency: "INR", transportVendorId: id("VENDOR", "LOG"), transportFrom: company.address || "DEMO origin",
        transportTo: company.address || "DEMO destination", transportVehicleType: "Light commercial vehicle", transportCost: 0,
        transportPickupAt: date(1) + "T08:00", transportDeliveryAt: date(2) + "T12:00", transportStatus: "Planned",
        createdAt: stamp, updatedAt: stamp
      });
    }

    let previousId = "";
    const mainIds: string[] = [];
    part.steps.forEach((step, stepIndex) => {
      const definition = defs.get(step.category + "::" + step.name)!;
      const vendor = vendorByCode.get(step.vendor)!;
      const operationId = id("OPERATION", part.key + "-" + String(stepIndex + 1).padStart(2, "0"));
      const completed = stepIndex === 0 ? part.qty : stepIndex === 1 ? Math.max(1, Math.floor(part.qty * 0.4)) : 0;
      const accepted = stepIndex === 0 ? part.qty : stepIndex === 1 ? Math.floor(completed * 0.95) : 0;
      const status = stepIndex === 0 ? "Complete" : stepIndex === 1 ? "Running" : "Planned";
      operations.push({
        id: operationId, poId, poLineId: lineId, componentId, processDefinitionId: definition.id, sequence: stepIndex + 1,
        name: step.name, category: step.category, machine: step.machine, vendorId: vendor.id, status,
        plannedStart: date(stepIndex + 1), plannedEnd: date(stepIndex + 2), actualStart: stepIndex < 2 ? date() : "",
        actualEnd: stepIndex === 0 ? date() : "", quantity: part.qty, completed, accepted, rejected: completed - accepted,
        ratePerPart: step.planned, actualRatePerPart: step.actual, transportVendorId: "", transportPickup: "", transportDelivery: "",
        transportCost: 0, qualityNotes: step.inspect ? "DEMO sample inspection required." : "", inspectionResult: "Not assessed",
        notes: "DEMO ONLY — not actual shop-floor execution.", paymentStatus: stepIndex === 0 ? "Paid" : "Unpaid",
        paidAmount: stepIndex === 0 ? step.actual * part.qty : 0, paymentReference: stepIndex === 0 ? "DEMO-PAY-" + part.key : "",
        subcategory: step.sub, processSubcategoryId: definition.subcategoryIds?.[definition.subcategories.indexOf(step.sub)],
        executionType: vendor.id === vendors[0].id ? "Internal" : "Outsourced", toleranceCategory: step.tol,
        inspectionRequired: !!step.inspect, transportFrom: "", transportTo: "", transportVehicleType: "", transportRouteId: "",
        processColor: definition.displayColor, branch: "Main route", parentId: previousId, createdAt: stamp, updatedAt: stamp
      });
      mainIds.push(operationId);
      previousId = operationId;
      plannedCosts.push({
        id: id("PLANNED-COST", part.key + "-" + (stepIndex + 1)), companyId: company.id, poId, componentId,
        processDefinitionId: definition.id, processSubcategoryId: definition.subcategoryIds?.[definition.subcategories.indexOf(step.sub)],
        companyName: company.name, poNumber: po.number, componentName: part.name, componentNumber: part.key,
        processType: step.name, processCategory: step.category, processSubcategory: step.sub, plannedQty: part.qty,
        unit: "piece", plannedRate: step.planned, notes: "DEMO planned rate per piece.", createdAt: stamp, updatedAt: stamp
      });
      quotations.push({
        id: id("QUOTE", part.key + "-" + (stepIndex + 1)), poId, poLineId: lineId, componentId, operationId,
        vendorId: vendor.id, quoteReference: "DEMO-Q-" + part.key + "-" + (stepIndex + 1), quotedAt: date(),
        validUntil: date(30), quantity: part.qty, ratePerPart: step.planned, transportCost: 75, leadDays: 5,
        status: quoteStatuses[(partIndex + stepIndex) % quoteStatuses.length], notes: "DEMO quote; not a supplier offer.",
        createdAt: stamp, updatedAt: stamp
      });
      if (stepIndex === 0) {
        paymentTransactions.push({
          id: id("PAYMENT", part.key), operationId, poId, poLineId: lineId, componentId,
          amount: step.actual * part.qty, paidAt: date(), reference: "DEMO-UTR-" + part.key,
          notes: "DEMO payment; no money transferred.", createdAt: stamp, updatedAt: stamp
        });
      }
      if (step.inspect) {
        inspectionMeasurements.push({
          id: id("MEASUREMENT", part.key), operationId, poId, poLineId: lineId, componentId,
          characteristic: "Sample bore / profile dimension", nominalValue: 10, lowerLimit: 9.95, upperLimit: 10.05,
          measuredValue: partIndex % 3 === 1 ? 10.2 : 10.01, unit: "mm",
          result: (["Pass", "Fail", "Not assessed"] as const)[partIndex % 3],
          notes: "Synthetic demo reading; not a certificate.", inspectedAt: date(), createdAt: stamp, updatedAt: stamp
        });
      }
    });
    mainOperationIdsByPart.set(part.key, mainIds);

    const alternateStep = part.steps[Math.max(0, part.steps.length - 2)];
    const alternateDefinition = defs.get(alternateStep.category + "::" + alternateStep.name)!;
    const reworkStep = part.steps[part.steps.length - 1];
    const reworkDefinition = defs.get(reworkStep.category + "::" + reworkStep.name)!;
    const addBranch = (branch: "Alternate route" | "Rework route", definition: ProcessDefinitionRecord, vendorCode: string, suffix: string, status: "Planned" | "Quality hold", sequence: number) => {
      const branchVendor = vendorByCode.get(vendorCode)!;
      operations.push({
        id: id("OPERATION", part.key + "-" + suffix), poId, poLineId: lineId, componentId, processDefinitionId: definition.id,
        sequence, name: branch === "Alternate route" ? "Alternate supplier / process route" : "Rework operation",
        category: definition.category, machine: branch === "Alternate route" ? "Alternate process resource" : "Rework workstation",
        vendorId: branchVendor.id, status, plannedStart: date(10), plannedEnd: date(11), actualStart: "", actualEnd: "",
        quantity: part.qty, completed: 0, accepted: 0, rejected: 0, ratePerPart: branch === "Alternate route" ? 430 : 55,
        actualRatePerPart: 0, transportVendorId: "", transportPickup: "", transportDelivery: "", transportCost: 0,
        qualityNotes: branch === "Rework route" ? "DEMO rework / quality-hold branch." : "DEMO alternate branch.",
        inspectionResult: "Not assessed", notes: "SYNTHETIC DEMO branch; not an actual shop-floor event.",
        paymentStatus: "Unpaid", paidAmount: 0, paymentReference: "", subcategory: definition.subcategories[0],
        processSubcategoryId: definition.subcategoryIds?.[0], executionType: "Outsourced", toleranceCategory: part.tol,
        inspectionRequired: branch === "Rework route", transportFrom: "", transportTo: "", transportVehicleType: "",
        transportRouteId: "", processColor: definition.displayColor, branch,
        parentId: branch === "Alternate route" ? mainIds[Math.max(0, mainIds.length - 2)] : mainIds[mainIds.length - 1],
        relationType: branch === "Alternate route" ? "alternate" : "rework", costIncluded: false, createdAt: stamp, updatedAt: stamp
      });
    };
    addBranch("Alternate route", alternateDefinition, "GRIND", "ALT-01", "Planned", part.steps.length + 1);
    addBranch("Rework route", reworkDefinition, "QA", "REWORK-01", "Quality hold", part.steps.length + 2);

    const partOperations = operations.filter(row => row.poLineId === lineId);
    relationshipTypes.forEach((relationshipType, relationIndex) => {
      const from = partOperations[relationIndex % partOperations.length];
      const to = partOperations[(relationIndex + 1) % partOperations.length];
      routeRelationships.push({
        id: id("RELATIONSHIP", part.key + "-" + relationshipType), poId, poLineId: lineId, componentId,
        fromOperationId: from.id, toOperationId: to.id, relationshipType,
        status: (["Active", "Planned", "Conditional", "Disabled"] as const)[relationIndex % 4],
        condition: relationshipType === "conditional" ? "Only when the linked inspection condition is true." : undefined,
        label: relationshipType + " route", notes: "SYNTHETIC DEMO route relationship.", createdAt: stamp, updatedAt: stamp
      });
    });

    const primaryBom = bomPrimaryId, consumableBom = bomConsumableId;
    const links = [
      ["Material input", "before", primaryBom, primaryMaterialId, mainIds[0]],
      ["Consumable", "before", consumableBom, consumableMaterialId, mainIds[Math.min(1, mainIds.length - 1)]],
      ["WIP transfer", "after", primaryBom, primaryMaterialId, mainIds[Math.min(2, mainIds.length - 1)]],
      ["Output", "after", consumableBom, consumableMaterialId, mainIds[mainIds.length - 1]]
    ] as const;
    links.forEach(([flowType, placement, bomLineId, materialId, operationId]) => materialProcessLinks.push({
      id: id("MATERIAL-PROCESS-LINK", part.key + "-" + flowType), companyId: company.id, poId, poLineId: lineId,
      componentId, bomLineId, materialId, operationId, quantityPerPart: 1, unit: "kg", flowType, placement,
      notes: "SYNTHETIC DEMO material-to-operation link; verify against released BOM.",
      createdAt: stamp, updatedAt: stamp
    }));
  }

  inventoryTypes.forEach((transactionType, index) => {
    const part = parts[index % parts.length];
    const link = lineByPart.get(part.key)!;
    const inDirection = ["Opening balance", "Receipt", "Return", "Finished goods receipt"].includes(transactionType);
    inventoryTransactions.push({
      id: id("STOCK", "DEMO-" + transactionType), itemType: transactionType === "Dispatch" ? "component" : "material",
      itemId: id("MATERIAL", part.key + "-PRIMARY"), transactionType, direction: inDirection ? "in" : "out",
      quantity: Math.max(1, Math.round(part.qty * 0.1)), occurredAt: date(), reference: "DEMO-STOCK-" + transactionType,
      notes: "SYNTHETIC DEMO inventory transaction.", companyId: link.companyId, factoryId: link.factoryId,
      poId: link.poId, poLineId: link.poLineId, operationId: id("OPERATION", part.key + "-01"),
      vendorId: id("VENDOR", "CNC"), reversalOfId: "", createdAt: stamp, createdBy: "AXIMACH DEMO", updatedAt: stamp
    });
  });

  const transportRoutes: ManufacturingData["transportRoutes"] = VEHICLE_TYPES.map((vehicleType, index) => ({
    id: id("ROUTE", "DEMO-" + vehicleType), vendorId: id("VENDOR", "LOG"),
    fromLocation: "Bengaluru DEMO", toLocation: "Coimbatore DEMO",
    tripDirection: index % 2 ? "Two-way" : "One-way", vehicleType, fixedAmount: 4500 + index * 250,
    currency: "INR", active: true, notes: "SYNTHETIC DEMO transport master route; no booking exists.",
    createdAt: stamp, updatedAt: stamp
  }));
  const transportLegs: ManufacturingData["transportLegs"] = VEHICLE_TYPES.map((vehicleType, index) => {
    const part = parts[index % parts.length];
    const link = lineByPart.get(part.key)!;
    const mainIds = mainOperationIdsByPart.get(part.key)!;
    const targetIndex = Math.min(1 + (index % Math.max(1, mainIds.length - 1)), mainIds.length - 1);
    const directoryRoute = transportRoutes[index];
    return {
      id: id("TRANSPORT-LEG", "DEMO-" + vehicleType), poId: link.poId, poLineId: link.poLineId, componentId: link.componentId,
      sequence: index + 1, routeId: directoryRoute.id, vendorId: directoryRoute.vendorId,
      fromLocation: directoryRoute.fromLocation, toLocation: directoryRoute.toLocation,
      tripDirection: directoryRoute.tripDirection, vehicleType, fixedAmount: directoryRoute.fixedAmount, tripCount: 1 + index % 3,
      anchorOperationId: mainIds[Math.max(0, targetIndex - 1)], targetOperationId: mainIds[targetIndex],
      placement: index % 2 ? "before" : "after", pickupAt: date(12) + "T08:00", deliveryAt: date(13) + "T12:00",
      status: "Planned", completedTrips: 0, notes: "SYNTHETIC DEMO transport leg; no booking exists.",
      createdAt: stamp, updatedAt: stamp
    };
  });

  const contactProfiles: ManufacturingData["contactProfiles"] = [
    ...companies.map(c => ({
      id: id("CONTACT", c.id), linkedType: "company" as const, linkedId: c.id, name: c.contactPerson || "Demo contact",
      role: "Demo purchasing contact", group: "DEMO", phone: "", whatsapp: "", additionalPhones: [],
      email: c.email, address: c.address || "", followUpDate: date(3), history: "Synthetic DEMO contact.",
      processCategories: [], processTypes: [], processSubcategories: [], processDefinitionIds: [], processSubcategoryIds: [],
      machineCapabilities: [], materialCapabilities: [], createdAt: stamp, updatedAt: stamp
    })),
    ...vendors.map(v => ({
      id: id("CONTACT", v.id), linkedType: "vendor" as const, linkedId: v.id, name: v.contact,
      role: "Demo vendor contact", group: "DEMO", phone: "", whatsapp: "", additionalPhones: [],
      email: v.email, address: v.address, followUpDate: date(4), history: "Synthetic DEMO vendor contact; do not contact.",
      processCategories: [], processTypes: [], processSubcategories: [], processDefinitionIds: [], processSubcategoryIds: [],
      machineCapabilities: [], materialCapabilities: [], createdAt: stamp, updatedAt: stamp
    }))
  ];
  const followUpAssignments: ManufacturingData["followUpAssignments"] = vendors.map(v => ({
    id: id("FOLLOW-UP", v.id), moduleId: "vendors", recordId: v.id, recordLabel: v.company,
    contactId: id("CONTACT", v.id), contactName: v.contact, contactPhone: "", contactEmail: v.email, createdAt: stamp, updatedAt: stamp
  }));

  return {
    updatedAt: stamp, companies, factories, purchaseOrders, components, vendors, operations, quotations, materials,
    componentParts, materialCostEntries, bomLines, materialProcessLinks, inventoryTransactions, contactProfiles,
    processDefinitions, plannedCosts, transportRoutes, transportLegs, paymentTransactions, inspectionMeasurements,
    routeRelationships, followUpAssignments
  };
}

export function archiveAxMachTwoCompanyDemo(current:ManufacturingData,stamp=new Date().toISOString()):ManufacturingData{
 const archive=<T extends {id:string;updatedAt?:string;deletedAt?:string}>(rows:T[]):T[]=>rows.map(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)?{...row,deletedAt:stamp,updatedAt:stamp}:row);
 return {...current,updatedAt:stamp,companies:archive(current.companies),factories:archive(current.factories),
  purchaseOrders:current.purchaseOrders.map(po=>({...po,...(po.id.startsWith(AXIMACH_DEMO_ID_PREFIX)?{deletedAt:stamp,updatedAt:stamp}:{}),lines:po.lines.map(line=>line.id.startsWith(AXIMACH_DEMO_ID_PREFIX)?{...line,deletedAt:stamp,updatedAt:stamp}:line)})),
  components:archive(current.components),vendors:archive(current.vendors),operations:archive(current.operations),
  quotations:archive(current.quotations),materials:archive(current.materials),componentParts:archive(current.componentParts),materialCostEntries:archive(current.materialCostEntries),bomLines:archive(current.bomLines),
  inventoryTransactions:archive(current.inventoryTransactions),contactProfiles:archive(current.contactProfiles),
  processDefinitions:archive(current.processDefinitions),plannedCosts:archive(current.plannedCosts),
  transportRoutes:archive(current.transportRoutes),transportLegs:archive(current.transportLegs),
  paymentTransactions:archive(current.paymentTransactions),inspectionMeasurements:archive(current.inspectionMeasurements),materialProcessLinks:archive(current.materialProcessLinks||[]),routeRelationships:archive(current.routeRelationships||[]),
  followUpAssignments:archive(current.followUpAssignments)};
}
