import { build } from "esbuild";
import { readdirSync } from "fs";
import { join } from "path";

const srcDir = "macros/src";
const outDir = "macros";

const entryPoints = readdirSync(srcDir)
    .filter(f => f.endsWith(".js"))
    .map(f => join(srcDir, f));

await build({
    entryPoints,
    outdir: outDir,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    banner: {
        js: "// Auto-generated — do not edit. Source: macros/src/",
    },
});

console.log(`Built ${entryPoints.length} macro(s) → ${outDir}/`);
