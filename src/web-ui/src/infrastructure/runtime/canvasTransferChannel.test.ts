// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCanvasTransferChannel } from './canvasTransferChannel';
import type { DetachedCanvasMessage } from '@/app/components/panels/content-canvas/transfer/detachedCanvasProtocol';

type Listener = (event: MessageEvent<unknown>) => void;

/**
 * jsdom has no BroadcastChannel. The fake keeps every instance in one loop so
 * two channels can observe each other the way two real windows would.
 */
class FakeBroadcastChannel {
  static readonly instances: FakeBroadcastChannel[] = [];
  private readonly listeners = new Set<Listener>();
  closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: 'message', listener: Listener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: Listener): void {
    this.listeners.delete(listener);
  }

  postMessage(data: unknown): void {
    FakeBroadcastChannel.instances
      .filter(channel => channel !== this && !channel.closed && channel.name === this.name)
      .forEach(channel => channel.deliver(data));
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }

  private deliver(data: unknown): void {
    this.listeners.forEach(listener => listener({ data } as MessageEvent<unknown>));
  }
}

const CHANNEL = 'openbitfun-detached-canvas';

function message(sourceId: string, kind: DetachedCanvasMessage['kind']): DetachedCanvasMessage {
  return { sourceId, token: 'token-1', kind } as DetachedCanvasMessage;
}

describe('canvas transfer channel', () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances.length = 0;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel;
  });

  afterEach(() => {
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  });

  it('delivers a message to the peer window', () => {
    const docked = createCanvasTransferChannel(CHANNEL, 'docked-1');
    const detached = createCanvasTransferChannel(CHANNEL, 'detached-1');
    const received: DetachedCanvasMessage[] = [];
    detached.subscribe(value => received.push(value));

    docked.publish(message('docked-1', 'recall'));

    expect(received).toEqual([message('docked-1', 'recall')]);
  });

  it('drops its own echo so both transports behave the same', () => {
    const docked = createCanvasTransferChannel(CHANNEL, 'docked-1');
    const received: DetachedCanvasMessage[] = [];
    docked.subscribe(value => received.push(value));

    docked.publish(message('docked-1', 'recall'));

    expect(received).toEqual([]);
  });

  it('ignores a malformed payload instead of handing it to the store', () => {
    const docked = createCanvasTransferChannel(CHANNEL, 'docked-1');
    const detached = createCanvasTransferChannel(CHANNEL, 'detached-1');
    const received: DetachedCanvasMessage[] = [];
    detached.subscribe(value => received.push(value));

    FakeBroadcastChannel.instances[0].postMessage({ kind: 'recall' });
    FakeBroadcastChannel.instances[0].postMessage({ sourceId: 'docked-1', kind: 'recall' });
    docked.publish(message('docked-1', 'ready'));

    expect(received).toEqual([message('docked-1', 'ready')]);
  });

  it('stops delivering after unsubscribe and dispose', () => {
    const docked = createCanvasTransferChannel(CHANNEL, 'docked-1');
    const detached = createCanvasTransferChannel(CHANNEL, 'detached-1');
    const received: DetachedCanvasMessage[] = [];
    const unsubscribe = detached.subscribe(value => received.push(value));

    unsubscribe();
    docked.publish(message('docked-1', 'recall'));
    detached.dispose();
    docked.publish(message('docked-1', 'recall'));

    expect(received).toEqual([]);
  });
});
