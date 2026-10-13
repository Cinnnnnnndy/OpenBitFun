// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DetachedWindowError,
  closeCurrentWindow,
  isNativeDetachedWindow,
  openDetachedWindow,
  supportsDetachedWindows,
} from './detachedWindow';

vi.mock('./environment', () => ({
  isTauriRuntime: () => false,
}));

const spec = {
  label: 'detached-canvas-1',
  url: '?openbitfunWindow=detached-canvas&token=1',
  title: 'OpenBitFun Canvas',
  width: 1080,
  height: 760,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detached window host adapter', () => {
  it('reports a browser host that can open a window as supported but not native', () => {
    vi.spyOn(window, 'open').mockReturnValue(window);
    expect(supportsDetachedWindows()).toBe(true);
    expect(isNativeDetachedWindow()).toBe(false);
  });

  it('opens a browser window with the requested size and focuses it', async () => {
    const opened = { focus: vi.fn(), close: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(opened);

    const handle = await openDetachedWindow(spec);

    expect(open).toHaveBeenCalledWith(spec.url, spec.label, 'popup=yes,width=1080,height=760');
    expect(handle.label).toBe('detached-canvas-1');
    await handle.focus();
    expect(opened.focus).toHaveBeenCalled();
  });

  it('degrades loudly when the browser blocks the popup', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(openDetachedWindow(spec)).rejects.toMatchObject({
      name: 'DetachedWindowError',
      reason: 'popup-blocked',
    });
  });

  it('closes the calling window through the browser path when there is no native host', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    await closeCurrentWindow();
    expect(close).toHaveBeenCalled();
  });

  it('carries the failure reason on the error so callers can branch on it', () => {
    const error = new DetachedWindowError('unsupported-host', 'nope');
    expect(error).toBeInstanceOf(Error);
    expect(error.reason).toBe('unsupported-host');
    expect(error.message).toBe('nope');
  });
});
