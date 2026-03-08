#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const GUARDED_FILES = [
  "src/app/(app)/dashboard/page.tsx",
  "src/app/(app)/boards/page.tsx",
  "src/app/(app)/activity/page.tsx",
  "src/components/templates/DashboardShell.tsx",
  "src/components/organisms/OrgSwitcher.tsx",
  "src/components/organisms/DashboardSidebar.tsx",
  "src/lib/use-organization-membership.ts",
];

const ANTI_PATTERN = /refetchOnMount\s*:\s*["']always["']/;

async function run() {
  const violations = [];

  for (const relativePath of GUARDED_FILES) {
    const absolutePath = path.join(ROOT, relativePath);
    const source = await fs.readFile(absolutePath, "utf8");
    if (ANTI_PATTERN.test(source)) {
      violations.push(relativePath);
    }
  }

  if (violations.length > 0) {
    console.error("Query policy guard failed.");
    for (const file of violations) {
      console.error(`- refetchOnMount: \"always\" found in ${file}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Query policy guard passed.");
}

run().catch((error) => {
  console.error("Query policy guard failed unexpectedly.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
