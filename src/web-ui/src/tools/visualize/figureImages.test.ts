// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localizeFigureImages } from './figureImages';
import type { Declarations } from './visualBindings';

const url = 'https://images.example.test/diagram.png';
const declarations: Declarations = { photo: { type: 'image', url }, rows: { type: 'json', value: [3] } };

afterEach(() => vi.unstubAllGlobals());

describe('private figure images', () => {
  it('loads only the declared image, hands the guest local bytes, and reuses the checked snapshot', async () => {
    const fetchImage = vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { 'content-type': 'image/png' },
    }));
    vi.stubGlobal('fetch', fetchImage);
    const input = { rows: { kind: 'json' as const, value: [3] } };
    const checked = await localizeFigureImages(declarations, input);
    expect(fetchImage).toHaveBeenCalledWith(url, expect.objectContaining({
      mode: 'cors', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
    }));
    expect(checked.photo).toEqual({ kind: 'image', value: 'data:image/png;base64,iVBORw==' });
    expect(await localizeFigureImages(declarations, checked)).toEqual(checked);
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(checked.rows).toBe(input.rows);
  });

  it.each([['text/html', 3], ['image/png', 256 * 1024 + 1]])('rejects unsupported or oversized response bytes', async (type, size) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(Number(size)), {
      headers: { 'content-type': String(type) },
    })));
    await expect(localizeFigureImages(declarations, {})).rejects.toThrow('Could not load the declared image');
  });
});
