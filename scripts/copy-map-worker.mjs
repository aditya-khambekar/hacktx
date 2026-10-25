import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
await mkdir(join(root, "public"), { recursive: true });
await copyFile(join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"), join(root, "public/maplibre-gl-worker.mjs"));
