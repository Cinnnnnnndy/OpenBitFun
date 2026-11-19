import atlasStyle from '../../../../shared/generative-ui/regional-map.css?raw';
import { i18nService } from '@/infrastructure/i18n';

import land from '../../../../../third_party/visualize/atlas/land.json?url&no-inline';
import rivers from '../../../../../third_party/visualize/atlas/rivers.json?url&no-inline';
import lakes from '../../../../../third_party/visualize/atlas/lakes.json?url&no-inline';
import places from '../../../../../third_party/visualize/atlas/places.json?url&no-inline';
import borders from '../../../../../third_party/visualize/atlas/borders.json?url&no-inline';
import provinces from '../../../../../third_party/visualize/atlas/provinces.json?url&no-inline';
import seas from '../../../../../third_party/visualize/atlas/seas.json?url&no-inline';

const layers = { land, rivers, lakes, places, borders, provinces, seas };

async function project(spec: unknown, language: string): Promise<string> {
  const urls = Object.fromEntries(Object.entries(layers).map(([key, url]) => [key, new URL(url, location.href).href]));
  const worker = new Worker(new URL('./regionalProjection.js', import.meta.url), { type: 'module' });
  try {
    return await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(Error('The regional map projection timed out.')), 10000);
      worker.onmessage = ({ data }) => {
        clearTimeout(timeout);
        if (typeof data.svg === 'string') resolve(data.svg);
        else reject(Error(data.issue || 'Map projection failed.'));
      };
      worker.onerror = (e) => {
        clearTimeout(timeout);
        reject(Error(e.message || 'The regional map worker could not load.'));
      };
      const options = { lng: language };
      const labels = {
        north: i18nService.t('flow-chat:visualize.mapNorth', options),
        km: i18nService.t('flow-chat:visualize.mapKilometers', options),
        m: i18nService.t('flow-chat:visualize.mapMeters', options),
      };
      worker.postMessage({ spec, urls, language, labels });
    });
  } finally {
    worker.terminate();
  }
}

export async function materializeRegionalMaps(source: string) {
  if (!source.includes('data-visual-atlas')) return source;
  const fragment = document.createElement('template');
  fragment.innerHTML = source;
  const maps = fragment.content.querySelectorAll('script[type="application/json"][data-visual-atlas="1"]');
  if (!maps.length) return source;
  for (const declaration of maps) {
    const spec = JSON.parse(declaration.textContent || 'null');
    const language = spec?.language || document.documentElement.lang || i18nService.getCurrentLocale();
    const svg = await project(spec, language);
    const result = document.createElement('template');
    result.innerHTML = svg;
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = atlasStyle;
    result.content.querySelector('svg')!.prepend(style);
    const credit = document.createElement('small');
    credit.textContent = i18nService.t('flow-chat:visualize.mapCredit', { lng: language });
    credit.className = 'text-muted';
    declaration.replaceWith(result.content, credit);
  }
  const html = fragment.innerHTML;
  if (new TextEncoder().encode(html).length > 1024 * 1024)
    throw Error('The projected map exceeds the figure size limit. Use a regional extent.');
  return html;
}
