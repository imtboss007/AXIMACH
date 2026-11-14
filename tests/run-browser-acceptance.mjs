import { spawnSync } from "node:child_process";

const suites = [
  ["mobile/module browser acceptance", "tests/aximach-browser-acceptance.mjs"],
  ["isolated CRUD and persistence acceptance", "tests/aximach-crud-acceptance.mjs"]
];

const results = [];
for (const [label, script] of suites) {
  console.log("\n=== Running " + label + " ===");
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env
  });
  const status = result.error ? 1 : (result.status ?? 1);
  results.push({ label, status });
  console.log("=== " + label + ": " + (status === 0 ? "PASS" : "FAIL (" + status + ")") + " ===");
}

const failed = results.filter(result => result.status !== 0);
if (failed.length) {
  console.error("\nBrowser acceptance failures: " + failed.map(result => result.label).join(", "));
  process.exitCode = 1;
} else {
  console.log("\nAll browser and CRUD acceptance suites passed.");
}
