import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const files = await walk(dist);
const relativePaths = files.map((file) => relative(dist, file).replaceAll("\\", "/"));

const forbiddenFiles = relativePaths.filter((file) =>
  /(^|\/)(manifest(?:\.webmanifest|\.json)?|service-worker|sw)\.(?:js|mjs|json|webmanifest)$/i.test(file),
);
if (forbiddenFiles.length > 0) {
  fail(`Forbidden production files: ${forbiddenFiles.join(", ")}`);
}

const textFiles = files.filter((file) => [".html", ".js", ".mjs", ".css", ".json"].includes(extname(file)));
const forbiddenCode = [
  ["service worker registration", /serviceWorker\s*\.\s*register/],
  ["live tab synchronization", /BroadcastChannel/],
  ["file import picker", /showOpenFilePicker/],
  ["file export picker", /showSaveFilePicker/],
  ["persistent-storage request", /navigator\s*\.\s*storage\s*\.\s*persist\s*\(/],
  ["test-only application mount", /mountApp\s*\(/],
  ["Tailwind banner", /tailwindcss/i],
  ["Tailwind custom property", /--tw-/i],
];

for (const file of textFiles) {
  const contents = await readFile(file, "utf8");
  for (const [label, pattern] of forbiddenCode) {
    if (pattern.test(contents)) fail(`${label} found in ${relative(dist, file)}`);
  }
}

const html = await readFile(join(dist, "index.html"), "utf8");
if (/rel=["']manifest["']/i.test(html)) fail("Web app manifest link found in dist/index.html");
if (!/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.js/.test(html)) {
  fail("The production HTML does not reference a hashed JavaScript asset.");
}

process.stdout.write(
  `Production audit passed for ${files.length} files; no forbidden features or Tailwind output found.\n`,
);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
