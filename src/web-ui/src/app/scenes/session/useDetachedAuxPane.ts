/**
 * Docked-side owner of the detached-canvas handshake.
 *
 * The pane keeps a retained copy of everything it hands over, so a detached
 * window that dies before returning its scope cannot lose the user's tabs. Only
 * the window that currently owns the scope renders it; the other one shows the
 * placeholder.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createLogger } from '@/shared/utils/logger';
import {
  DETACHED_CANVAS_CHANNEL,
  buildDetachedCanvasSearch,
  createDetachedCanvasToken,
  type DetachedCanvasMessage,
} from '../../components/panels/content-canvas/transfer/detachedCanvasProtocol';
import {
  findDetachBlockers,
  type DetachBlocker,
} from '../../components/panels/content-canvas/transfer/detachability';
import {
  applyAgentCanvasScopeState,
  readAgentCanvasScopeState,
  releaseAgentCanvasScope,
  type CanvasStoreState,
} from '../../components/panels/content-canvas/stores';
import type { PanelContentType } from '../../components/panels/content-canvas/types';
import { createCanvasTransferChannel } from '@/infrastructure/runtime/canvasTransferChannel';
import {
  DetachedWindowError,
  openDetachedWindow,
  supportsDetachedWindows,
  type DetachedWindowHandle,
} from '@/infrastructure/runtime/detachedWindow';

const log = createLogger('DetachedAuxPane');

/** How long the detached window gets to come up and claim the scope. */
const HANDSHAKE_TIMEOUT_MS = 15000;
/** How long a recall waits for the closing window to hand the scope back. */
const RECALL_TIMEOUT_MS = 4000;
const DETACHED_WINDOW_WIDTH = 1080;
const DETACHED_WINDOW_HEIGHT = 760;

export type AuxPaneDetachStatus = 'docked' | 'opening' | 'detached';

export interface DetachedAuxPaneTab {
  id: string;
  isHidden?: boolean;
  content: { type: PanelContentType; title: string };
}

export interface UseDetachedAuxPaneOptions {
  /** Visible tabs of the scope, used to decide what may move. */
  visibleTabs: readonly DetachedAuxPaneTab[];
  /** The canvas scope this pane owns. */
  scopeKey?: string;
  sessionId?: string | null;
  workspacePath?: string;
  /** Window and placeholder title. */
  title: string;
}

export interface DetachedAuxPaneResult {
  /** The host can open a second window at all. */
  supported: boolean;
  status: AuxPaneDetachStatus;
  /** Visible tabs that block a move, with the reason copy key. */
  blockers: DetachBlocker[];
  error: Error | null;
  /**
   * Tab count the host's layout coordinator should see. A detached pane reports
   * the count it had when it let go, so an empty canvas does not auto-collapse
   * the panel out from under the placeholder.
   */
  layoutTabCount: number;
  detach: () => void;
  recall: () => void;
}

