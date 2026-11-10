import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { categoryImages, commonsPhotos, productImages } from './image-sources.mjs';

const root = process.cwd();
const base = path.join(root, 'public');
const credits = [];
const failures = [];

function textOnly(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function request(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TidewellStudentCatalog/1.0 (https://github.com/hristiko/tynoch-tech-ecommerce-app)' },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response;
}

function checkFormat(bytes, filename) {
  if (filename.endsWith('.jpg')) {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG image');
  } else if (filename.endsWith('.png')) {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) throw new Error('Not a PNG image');
  } else {
    throw new Error(`Unsupported image extension: ${filename}`);
  }
  if (bytes.length < 8000) throw new Error('Image file is unexpectedly small');
}

async function downloadPhoto(item) {
  const relative = productImages[item.id];
  const target = path.join(base, relative.slice(1));
  if (existsSync(target)) {
    console.log(`SKIP ${item.id}: already downloaded`);
    return;
  }
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1000');
  url.searchParams.set('titles', `File:${item.file}`);
  const data = await (await request(url)).json();
  const page = Object.values(data?.query?.pages ?? {})[0];
  const image = page?.imageinfo?.[0];
  if (!image?.url) throw new Error(`Commons file not found: ${item.file}`);
  const meta = image.extmetadata ?? {};
  const license = textOnly(meta.LicenseShortName?.value);
  const licenseUrl = textOnly(meta.LicenseUrl?.value);
  const publicLicense = /^(CC0|CC BY|CC-BY|Public domain|PD)/i.test(license);
  if (!publicLicense) throw new Error(`Review license for ${item.file}: ${license || 'not reported'}`);
  const response = await request(image.thumburl ?? image.url);
  const bytes = Buffer.from(await response.arrayBuffer());
  checkFormat(bytes, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  credits.push({
    product: item.id,
    file: item.file,
    description: item.description,
    author: textOnly(meta.Artist?.value) || 'See original file page',
    license,
    licenseUrl,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(item.file.replaceAll(' ', '_'))}`,
  });
  console.log(`OK ${item.id}: ${Math.round(bytes.length / 1024)} KiB`);
}

await mkdir(path.join(base, 'images', 'products'), { recursive: true });
await mkdir(path.join(base, 'images', 'categories'), { recursive: true });
for (const photo of commonsPhotos) {
  try {
    await downloadPhoto(photo);
  } catch (error) {
    failures.push(`${photo.id}: ${error.message}`);
    console.error(`FAILED ${photo.id}: ${error.message}`);
  }
}

for (const [slug, id] of [['kitchen', 'cast-iron-skillet'], ['living', 'soy-candle'], ['carry', 'canvas-daypack']]) {
  const source = path.join(base, productImages[id].slice(1));
  const destination = path.join(base, categoryImages[slug].slice(1));
  if (!existsSync(source)) continue;
  await copyFile(source, destination);
  console.log(`OK category ${slug}`);
}

const creditDir = path.join(root, 'docs');
await mkdir(creditDir, { recursive: true });
const previous = path.join(creditDir, 'IMAGE_CREDITS.json');
let combined = credits;
if (existsSync(previous)) {
  const old = JSON.parse(await readFile(previous, 'utf8'));
  combined = [...old.filter((entry) => !credits.some((next) => next.product === entry.product)), ...credits];
}
await writeFile(previous, JSON.stringify(combined, null, 2) + '\n');
const escapeCell = (value) => String(value ?? '').replaceAll('|', '/').replaceAll('\n', ' ');
const rows = combined.map((entry) => `| ${escapeCell(entry.product)} | [Source](${entry.source}) | ${escapeCell(entry.author)} | ${entry.licenseUrl ? `[${escapeCell(entry.license)}](${entry.licenseUrl})` : escapeCell(entry.license)} |`);
const markdown = [
  '# Catalogue photo credits',
  '',
  'These are illustrative photos for a sample online store. They may not match the exact color, material or specifications of the sample products. The desk images were generated specifically for this demo.',
  '',
  '| Product | Image source | Author | License |',
  '|---|---|---|---|',
  ...rows,
  '',
  'Images are displayed with CSS cropping in the storefront. If you replace one, update this credit file.',
  '',
].join('\n');
await writeFile(path.join(creditDir, 'IMAGE_CREDITS.md'), markdown);

if (failures.length > 0) {
  console.error(`\n${failures.length} image(s) could not be downloaded. Review the errors and rerun this command.`);
  process.exitCode = 1;
} else {
  console.log('\nAll 12 Wikimedia image downloads finished. Review each photo before updating the database.');
}
