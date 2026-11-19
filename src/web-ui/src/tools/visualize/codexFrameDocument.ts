import type { BoundValues, Declarations } from './visualBindings';
import { cachedVisualRuntime } from './cachedVisualRuntime';
import builtInGuest from './figureGuest.js?raw';
import builtInStyles from './inlineDocument.css?raw';
import extras from './codexFrameExtras.js?raw';
import inspection from './inspectRenderedFigure.js?raw';

// The kit is loaded only for v2 figures. One local import supplies both the
// runtime and the exact same authoring resources to the installed skill.
const raw = import.meta.glob<string>(
  '../../../../crates/assembly/core/builtin_skills/visualize/upstream/{assets/*.js,skills/visualize/assets/*}',
  { eager: true, import: 'default', query: '?raw' },
);
const assets = Object.fromEntries(
  Object.entries(raw).map(([file, source]) => [file.split('/').pop()!, source]),
);
const script = (source: string) => '<script>' + source.replace(/<\/script/gi, '<\\/script') + '</script>';
const cdns = [
  'https://cdnjs.cloudflare.com',
  'https://cdn.jsdelivr.net',
  'https://esm.sh',
  'https://unpkg.com',
  'https://fonts.bunny.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
].join(' ');
const components = 'https://persistent.oaistatic.com/plugins/visualize/';
const csp = (images: string[]) =>
  [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    'connect-src blob: data:',
    'worker-src blob:',
    "script-src 'unsafe-inline' 'unsafe-eval' blob: data: " + cdns + ' ' + components,
    "style-src 'unsafe-inline' blob: data: " + cdns + ' ' + components + 'charts/',
    'img-src blob: data: ' + cdns + ' ' + images.join(' '),
    ...['media', 'font'].map((type) => type + '-src blob: data: ' + cdns),
  ].join('; ');

const hasReferenceKit = !!assets['visualize.html'] && !!assets['standalone-host-bridge.js'];

export async function buildCodexFrame(
  fragment: string,
  state: unknown,
  lang: string,
  declarations: Declarations,
  values: BoundValues,
) {
  if (fragment.includes('data-visual-atlas')) {
    const { materializeRegionalMaps } = await import('./regionalAtlas');
    fragment = await materializeRegionalMaps(fragment);
  }
  // Use Tweak's existing hidden-attribute observer for tabs and conditional content as well as variants.
  const tweak = assets['tweak.js']?.split('.viz-carousel > [data-variant][hidden]').join('[hidden]') ?? '';
  let extensions = script(assets['standalone-host-bridge.js'] ?? builtInGuest) + script(extras) + script(inspection) + script(tweak);
  if (hasReferenceKit && /<viz-calendar\b/i.test(fragment) && !/\/widgets\/[^/]+\/(?:calendar|element)\.js/.test(fragment)) {
    extensions += script(assets['calendar.js']);
  }
  if (
    hasReferenceKit && /<(?:experimental-)?dash-[a-z-]+\b|<dash-sources\b|data-dashboard-|class=["'][^"']*dashboard-/.test(
      fragment,
    )
  ) {
    for (const name of [
      'dashboard-sources.js',
      'dashboard-layout.js',
      'dashboard-source-actions.js',
      'dashboard-annotations.js',
    ]) {
      extensions += script(assets[name]);
    }
  }
  if (/\becharts\s*\./.test(fragment)) {
    const { default: charts } = await import('echarts/dist/echarts.min.js?raw');
    extensions += script(charts);
  }
  const images = Object.values(declarations).flatMap((binding) =>
    binding.type === 'image' ? [new URL(binding.url).origin] : [],
  );
  const bindings = JSON.stringify({ declarations, values }).replace(/</g, '\\u003c');
  const initial = JSON.stringify({ widgetState: state, statePersistence: 'local' }).replace(/</g, '\\u003c');
  const cache = await cachedVisualRuntime(fragment);
  let kit = (assets['visualize.html'] ?? '<!--__INLINE_VISUALIZATION_FRAGMENT__-->').replace(
    '<!--__INLINE_VISUALIZATION_FRAGMENT__-->',
    () => extensions + cache.fragment,
  );
  if (cache.lucide) kit = kit.replace(/<script id="codex-visualization-lucide"[^>]*><\/script>/, '');
  return (
    '<!doctype html><html lang="' +
    (/^[a-z\d-]+$/i.test(lang) ? lang : 'en') +
    '"><head>' +
    '<meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="' +
    csp(images) +
    '">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><style>' +
    (assets['visualize.css'] ?? builtInStyles) +
    '\n:root{--control-spacing:8px}.btn,.nav-link{border-radius:8px}html>body{padding:0;margin:0}' +
    // Honor the fragment's hidden state even when its layout uses flex or grid.
    '[hidden]:not([hidden="until-found" i]){display:none!important}</style></head><body>' +
    '<script type="application/json" id="codex-visualization-widget-state">' +
    initial +
    '</script>' +
    '<script type="application/json" id="openbitfun-visual-data">' +
    bindings +
    '</script>' +
    cache.scripts +
    kit +
    '</body></html>'
  );
}