export function useDetachedAuxPane({
  visibleTabs,
  scopeKey,
  sessionId,
  workspacePath,
  title,
}: UseDetachedAuxPaneOptions): DetachedAuxPaneResult {
  const supported = useMemo(() => supportsDetachedWindows(), []);
  const [status, setStatus] = useState<AuxPaneDetachStatus>('docked');
  const [error, setError] = useState<Error | null>(null);
  const [heldTabCount, setHeldTabCount] = useState(0);

  const channel = useMemo(
    () => (supported ? createCanvasTransferChannel(DETACHED_CANVAS_CHANNEL, `docked-${createDetachedCanvasToken()}`) : null),
    [supported],
  );

  const activeRef = useRef<{
    token: string;
    scopeKey: string;
    handle: DetachedWindowHandle | null;
    retained: CanvasStoreState | null;
    recallPending: boolean;
  } | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blockers = useMemo(() => findDetachBlockers(visibleTabs), [visibleTabs]);
  const visibleTabCount = visibleTabs.length;

  const clearTimers = useCallback(() => {
    if (readyTimerRef.current !== null) clearTimeout(readyTimerRef.current);
    if (recallTimerRef.current !== null) clearTimeout(recallTimerRef.current);
    readyTimerRef.current = null;
    recallTimerRef.current = null;
  }, []);

  /** Give the scope back to this window and stop tracking the remote one. */
  const reclaim = useCallback((state: CanvasStoreState | null, nextScopeKey: string) => {
    clearTimers();
    if (state) applyAgentCanvasScopeState(nextScopeKey, state);
    const handle = activeRef.current?.handle ?? null;
    activeRef.current = null;
    setStatus('docked');
    void handle?.close().catch(closeError => {
      log.debug('Detached window already closed', { error: closeError });
    });
  }, [clearTimers]);

  useEffect(() => {
    if (!channel) return;
    const unsubscribe = channel.subscribe((message: DetachedCanvasMessage) => {
      const active = activeRef.current;
      // A late or foreign message must never install a scope into this window.
      if (!active || message.token !== active.token) return;

      switch (message.kind) {
        case 'handshake': {
          if (active.scopeKey !== message.scopeKey) return;
          const snapshot = readAgentCanvasScopeState();
          active.retained = snapshot.state;
          channel.publish({
            sourceId: channel.sourceId,
            token: active.token,
            kind: 'snapshot',
            scopeKey: active.scopeKey,
            sessionId: sessionId ?? null,
            title,
            state: snapshot.state,
          });
          return;
        }
        case 'ready': {
          if (active.retained === null) return;
          if (readyTimerRef.current !== null) clearTimeout(readyTimerRef.current);
          readyTimerRef.current = null;
          // Ownership moved: empty the docked canvas so the placeholder, not a
          // second live copy, is what the user sees here.
          releaseAgentCanvasScope();
          setHeldTabCount(visibleTabCount);
          setStatus('detached');
          return;
        }
        case 'returned': {
          reclaim(message.state as CanvasStoreState, active.scopeKey);
          return;
        }
        case 'closed': {
          // The window went away without handing the scope back; the retained
          // copy is the only remaining source of truth.
          reclaim(active.retained, active.scopeKey);
          return;
        }
        default:
          return;
      }
    });
    return unsubscribe;
  }, [channel, reclaim, sessionId, title, visibleTabCount]);

  useEffect(() => () => {
    clearTimers();
    channel?.dispose();
  }, [channel, clearTimers]);

  const detach = useCallback(() => {
    if (!channel || !supported || activeRef.current) return;
    if (blockers.length > 0) {
      setError(new Error(`Unable to move "${blockers[0].title}" out of the window.`));
      return;
    }
    if (visibleTabCount === 0) return;

    setError(null);
    const token = createDetachedCanvasToken();
    const targetScope = scopeKey ?? '__none__';
    const search = buildDetachedCanvasSearch({
      token,
      scopeKey: targetScope,
      sessionId: sessionId ?? null,
      title,
      workspacePath: workspacePath ?? '',
    });

    activeRef.current = {
      token,
      scopeKey: targetScope,
      handle: null,
      retained: null,
      recallPending: false,
    };
    setStatus('opening');

    void openDetachedWindow({
      label: `detached-canvas-${token}`,
      // Mirrors the desktop window contract in the desktop host: an
      // app-relative search string resolves against the entry document.
      url: `?${search}`,
      title,
      width: DETACHED_WINDOW_WIDTH,
      height: DETACHED_WINDOW_HEIGHT,
    }).then(handle => {
      const active = activeRef.current;
      if (!active || active.token !== token) {
        void handle.close();
        return;
      }
      active.handle = handle;
      readyTimerRef.current = setTimeout(() => {
        readyTimerRef.current = null;
        const current = activeRef.current;
        if (!current || current.token !== token || current.retained === null) return;
        log.warn('Detached window did not claim the scope in time', { token });
        setStatus('docked');
        current.handle = null;
        activeRef.current = null;
        setError(new DetachedWindowError('create-failed', 'The detached window did not become ready.'));
        void handle.close();
      }, HANDSHAKE_TIMEOUT_MS);
    }).catch((openError: unknown) => {
      activeRef.current = null;
      setStatus('docked');
      setError(openError instanceof Error ? openError : new Error(String(openError)));
      log.error('Failed to open detached canvas window', { error: openError });
    });
  }, [blockers, channel, scopeKey, sessionId, supported, title, visibleTabCount, workspacePath]);

  const recall = useCallback(() => {
    const active = activeRef.current;
    if (!channel || !active) return;
    active.recallPending = true;
    channel.publish({
      sourceId: channel.sourceId,
      token: active.token,
      kind: 'recall',
    });
    recallTimerRef.current = setTimeout(() => {
      recallTimerRef.current = null;
      const current = activeRef.current;
      if (!current || !current.recallPending) return;
      // The remote window is not answering; restore the retained copy locally.
      reclaim(current.retained, current.scopeKey);
    }, RECALL_TIMEOUT_MS);
  }, [channel, reclaim]);

  return {
    supported,
    status,
    blockers,
    error,
    layoutTabCount: status === 'docked' ? visibleTabCount : Math.max(heldTabCount, 1),
    detach,
    recall,
  };
}
