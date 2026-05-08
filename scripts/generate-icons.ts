/**
 * Generates PNG variants from `public/icons/icon.svg` for PWA install
 * surfaces (Android Chrome, iOS Safari home-screen) and browser tabs.
 *
 * Run with `npm run gen:icons` — idempotent, just overwrites the
 * outputs whenever the SVG changes.
 *
 * Outputs:
 *   /icons/icon-192.png            — Android home-screen
 *   /icons/icon-512.png            — Android splash, larger contexts
 *   /icons/icon-maskable-512.png   — Android adaptive icon
 *                                    (current SVG content sits within
 *                                    safe zone — ~70% of canvas — so
 *                                    we reuse it as maskable directly)
 *   /apple-touch-icon.png          — iOS home-screen, 180×180
 *   /favicon-32.png, /favicon-16.png — browser tabs
 *
 * Sharp comes bundled with Next.js for image optimisation, so no
 * extra dependency.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// Script runs from project root via npm — `process.cwd()` resolves
// there. Avoid `import.meta.dirname` which depends on tsx's ESM mode.
const ROOT = process.cwd();
const SVG_PATH = resolve(ROOT, "public/icons/icon.svg");

type Target = {
  out: string;
  size: number;
};

const TARGETS: Target[] = [
  { out: "public/icons/icon-192.png", size: 192 },
  { out: "public/icons/icon-512.png", size: 512 },
  { out: "public/icons/icon-maskable-512.png", size: 512 },
  { out: "public/apple-touch-icon.png", size: 180 },
  { out: "public/favicon-32.png", size: 32 },
  { out: "public/favicon-16.png", size: 16 },
];

async function main() {
  const svg = await readFile(SVG_PATH);
  for (const t of TARGETS) {
    const buf = await sharp(svg, { density: 384 })
      .resize(t.size, t.size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(resolve(ROOT, t.out), buf);
    console.log(`✓ ${t.out} (${t.size}×${t.size})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
