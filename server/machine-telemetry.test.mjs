import test from "node:test";
import assert from "node:assert/strict";
import { validateMachineProfile } from "./machine-telemetry.mjs";

test("validates an OPC UA telemetry profile without storing credentials in its URL", () => {
  const profile = validateMachineProfile({
    protocol: "OPC UA", name: "VMC-01", endpoint: "opc.tcp://192.168.1.40:4840",
    signals: [{ key: "spindleSpeed", nodeId: "ns=2;s=Machine.SpindleSpeed" }]
  });
  assert.equal(profile.readOnly, true);
  assert.equal(profile.signals[0].nodeId, "ns=2;s=Machine.SpindleSpeed");
});

test("validates read-only Modbus registers and normalises the unit ID", () => {
  const profile = validateMachineProfile({
    protocol: "Modbus TCP", name: "Lathe-01", endpoint: "192.168.1.41:502", unitId: 3,
    signals: [{ key: "rpm", address: 0, functionCode: 4, dataType: "uint16", scale: 0.1 }]
  });
  assert.equal(profile.endpoint, "192.168.1.41:502");
  assert.equal(profile.unitId, 3);
  assert.equal(profile.signals[0].functionCode, 4);
});

test("validates MTConnect and REST gateway signal identifiers", () => {
  const mtconnect = validateMachineProfile({
    protocol: "MTConnect", name: "VMC-02", endpoint: "http://192.168.1.42:5000/current",
    signals: [{ key: "execution", dataItemId: "execution" }]
  });
  const rest = validateMachineProfile({
    protocol: "REST gateway", name: "Cell-01", endpoint: "https://192.168.1.43:8443/telemetry",
    signals: [{ key: "state", jsonPointer: "/machine/state" }]
  });
  assert.equal(mtconnect.signals[0].dataItemId, "execution");
  assert.equal(rest.signals[0].jsonPointer, "/machine/state");
});

test("rejects controller write function codes", () => {
  assert.throws(() => validateMachineProfile({
    protocol: "Modbus TCP", name: "VMC-03", endpoint: "tcp://192.168.1.44:502",
    signals: [{ key: "writeAttempt", address: 0, functionCode: 6, dataType: "uint16" }]
  }), /read-only function codes 3 and 4 only/);
});

test("rejects credentials embedded in machine endpoint URLs", () => {
  assert.throws(() => validateMachineProfile({
    protocol: "REST gateway", name: "Machine", endpoint: "https://user:password@192.168.1.45/telemetry",
    signals: [{ key: "state", jsonPointer: "/state" }]
  }), /Credentials must be stored in the local gateway secrets file/);
});

test("rejects invalid protocols, malformed signal maps and duplicate keys", () => {
  assert.throws(() => validateMachineProfile({ protocol: "SSH", name: "Machine", endpoint: "tcp://192.168.1.46:22", signals: [{ key: "state" }] }), /Choose OPC UA/);
  assert.throws(() => validateMachineProfile({ protocol: "OPC UA", name: "Machine", endpoint: "opc.tcp://192.168.1.46:4840", signals: [] }), /between 1 and 64/);
  assert.throws(() => validateMachineProfile({
    protocol: "MTConnect", name: "Machine", endpoint: "http://192.168.1.46/current",
    signals: [{ key: "state", dataItemId: "a" }, { key: "state", dataItemId: "b" }]
  }), /Signal keys must be unique/);
});
