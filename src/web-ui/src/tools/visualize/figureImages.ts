import type { BoundValues, Declarations } from './visualBindings';

const maxImageBytes = 256 * 1024;
const raster = /^image\/(?:png|jpeg|webp|gif|avif)$/;

async function declaredImage(url: string): Promise<string> {
  // This is a single anonymous browser GET for an immutable declaration.
  // Guest scripts have no bridge for constructing requests or following redirects.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', redirect: 'error',
      signal: controller.signal,
    });
    const type = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!response.ok || !raster.test(type) || !response.body ||
        Number(response.headers.get('content-length')) > maxImageBytes) throw Error('Invalid image');
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxImageBytes) throw Error('Image exceeds the allowed size');
      chunks.push(new Uint8Array(value).buffer);
    }
    if (!size) throw Error('Empty image');
    return await new Promise<string>((resolve, reject) => {
      const file = new FileReader();
      file.onload = () => resolve(String(file.result));
      file.onerror = () => reject(Error('Unreadable image'));
      file.readAsDataURL(new Blob(chunks, { type }));
    });
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

export async function localizeFigureImages(declarations: Declarations, values: BoundValues): Promise<BoundValues> {
  const local = { ...values };
  await Promise.all(Object.entries(declarations).map(async ([key, binding]) => {
    if (binding.type !== 'image') return;
    const existing = values[key];
    if (existing?.kind === 'image' && typeof existing.value === 'string' &&
        /^data:image\/(?:png|jpeg|webp|gif|avif);base64,/.test(existing.value)) return;
    try {
      local[key] = { kind: 'image', value: await declaredImage(binding.url) };
    } catch {
      throw Error('Could not load the declared image ' + key + '. Use an embedded image or a CORS-enabled raster image up to 256 KiB.');
    }
  }));
  return local;
}
