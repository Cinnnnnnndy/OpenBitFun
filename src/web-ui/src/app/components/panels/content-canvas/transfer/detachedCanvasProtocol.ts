/**
 * Wire contract between the docked canvas pane and its detached window.
 *
 * One agent canvas scope is owned by exactly one window at a time. Detaching
 * hands the scope over (the docked pane gives it up and shows a placeholder);
 * recalling hands it back and the detached window closes itself. Because
 * ownership moves instead of being mirrored, neither side has to merge live
 * edits from the other.
 */

/** Cross-window transport name. Tauri events and BroadcastChannel share this id. */
export const DETACHED_CANVAS_CHANNEL = 'openbitfun-detached-canvas';

/** `openbitfunWindow` query value that boots the detached canvas window. */
export const DETACHED_CANVAS_WINDOW_VALUE = 'detached-canvas';

export interface DetachedCanvasEnvelope {
  /** Sender identity; the sender ignores its own echo. */
  sourceId: string;
  /** Correlates one detach session. A message for another token is ignored. */
  token: string;
}

export type DetachedCanvasMessage =
  /** Detached window is up and asks the owner for the scope. */
  | (DetachedCanvasEnvelope & { kind: 'handshake'; scopeKey: string })
  /** Owner transfers the scope. */
  | (DetachedCanvasEnvelope & {
    kind: 'snapshot';
    scopeKey: string;
    sessionId: string | null;
    title: string;
    state: unknown;
  })
  /** Detached window applied the transfer and is now the owner. */
  | (DetachedCanvasEnvelope & { kind: 'ready' })
  /** Owner asks for the scope back. */
  | (DetachedCanvasEnvelope & { kind: 'recall' })
  /** Detached window hands the last scope state back before closing. */
  | (DetachedCanvasEnvelope & { kind: 'returned'; state: unknown })
  /** Detached window closed without an explicit recall. */
  | (DetachedCanvasEnvelope & { kind: 'closed' });

export type DetachedCanvasMessageKind = DetachedCanvasMessage['kind'];

export function createDetachedCanvasToken(): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `canvas-${Date.now().toString(36)}-${random}`;
}

/**
 * Tauri delivers an emitted event back to the emitting window, while
 * BroadcastChannel does not. Every consumer filters by `sourceId`, so both
 * transports behave the same regardless.
 */
export function isDetachedCanvasMessage(value: unknown): value is DetachedCanvasMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  if (typeof message.sourceId !== 'string' || message.sourceId.length === 0) return false;
  if (typeof message.token !== 'string' || message.token.length === 0) return false;
  switch (message.kind) {
    case 'handshake':
      return typeof message.scopeKey === 'string';
    case 'snapshot':
      return typeof message.scopeKey === 'string'
        && typeof message.title === 'string'
        && (message.sessionId === null || typeof message.sessionId === 'string')
        && isCanvasScopeState(message.state);
    case 'ready':
    case 'recall':
    case 'closed':
      return true;
    case 'returned':
      return isCanvasScopeState(message.state);
    default:
      return false;
  }
}

/**
 * Structural check for a transferred canvas scope. The payload crosses a
 * structured-clone boundary, so a malformed sender must not be able to install
 * a half-built scope into the receiving store.
 */
export function isCanvasScopeState(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return isEditorGroupState(state.primaryGroup)
    && isEditorGroupState(state.secondaryGroup)
    && isEditorGroupState(state.tertiaryGroup)
    && Boolean(state.layout && typeof state.layout === 'object')
    && Array.isArray(state.closedTabs);
}

function isEditorGroupState(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const group = value as Record<string, unknown>;
  return typeof group.id === 'string' && Array.isArray(group.tabs);
}

/** Query string consumed by the detached window root. */
export interface DetachedCanvasWindowParams {
  token: string;
  scopeKey: string;
  sessionId: string | null;
  title: string;
  workspacePath: string;
}

export function buildDetachedCanvasSearch(params: DetachedCanvasWindowParams): string {
  const search = new URLSearchParams({
    openbitfunWindow: DETACHED_CANVAS_WINDOW_VALUE,
    token: params.token,
    scope: params.scopeKey,
    title: params.title,
  });
  if (params.sessionId) search.set('session', params.sessionId);
  if (params.workspacePath) search.set('workspace', params.workspacePath);
  return search.toString();
}

export function readDetachedCanvasWindowParams(search: string): DetachedCanvasWindowParams | null {
  const params = new URLSearchParams(search);
  if (params.get('openbitfunWindow') !== DETACHED_CANVAS_WINDOW_VALUE) return null;
  const token = params.get('token');
  const scopeKey = params.get('scope');
  if (!token || !scopeKey) return null;
  return {
    token,
    scopeKey,
    sessionId: params.get('session'),
    title: params.get('title') ?? '',
    workspacePath: params.get('workspace') ?? '',
  };
}
