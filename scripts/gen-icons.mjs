import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true });

const bag = (scale, rot) => `
  <g transform="translate(256,272) scale(${scale}) rotate(${rot})">
    <path d="M -110 -125 L 110 -125 L 135 140 L -135 140 Z" fill="#e8c78a"/>
    <path d="M -110 -125 L 110 -125 L 118 -62 L -118 -62 Z" fill="#d9b06e"/>
    <path d="M -46 -125 Q -46 -188 0 -188 Q 46 -188 46 -125" fill="none" stroke="#8a6a3a" stroke-width="14"/>
  </g>`;

const full = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e1524"/>
  ${bag(1, -18)}
</svg>`;

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0e1524"/>
  ${bag(0.68, -14)}
</svg>`;

writeFileSync(new URL('./icon-full.svg', import.meta.url), full);
writeFileSync(new URL('./icon-maskable.svg', import.meta.url), maskable);

const outDir = new URL('../public/icons/', import.meta.url);
const p = (name) => fileURLToPath(new URL(name, outDir));

await sharp(Buffer.from(full)).resize(192, 192).png().toFile(p('icon-192.png'));
await sharp(Buffer.from(full)).resize(512, 512).png().toFile(p('icon-512.png'));
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(p('icon-maskable-512.png'));
await sharp(Buffer.from(full)).resize(32, 32).png().toFile(p('../favicon-32.png'));

console.log('icons generated');
