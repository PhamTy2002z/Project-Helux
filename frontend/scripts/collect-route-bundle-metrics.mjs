#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, ".next");
const SERVER_APP_DIR = path.join(NEXT_DIR, "server", "app");
const BUILD_MANIFEST_PATH = path.join(NEXT_DIR, "build-manifest.json");
const OUTPUT_DIR = path.join(ROOT, "plans", "performance");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "route-bundle-metrics.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "route-bundle-metrics.md");

const asKb = (bytes) => Number((bytes / 1024).toFixed(1));

const normalizeChunkPath = (chunkPath) =>
  chunkPath.replace(/^\/_next\//, "").replace(/^\//, "");

async function statSize(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function routeFromManifestKey(manifestKey) {
  const withoutPage = manifestKey.endsWith("/page")
    ? manifestKey.slice(0, -5)
    : manifestKey;
  const withoutGroups = withoutPage.replace(/\/\([^/]+\)/g, "");
  if (!withoutGroups || withoutGroups === "/") {
    return "/";
  }
  return withoutGroups;
}

function pickRouteEntryKey(entryJsFiles) {
  const candidates = Object.keys(entryJsFiles).filter(
    (key) =>
      key.includes("/src/app/") &&
      key.endsWith("/page") &&
      !key.includes("/src/app/layout") &&
      !key.includes("global-error"),
  );

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.length - left.length);
  return candidates[0];
}

async function parseRscManifest(filePath) {
  const code = await fs.readFile(filePath, "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(code, context);
  return context.globalThis.__RSC_MANIFEST ?? {};
}

async function findClientReferenceManifests(directory) {
  const items = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    items.map(async (item) => {
      const itemPath = path.join(directory, item.name);
      if (item.isDirectory()) {
        return findClientReferenceManifests(itemPath);
      }
      if (item.name === "page_client-reference-manifest.js") {
        return [itemPath];
      }
      return [];
    }),
  );
  return nested.flat();
}

async function collectMetrics() {
  await fs.access(BUILD_MANIFEST_PATH);
  await fs.access(SERVER_APP_DIR);

  const buildManifest = await readJson(BUILD_MANIFEST_PATH);
  const rootMainFiles = Array.from(new Set(buildManifest.rootMainFiles ?? []));

  const rootMainChunkSizes = await Promise.all(
    rootMainFiles.map(async (chunkPath) => {
      const size = await statSize(
        path.join(NEXT_DIR, normalizeChunkPath(chunkPath)),
      );
      return { chunkPath, bytes: size, kb: asKb(size) };
    }),
  );

  const rootMainBytes = rootMainChunkSizes.reduce(
    (sum, chunk) => sum + chunk.bytes,
    0,
  );

  const manifestFiles = await findClientReferenceManifests(SERVER_APP_DIR);
  const routesByPath = new Map();

  for (const manifestFile of manifestFiles) {
    const routeManifest = await parseRscManifest(manifestFile);
    for (const [manifestKey, routeData] of Object.entries(routeManifest)) {
      const routePath = routeFromManifestKey(manifestKey);
      const entryJsFiles = routeData?.entryJSFiles ?? {};
      const routeEntryKey = pickRouteEntryKey(entryJsFiles);
      if (!routeEntryKey) continue;

      const routeChunks = Array.from(new Set(entryJsFiles[routeEntryKey] ?? []));
      const routeChunkSizes = await Promise.all(
        routeChunks.map(async (chunkPath) => {
          const size = await statSize(
            path.join(NEXT_DIR, normalizeChunkPath(chunkPath)),
          );
          return { chunkPath, bytes: size, kb: asKb(size) };
        }),
      );

      const routeEntryJsBytes = routeChunkSizes.reduce(
        (sum, chunk) => sum + chunk.bytes,
        0,
      );

      const totalInitialChunks = Array.from(
        new Set([...rootMainFiles, ...routeChunks]),
      );
      const totalInitialBytes = (
        await Promise.all(
          totalInitialChunks.map((chunkPath) =>
            statSize(path.join(NEXT_DIR, normalizeChunkPath(chunkPath))),
          ),
        )
      ).reduce((sum, value) => sum + value, 0);

      const existing = routesByPath.get(routePath);
      if (!existing || totalInitialBytes > existing.totalInitialJsBytes) {
        routesByPath.set(routePath, {
          route: routePath,
          entryKey: routeEntryKey,
          entryJsFiles: routeChunks,
          entryJsBytes: routeEntryJsBytes,
          entryJsKb: asKb(routeEntryJsBytes),
          sharedRootMainBytes: rootMainBytes,
          sharedRootMainKb: asKb(rootMainBytes),
          totalInitialJsBytes: totalInitialBytes,
          totalInitialJsKb: asKb(totalInitialBytes),
          chunkCount: totalInitialChunks.length,
        });
      }
    }
  }

  const routes = Array.from(routesByPath.values()).sort(
    (left, right) => right.totalInitialJsBytes - left.totalInitialJsBytes,
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    rootMain: {
      chunkCount: rootMainFiles.length,
      bytes: rootMainBytes,
      kb: asKb(rootMainBytes),
      chunks: rootMainChunkSizes,
    },
    routeCount: routes.length,
    routes,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const topRoutes = routes.slice(0, 20);
  const lines = [
    "# Route Bundle Metrics",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    `Shared root main JS: **${payload.rootMain.kb} KB** (${payload.rootMain.chunkCount} chunks)`,
    "",
    "| Route | Entry JS (KB) | Total Initial JS (KB) | Chunks |",
    "| --- | ---: | ---: | ---: |",
    ...topRoutes.map(
      (route) =>
        `| ${route.route} | ${route.entryJsKb} | ${route.totalInitialJsKb} | ${route.chunkCount} |`,
    ),
    "",
  ];

  await fs.writeFile(OUTPUT_MD, `${lines.join("\n")}\n`, "utf8");

  console.log(`Saved metrics JSON: ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`Saved metrics Markdown: ${path.relative(ROOT, OUTPUT_MD)}`);
  console.log(`Shared root main JS: ${payload.rootMain.kb} KB`);
}

collectMetrics().catch((error) => {
  console.error("Failed to collect route bundle metrics.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
