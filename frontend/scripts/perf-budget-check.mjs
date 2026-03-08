#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const COLLECT_SCRIPT = path.join(ROOT, "scripts", "collect-route-bundle-metrics.mjs");
const METRICS_PATH = path.join(
  ROOT,
  "plans",
  "performance",
  "route-bundle-metrics.json",
);

const BUDGETS = {
  sharedRootMainKb: 430,
  routes: {
    "/": 1000,
    "/dashboard": 1250,
    "/boards": 1150,
    "/activity": 1250,
  },
};

function formatDiff(actual, budget) {
  const delta = Number((actual - budget).toFixed(1));
  return delta > 0 ? `+${delta}` : `${delta}`;
}

async function readMetrics() {
  const run = spawnSync("node", [COLLECT_SCRIPT], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (run.status !== 0) {
    throw new Error("Unable to generate performance metrics before budget check.");
  }
  const raw = await fs.readFile(METRICS_PATH, "utf8");
  return JSON.parse(raw);
}

async function checkBudgets() {
  const metrics = await readMetrics();
  const failures = [];

  const rootMainKb = Number(metrics?.rootMain?.kb ?? 0);
  if (rootMainKb > BUDGETS.sharedRootMainKb) {
    failures.push(
      `Shared root main JS ${rootMainKb} KB exceeds ${BUDGETS.sharedRootMainKb} KB (${formatDiff(rootMainKb, BUDGETS.sharedRootMainKb)} KB).`,
    );
  }

  const routes = Array.isArray(metrics?.routes) ? metrics.routes : [];
  for (const [routePath, maxKb] of Object.entries(BUDGETS.routes)) {
    const route = routes.find((entry) => entry.route === routePath);
    if (!route) {
      failures.push(`Missing route metrics for ${routePath}.`);
      continue;
    }
    const totalInitialJsKb = Number(route.totalInitialJsKb ?? 0);
    if (totalInitialJsKb > maxKb) {
      failures.push(
        `${routePath} initial JS ${totalInitialJsKb} KB exceeds ${maxKb} KB (${formatDiff(totalInitialJsKb, maxKb)} KB).`,
      );
    }
  }

  console.log("Performance budget summary");
  console.log(`- shared root main: ${rootMainKb} KB / ${BUDGETS.sharedRootMainKb} KB`);
  for (const [routePath, maxKb] of Object.entries(BUDGETS.routes)) {
    const route = routes.find((entry) => entry.route === routePath);
    const value = route ? route.totalInitialJsKb : "missing";
    console.log(`- ${routePath}: ${value} KB / ${maxKb} KB`);
  }

  if (failures.length > 0) {
    console.error("\nBudget check failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log("\nAll performance budgets passed.");
}

checkBudgets().catch((error) => {
  console.error("Performance budget check failed unexpectedly.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
