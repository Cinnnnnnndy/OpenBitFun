import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./visualize-upstream.json', import.meta.url), 'utf8'));
const owner = path.join(root, 'src/crates/assembly/core/builtin_skills/visualize');
const target = path.join(owner, 'upstream');
const args = process.argv.slice(2);
const check = args.includes('--check');
const paths = args.filter((arg) => arg !== '--check');
if (paths.length > 1) throw Error('Usage: node scripts/import-visualize.mjs [--check] [plugin-directory]');
const source =
  paths[0] ??
  path.join(
    process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'),
    'plugins/cache/openai-curated-remote/visualize',
    manifest.version,
  );

async function verify(directory) {
  const found = [];
  async function walk(relative) {
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await walk(name);
      else {
        assert.ok(entry.isFile(), 'Unexpected non-regular file: ' + name);
        const bytes = await readFile(path.join(directory, name));
        assert.equal(
          createHash('sha256').update(bytes).digest('hex'),
          manifest.files[name],
          'Unexpected file or content: ' + name,
        );
        found.push(name);
      }
    }
  }
  await walk('');
  assert.deepEqual(found.sort(), Object.keys(manifest.files).sort(), 'Missing upstream files');
}

if (!check && paths.length) await verify(source);
try {
  await lstat(target);
} catch (e) {
  if (check || e.code !== 'ENOENT') throw e;
  if (!paths.length) await verify(source);
  // Stage alongside the containing skill, outside the embedded skill tree.
  const stage = await mkdtemp(path.join(root, '.visualize-import-'));
  try {
    await cp(source, path.join(stage, 'package'), { recursive: true, preserveTimestamps: true });
    await verify(path.join(stage, 'package'));
    await rename(path.join(stage, 'package'), target);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
await verify(target);

// Keep the packaged guides and validation workflow intact. Only the resource
// location and the final reference differ between Codex and FlowChat.
const guidePrefix = 'skills/visualize/';
const uri = 'openbitfun://current-session/artifacts/visualizations/v2/<title>.html';
function flowChatEntry(upstream, resourceDirectory) {
  const adaptedMap = resourceDirectory.startsWith('..') ? './maps.md' : './authoring/maps.md';
  return upstream
    .replace(
      '`<skill-dir>` is this SKILL.md’s directory; resolve relative file paths from it.',
      '`<skill-dir>` is `' + resourceDirectory + '` relative to this SKILL.md. Resolve paths starting with `<skill-dir>/` from there. Resolve Markdown links from the directory of this SKILL.md.',
    )
    .replace(/\]\(mockups\.md\)/g, '](' + resourceDirectory + '/mockups.md)')
    .replace('For geographic maps, including maps within another visualization, read [maps.md](maps.md) for sourced geometry, projection, and map-specific validation.',
      'For ordinary city marker maps, the inline atlas declaration in “Publish in FlowChat” is the complete workflow. Submit it directly. For additional geographic layers or projections, read the FlowChat [maps guide](' + adaptedMap + ').')
    .replace(/### File[\s\S]*?(?=### Fragment)/,
      '### Publish in FlowChat\n\n' +
      '- An explicitly requested webpage (网页), website, or project page is a normal project file. Deliver a working independently openable page and link its entry file.\n' +
      '- For a conversational figure, write the literal fragment directly with Write. The first line is `+++ ' + uri + '` (replace <title> with an ASCII lowercase slug). The next line starts the markup. This is your only HTML destination. Use Edit on that URI for corrections.\n' +
      '- FlowChat opens this exact source privately with the conversation renderer during publication. Write/Edit returns the render result. Repair reported issues on the same URI, then use the returned reference. All preview instructions in the guides, including “open it before replying” for maps, are fulfilled by this host check. Do not create scratch HTML, launch a server, open a browser, request screenshots, or produce tool-by-tool progress messages for verification.\n' +
      '- For a city or regional marker map, publish the bundled offline atlas inline first. Write a heading and `<script type="application/json" data-visual-atlas="1">{"places":[{"name":"京都","country":"JP"},{"name":"大阪","country":"JP"}]}</script>` using the requested city names. Support for worldwide land, coasts, lakes, rivers, province boundaries, city coordinates, labels and projection is built in. It produces a complete standalone SVG in the saved reply. No downloads, npm, scratch scripts or local previews are necessary. Follow the adapted maps guide for other map types. For a moving simulation put data-visual-motion on the moving element or canvas.\n\n')
    .replace(/- Check that JavaScript has no undefined identifiers[^\n]+/,
      '- Check selectors, JavaScript identifiers and the primary interaction. Use the FlowChat publication result for the render check.')
    .replace(
      'using the absolute executor-side file path:',
      'using the session URI from the successful Write or Edit:',
    )
    .replaceAll('<absolute-path>/<title>.html', uri);
}

async function syncGuide(destination, expected) {
  const installed = await readFile(destination, 'utf8').catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (check) assert.equal(installed === expected, true, 'Missing or stale guide: ' + path.relative(owner, destination));
  else if (installed !== expected) {
    await mkdir(path.dirname(destination), { recursive: true });
    const stage = await mkdtemp(path.join(root, '.visualize-import-'));
    try {
      await writeFile(path.join(stage, 'guide'), expected);
      await rename(path.join(stage, 'guide'), destination);
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }
}

const packagedGuides = path.join(target, guidePrefix);
const main = await readFile(path.join(packagedGuides, 'SKILL.md'), 'utf8');
await syncGuide(path.join(owner, 'SKILL.md'), flowChatEntry(main, 'upstream/skills/visualize'));
for (const entry of Object.keys(manifest.files)) {
  if (!entry.startsWith(guidePrefix) || !entry.endsWith('.md')) continue;
  const name = entry.slice(guidePrefix.length);
  const expected = name === 'SKILL.md'
    ? flowChatEntry(main, '../upstream/skills/visualize')
    : name === 'maps.md'
      ? (await readFile(path.join(target, entry), 'utf8'))
        .replace('# Maps', '# Maps\n\nFor city, regional and multi-city marker maps use the packaged regional atlas. Write the diagram once to the FlowChat URI with a heading and `<script type="application/json" data-visual-atlas="1">{"places":[{"name":"京都","country":"JP"},{"name":"大阪","country":"JP"}]}</script>`. A place takes its local name and optional ISO-2 country, first-level region, or sourced coordinates [longitude, latitude]. Optional bounds are [west,south,east,north]. Use this same path for any covered region. It already supplies real coastlines, rivers, lakes and boundaries. Use custom geometry only for more local detail or a layer this atlas does not contain.')
        .replace('Open it before replying and fix', 'The background Write/Edit check opens the final fragment before the reply. Use its diagnostics to fix')
      : await readFile(path.join(target, entry), 'utf8');
  await syncGuide(path.join(owner, 'authoring', name), expected);
}

console.log(
  'Verified Codex Visualize ' +
    manifest.version +
    ' (' +
    Object.keys(manifest.files).length +
    ' files, SHA-256).',
);
