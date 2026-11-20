import { afterEach, expect, it, vi } from 'vitest';
import { geoMercator } from 'd3-geo';
import { PbfWriter } from 'pbf';
import { streetBasemap } from './streetBasemap.js';

const projection = geoMercator().center([120, 30]).scale(240000).translate([360, 240]);

// Minimal MVT containing a real linestring command sequence in the streets layer.
function streetTile() {
  const pbf = new PbfWriter();
  pbf.writeMessage(3, (_, layer) => {
    layer.writeVarintField(15, 2);
    layer.writeStringField(1, 'streets');
    layer.writeMessage(2, (_, feature) => {
      feature.writeVarintField(3, 2);
      feature.writePackedVarint(4, [9, 0, 0, 10, 8192, 8192]);
    });
  });
  return pbf.finish();
}

afterEach(() => vi.unstubAllGlobals());

it('projects only fixed public tile requests and emits offline street geometry', async () => {
  const fetch = vi.fn(async () => new Response(streetTile()));
  vi.stubGlobal('fetch', fetch);
  const svg = await streetBasemap(projection, 720, 480, 'en', []);
  expect(svg).toContain('data-street-layer="streets" d="M');
  expect(svg).not.toContain('https://');
  for (const [url, options] of fetch.mock.calls) {
    expect(url).toMatch(/^https:\/\/tiles\.versatiles\.org\/tiles\/osm-vector\/\d+\/\d+\/\d+$/);
    expect(options).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
  }
});

it('rejects an incomplete viewport when one street tile is offline', async () => {
  const fetch = vi.fn(async () => new Response(streetTile()));
  fetch.mockRejectedValueOnce(new Error('Offline'));
  vi.stubGlobal('fetch', fetch);
  await expect(streetBasemap(projection, 720, 480, 'en', [])).rejects.toThrow('Street basemap unavailable');
});
