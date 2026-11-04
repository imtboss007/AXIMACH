export const manufacturingCollections = Object.freeze([
  "companies",
  "factories",
  "purchaseOrders",
  "components",
  "vendors",
  "operations",
  "quotations",
  "materials",
  "bomLines",
  "inventoryTransactions",
  "contactProfiles",
  "processDefinitions",
  "plannedCosts",
  "paymentTransactions",
  "inspectionMeasurements",
  "followUpAssignments"
]);

function mergeRows(existingRows, incomingRows) {
  const rows = new Map();
  for (const row of Array.isArray(existingRows) ? existingRows : []) {
    if (row?.id) rows.set(row.id, row);
  }
  for (const row of Array.isArray(incomingRows) ? incomingRows : []) {
    if (!row?.id) continue;
    const current = rows.get(row.id);
    const currentTime = Date.parse(current?.updatedAt || "") || 0;
    const incomingTime = Date.parse(row.updatedAt || "") || 0;
    if (!current || incomingTime >= currentTime) rows.set(row.id, row);
  }
  return [...rows.values()];
}

export function mergePurchaseOrders(existingRows, incomingRows) {
  const left = new Map((Array.isArray(existingRows) ? existingRows : []).filter(row => row?.id).map(row => [row.id, row]));
  const right = new Map((Array.isArray(incomingRows) ? incomingRows : []).filter(row => row?.id).map(row => [row.id, row]));
  const merged = [];
  for (const id of new Set([...left.keys(), ...right.keys()])) {
    const old = left.get(id);
    const incoming = right.get(id);
    if (!old) { merged.push(incoming); continue; }
    if (!incoming) { merged.push(old); continue; }
    const oldTime = Date.parse(old.updatedAt || "") || 0;
    const incomingTime = Date.parse(incoming.updatedAt || "") || 0;
    const preferred = incomingTime >= oldTime ? incoming : old;
    const lines = new Map();
    for (const [po, parentTime] of [[old, oldTime], [incoming, incomingTime]]) {
      for (const line of Array.isArray(po.lines) ? po.lines : []) {
        if (!line?.id) continue;
        const time = Date.parse(line.updatedAt || "") || parentTime;
        const prior = lines.get(line.id);
        if (!prior || time >= prior.time) lines.set(line.id, { line, time });
      }
    }
    merged.push({ ...preferred, lines: [...lines.values()].map(item => item.line) });
  }
  return merged;
}

export function mergeManufacturingData(existing, incoming) {
  const left = existing && typeof existing === "object" ? existing : {};
  const right = incoming && typeof incoming === "object" ? incoming : {};
  const merged = {};
  for (const collection of manufacturingCollections) {
    merged[collection] = collection === "purchaseOrders"
      ? mergePurchaseOrders(left[collection], right[collection])
      : mergeRows(left[collection], right[collection]);
  }
  merged.updatedAt = [left.updatedAt, right.updatedAt].filter(Boolean).sort().at(-1) || new Date().toISOString();
  return merged;
}
