export const manufacturingCollections = Object.freeze([
  "companies",
  "factories",
  "purchaseOrders",
  "components",
  "vendors",
  "operations",
  "quotations",
  "materials",
  "componentParts",
  "materialCostEntries",
  "bomLines",
  "materialProcessLinks",
  "inventoryTransactions",
  "contactProfiles",
  "processDefinitions",
  "plannedCosts",
  "paymentTransactions",
  "inspectionMeasurements",
  "routeRelationships",
  "followUpAssignments",
  "transportRoutes",
  "transportLegs"
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


function sameValue(a, b) { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }
function byId(rows) { return new Map((Array.isArray(rows) ? rows : []).filter(row => row?.id).map(row => [row.id, row])); }

/**
 * Three-way merge: a row changed on both the server and device since the
 * device's last acknowledged snapshot is withheld from the normal merge and
 * returned as a recoverable conflict. Independent rows still merge normally.
 */
export function mergeManufacturingDataWithConflicts(existing, incoming, baseline) {
  const current = existing && typeof existing === "object" ? existing : {};
  const device = incoming && typeof incoming === "object" ? incoming : {};
  const base = baseline && typeof baseline === "object" ? baseline : {};
  const safeIncoming = { ...device };
  const conflicts = [];

  for (const collection of manufacturingCollections) {
    const baseRows = byId(base[collection]);
    const remoteRows = byId(current[collection]);
    const localRows = byId(device[collection]);
    const blocked = new Set();

    for (const [id, localRow] of localRows) {
      const baseRow = baseRows.get(id);
      const remoteRow = remoteRows.get(id);
      if (!baseRow || !remoteRow) continue;
      if (collection === "purchaseOrders") {
        const stripLines = row => { const copy = { ...row }; delete copy.lines; return copy; };
        if (!sameValue(stripLines(baseRow), stripLines(remoteRow))
          && !sameValue(stripLines(baseRow), stripLines(localRow))
          && !sameValue(stripLines(remoteRow), stripLines(localRow))) {
          blocked.add(id);
          conflicts.push({ collection, recordId: id, base: baseRow, remote: remoteRow, local: localRow });
        }
        const baseLines = byId(baseRow.lines), remoteLines = byId(remoteRow.lines), localLines = byId(localRow.lines);
        const safeLines = [];
        for (const [lineId, localLine] of localLines) {
          const baseLine = baseLines.get(lineId), remoteLine = remoteLines.get(lineId);
          if (baseLine && remoteLine && !sameValue(baseLine, remoteLine)
            && !sameValue(baseLine, localLine) && !sameValue(remoteLine, localLine)) {
            conflicts.push({ collection, recordId: id, lineId, base: baseLine, remote: remoteLine, local: localLine });
          } else safeLines.push(localLine);
        }
        const conflictingLineIds = new Set(conflicts.filter(item => item.collection === collection && item.recordId === id && item.lineId).map(item => item.lineId));
        safeIncoming[collection] = (safeIncoming[collection] || []).map(row => row.id !== id ? row : {
          ...row, lines: (row.lines || []).filter(line => !conflictingLineIds.has(line.id))
        });
      } else if (!sameValue(baseRow, remoteRow) && !sameValue(baseRow, localRow) && !sameValue(remoteRow, localRow)) {
        blocked.add(id);
        conflicts.push({ collection, recordId: id, base: baseRow, remote: remoteRow, local: localRow });
      }
    }
    if (blocked.size) safeIncoming[collection] = (safeIncoming[collection] || []).filter(row => !blocked.has(row.id));
  }

  return {
    data: mergeManufacturingData(current, safeIncoming),
    conflicts
  };
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
