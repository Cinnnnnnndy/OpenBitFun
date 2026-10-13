import { describe, expect, it, vi } from 'vitest';
import {
  buildDetachedCanvasSearch,
  createDetachedCanvasToken,
  isCanvasScopeState,
  isDetachedCanvasMessage,
  readDetachedCanvasWindowParams,
  type DetachedCanvasMessage,
} from './detachedCanvasProtocol';

const scopeState = {
  primaryGroup: { id: 'primary', tabs: [] },
  secondaryGroup: { id: 'secondary', tabs: [] },
  tertiaryGroup: { id: 'tertiary', tabs: [] },
  layout: { anchorPosition: 'hidden', anchorSize: 320, isMaximized: false },
  closedTabs: [],
};

const envelope = { sourceId: 'docked-1', token: 'canvas-token' };

describe('detached canvas protocol', () => {
  it('round-trips the window parameters through the search string', () => {
    const search = buildDetachedCanvasSearch({
      token: 'canvas-token',
      scopeKey: 'session-7',
      sessionId: 'session-7',
      title: 'OpenBitFun Canvas',
      workspacePath: '/tmp/workspace',
    });
    const params = readDetachedCanvasWindowParams(`?${search}`);
    expect(params).toEqual({
      token: 'canvas-token',
      scopeKey: 'session-7',
      sessionId: 'session-7',
      title: 'OpenBitFun Canvas',
      workspacePath: '/tmp/workspace',
    });
  });

  it('omits optional parameters that are absent', () => {
    const search = buildDetachedCanvasSearch({
      token: 'canvas-token',
      scopeKey: 'session-7',
      sessionId: null,
      title: '',
      workspacePath: '',
    });
    expect(search).not.toContain('session=');
    expect(search).not.toContain('workspace=');
    expect(readDetachedCanvasWindowParams(`?${search}`)).toMatchObject({
      sessionId: null,
      workspacePath: '',
    });
  });

  it('ignores a search string that belongs to another window kind', () => {
    expect(readDetachedCanvasWindowParams('?openbitfunWindow=agent-companion')).toBeNull();
  });

  it('requires both the token and the scope', () => {
    expect(readDetachedCanvasWindowParams('?openbitfunWindow=detached-canvas&token=t')).toBeNull();
    expect(readDetachedCanvasWindowParams('?openbitfunWindow=detached-canvas&scope=s')).toBeNull();
  });

  it('mints a distinct token per detach', () => {
    const first = createDetachedCanvasToken();
    const second = createDetachedCanvasToken();
    expect(first).not.toBe(second);
    expect(first.startsWith('canvas-')).toBe(true);
  });

  it('accepts every message kind it defines', () => {
    const messages: DetachedCanvasMessage[] = [
      { ...envelope, kind: 'handshake', scopeKey: 'session-7' },
      { ...envelope, kind: 'snapshot', scopeKey: 'session-7', sessionId: 'session-7', title: 'Canvas', state: scopeState },
      { ...envelope, kind: 'ready' },
      { ...envelope, kind: 'recall' },
      { ...envelope, kind: 'returned', state: scopeState },
      { ...envelope, kind: 'closed' },
    ];
    messages.forEach(message => expect(isDetachedCanvasMessage(message)).toBe(true));
  });

  it('rejects a snapshot whose scope state is not a canvas scope', () => {
    const partial = { ...envelope, kind: 'snapshot', scopeKey: 'session-7', sessionId: null, title: 'Canvas', state: { primaryGroup: { id: 'primary', tabs: [] } } };
    expect(isDetachedCanvasMessage(partial)).toBe(false);
    expect(isDetachedCanvasMessage({ ...envelope, kind: 'returned', state: null })).toBe(false);
  });

  it('rejects a message without a sender identity so echoes stay traceable', () => {
    expect(isDetachedCanvasMessage({ token: 'canvas-token', kind: 'ready' })).toBe(false);
    expect(isDetachedCanvasMessage({ sourceId: '', token: 'canvas-token', kind: 'ready' })).toBe(false);
    expect(isDetachedCanvasMessage('canvas-token')).toBe(false);
  });

  it('rejects an unknown message kind', () => {
    const spy = vi.fn();
    expect(isDetachedCanvasMessage({ ...envelope, kind: 'stolen', scopeKey: 'session-7' })).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('validates scope state structurally rather than trusting the payload', () => {
    expect(isCanvasScopeState(scopeState)).toBe(true);
    expect(isCanvasScopeState({ ...scopeState, closedTabs: undefined })).toBe(false);
    expect(isCanvasScopeState({ ...scopeState, tertiaryGroup: [] })).toBe(false);
  });
});
