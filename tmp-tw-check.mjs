import { compile, Polyfills } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { readFileSync } from "fs";
import path from "path";

const i = path.resolve("app/globals.css");
const l = readFileSync(i, "utf8");
const S = path.dirname(i);
const o = process.cwd();
const m = await compile(l, {
  from: i,
  base: S,
  shouldRewriteUrls: true,
  onDependency(p) {},
  polyfills: Polyfills.All,
});
console.log("root", m.root);
console.log("sources", m.sources);
const scanSources = (m.root === "none"
  ? []
  : m.root === null
    ? [{ base: o, pattern: "**/*", negated: false }]
    : [{ ...m.root, negated: false }]
).concat(m.sources);
console.log("scanSources", scanSources);
const scanner = new Scanner({ sources: scanSources });
const candidates = scanner.scan();
console.log("candidate count", candidates.length);
console.log("has bg-clay candidate", candidates.includes("bg-clay"));
const built = m.build(candidates);
console.log("built length", built.length);
console.log("built has b54a25", built.includes("b54a25"));
console.log("built has bg-clay", built.includes(".bg-clay"));
console.log("built has font-brand", built.includes(".font-brand"));
const idx = built.indexOf("clay");
console.log("clay snippet", idx >= 0 ? built.slice(idx - 40, idx + 80) : "NONE");
