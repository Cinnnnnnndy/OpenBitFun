/**
 * Host-neutral "open this surface in its own window" adapter.
 *
 * Desktop builds open a real native window so a detached surface can live on a
 * second monitor. Browser-hosted builds fall back to a browser window, which
 * keeps the feature usable (and testable) without pretending it is native.
 * Callers must ask `supportsDetachedWindows()` first and surface
 * `DetachedWindowError.reason` when the host refuses.
 */

import { isTauriRuntime } from './environment';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('DetachedWindow');

export type DetachedWindowFailure =
  /** The host cannot open a second window at all. */
  | 'unsupported-host'
  /** The browser blocked the popup. */
  | 'popup-blocked'
  /** A native window with this label already exists. */
  | 'already-open'
  /** The host reported a window-creation failure. */
  | 'create-failed';

export class DetachedWindowError extends Error {
  constructor(readonly reason: DetachedWindowFailure, message: string) {
    super(message);
    this.name = 'DetachedWindowError';
  }
}

export interface DetachedWindowSpec {
  /** Stable host window label. Reused labels focus the existing window. */
  label: string;
  /** App-relative URL, including the `openbitfunWindow` query contract. */
  url: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
}

export interface DetachedWindowHandle {
  label: string;
  focus(): Promise<void>;
  close(): Promise<void>;
}

/** True when this host can put a surface into its own window. */
export const supportsDetachedWindows = (): boolean => {
  if (typeof window === 'undefined') return false;
  return isTauriRuntime() || typeof window.open === 'function';
};

/** True when the window is a real native window rather than a browser popup. */
export const isNativeDetachedWindow = (): boolean => isTauriRuntime();

export async function openDetachedWindow(spec: DetachedWindowSpec): Promise<DetachedWindowHandle> {
  if (!supportsDetachedWindows()) {
    throw new DetachedWindowError('unsupported-host', 'This host cannot open a detached window.');
  }
  if (isTauriRuntime()) return openNativeDetachedWindow(spec);
  return openBrowserDetachedWindow(spec);
}

async function openNativeDetachedWindow(spec: DetachedWindowSpec): Promise<DetachedWindowHandle> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel(spec.label);
  if (existing) {
    // Reuse rather than stack: a second identical canvas window would fight the
    // first one for the same scope token.
    await existing.setFocus();
    return {
      label: spec.label,
      focus: async () => { await existing.setFocus(); },
      close: async () => { await existing.close(); },
    };
  }

  const window_ = new WebviewWindow(spec.label, {
    url: spec.url,
    title: spec.title,
    width: spec.width,
    height: spec.height,
    minWidth: spec.minWidth ?? 360,
    minHeight: spec.minHeight ?? 280,
    resizable: true,
    center: true,
  });

  await new Promise<void>((resolve, reject) => {
    const unlisten: Array<() => void> = [];
    const settle = (error?: DetachedWindowError) => {
      unlisten.forEach(off => off());
      if (error) reject(error);
      else resolve();
    };
    void window_.once('tauri://created', () => settle());
    void window_.once<{ label?: string }>('tauri://error', event => {
      const label = typeof event.payload?.label === 'string' ? event.payload.label : spec.label;
      settle(new DetachedWindowError('create-failed', `Failed to create window "${label}".`));
    }).catch(error => {
      log.warn('Detached window error listener failed', { error });
    });
  }).catch(error => {
    log.error('Native detached window failed', { label: spec.label, error });
    throw error;
  });

  return {
    label: spec.label,
    focus: async () => { await window_.setFocus(); },
    close: async () => {
      try { await window_.close(); } catch (error) {
        log.debug('Detached window already closed', { error });
      }
    },
  };
}

function openBrowserDetachedWindow(spec: DetachedWindowSpec): DetachedWindowHandle {
  const features = [
    'popup=yes',
    `width=${spec.width}`,
    `height=${spec.height}`,
  ].join(',');
  const opened = window.open(spec.url, spec.label, features);
  if (!opened) {
    throw new DetachedWindowError('popup-blocked', 'The browser blocked the detached window.');
  }
  return {
    label: spec.label,
    focus: async () => { opened.focus(); },
    close: async () => { opened.close(); },
  };
}

/** Close the calling window, whether it is native or a script-opened popup. */
export async function closeCurrentWindow(): Promise<void> {
  if (isTauriRuntime()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
    return;
  }
  window.close();
}
