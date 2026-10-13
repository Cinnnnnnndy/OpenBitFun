/**
 * Cross-window message bus for canvas scope transfer.
 *
 * Native windows use app-wide Tauri events; browser-hosted windows use
 * BroadcastChannel. Both transports are lossy in different ways (Tauri echoes an
 * event back to its sender, BroadcastChannel does not), so messages carry a
 * `sourceId` and the bus drops its own echo before delivery.
 */

import { isTauriRuntime } from './environment';
import { createLogger } from '@/shared/utils/logger';
import {
  isDetachedCanvasMessage,
  type DetachedCanvasMessage,
} from '@/app/components/panels/content-canvas/transfer/detachedCanvasProtocol';

const log = createLogger('CanvasTransferChannel');

export interface CanvasTransferChannel {
  readonly sourceId: string;
  /** True when messages travel over a real cross-window transport. */
  readonly isCrossWindow: boolean;
  publish(message: DetachedCanvasMessage): void;
  subscribe(listener: (message: DetachedCanvasMessage) => void): () => void;
  dispose(): void;
}

export function createCanvasTransferChannel(
  channelName: string,
  sourceId: string,
): CanvasTransferChannel {
  const listeners = new Set<(message: DetachedCanvasMessage) => void>();
  const dispatch = (payload: unknown): void => {
    if (!isDetachedCanvasMessage(payload)) return;
    // Ignore our own echo so Tauri and BroadcastChannel behave identically.
    if (payload.sourceId === sourceId) return;
    listeners.forEach(listener => listener(payload));
  };

  const transport = isTauriRuntime()
    ? createTauriTransport(channelName, dispatch)
    : createBroadcastTransport(channelName, dispatch);

  return {
    sourceId,
    isCrossWindow: transport !== null,
    publish: message => {
      if (!transport) return;
      try {
        transport.publish(message);
      } catch (error) {
        log.warn('Canvas transfer publish failed', { error });
      }
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose: () => {
      listeners.clear();
      transport?.dispose();
    },
  };
}

interface TransferTransport {
  publish(message: DetachedCanvasMessage): void;
  dispose(): void;
}

function createTauriTransport(
  channelName: string,
  dispatch: (payload: unknown) => void,
): TransferTransport | null {
  let unlisten: (() => void) | null = null;
  let disposed = false;
  void (async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const stop = await listen(channelName, event => dispatch(event.payload));
      if (disposed) stop();
      else unlisten = stop;
    } catch (error) {
      log.warn('Canvas transfer listener unavailable', { error });
    }
  })();

  return {
    publish: message => {
      void import('@tauri-apps/api/event')
        .then(({ emit }) => emit(channelName, message))
        .catch(error => log.warn('Canvas transfer emit failed', { error }));
    },
    dispose: () => {
      disposed = true;
      unlisten?.();
      unlisten = null;
    },
  };
}

function createBroadcastTransport(
  channelName: string,
  dispatch: (payload: unknown) => void,
): TransferTransport | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(channelName);
  } catch (error) {
    log.warn('Canvas transfer channel unavailable', { error });
    return null;
  }
  const handleMessage = (event: MessageEvent<unknown>) => dispatch(event.data);
  channel.addEventListener('message', handleMessage);
  return {
    publish: message => channel.postMessage(message),
    dispose: () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    },
  };
}
