/**
 * Canvas host for a detached window.
 *
 * Boots empty, asks the docking window for the scope it handed over, and owns
 * that scope until it is recalled or this window closes. Everything the user
 * does here stays in this window's stores; only the finished scope travels back.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CornerUpLeft } from 'lucide-react';
import { Icon, IconButton, Tooltip } from '@openbitfun/ui';
import { ContentCanvas } from '../panels/content-canvas';
import {
  DETACHED_CANVAS_CHANNEL,
  createDetachedCanvasToken,
  type DetachedCanvasMessage,
  type DetachedCanvasWindowParams,
} from '../panels/content-canvas/transfer/detachedCanvasProtocol';
import {
  applyAgentCanvasScopeState,
  readAgentCanvasScopeState,
  type CanvasStoreState,
} from '../panels/content-canvas/stores';
import { createCanvasTransferChannel } from '@/infrastructure/runtime/canvasTransferChannel';
import { closeCurrentWindow } from '@/infrastructure/runtime/detachedWindow';
import { useI18n } from '@/infrastructure/i18n';
import { createLogger } from '@/shared/utils/logger';

import './DetachedCanvasWindow.scss';

const log = createLogger('DetachedCanvasHost');

/** The docking window may still be mounting when this window comes up. */
const HANDSHAKE_RETRY_INTERVAL_MS = 600;
const HANDSHAKE_MAX_ATTEMPTS = 25;

export interface DetachedCanvasHostProps {
  params: DetachedCanvasWindowParams;
}

export const DetachedCanvasHost: React.FC<DetachedCanvasHostProps> = ({ params }) => {
  const { t } = useI18n('components');
  const [isReady, setIsReady] = useState(false);
  const ownsScopeRef = useRef(false);
  const channel = useMemo(
    () => createCanvasTransferChannel(DETACHED_CANVAS_CHANNEL, `detached-${createDetachedCanvasToken()}`),
    [],
  );

  /** Hand the live scope back. Safe to call more than once. */
  const returnScope = useCallback(() => {
    if (!ownsScopeRef.current) return;
    ownsScopeRef.current = false;
    const snapshot = readAgentCanvasScopeState();
    channel.publish({
      sourceId: channel.sourceId,
      token: params.token,
      kind: 'returned',
      state: snapshot.state,
    });
  }, [channel, params.token]);

  const returnAndClose = useCallback(() => {
    returnScope();
    // Give the transport a frame to flush before the window goes away.
    window.setTimeout(() => { void closeCurrentWindow(); }, 0);
  }, [returnScope]);

  useEffect(() => {
    const unsubscribe = channel.subscribe((message: DetachedCanvasMessage) => {
      if (message.token !== params.token) return;
      if (message.kind === 'snapshot') {
        if (message.scopeKey !== params.scopeKey) return;
        applyAgentCanvasScopeState(params.scopeKey, message.state as CanvasStoreState);
        ownsScopeRef.current = true;
        setIsReady(true);
        channel.publish({ sourceId: channel.sourceId, token: params.token, kind: 'ready' });
        return;
      }
      if (message.kind === 'recall') {
        returnAndClose();
      }
    });
    return unsubscribe;
  }, [channel, params.scopeKey, params.token, returnAndClose]);

  // Ask repeatedly until the docking window answers: a single early handshake
  // would be lost if that window is still finishing its own mount.
  useEffect(() => {
    let attempts = 0;
    const request = () => {
      if (ownsScopeRef.current || attempts >= HANDSHAKE_MAX_ATTEMPTS) return;
      attempts += 1;
      channel.publish({
        sourceId: channel.sourceId,
        token: params.token,
        kind: 'handshake',
        scopeKey: params.scopeKey,
      });
    };
    request();
    const timer = window.setInterval(() => {
      if (ownsScopeRef.current || attempts >= HANDSHAKE_MAX_ATTEMPTS) {
        window.clearInterval(timer);
        return;
      }
      request();
    }, HANDSHAKE_RETRY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [channel, params.scopeKey, params.token]);

  // A window closed by the user (window chrome, OS shortcut) must still return
  // its scope; `pagehide` is the last point where the transport is usable.
  useEffect(() => {
    const handleHide = () => returnScope();
    window.addEventListener('pagehide', handleHide);
    window.addEventListener('beforeunload', handleHide);
    return () => {
      window.removeEventListener('pagehide', handleHide);
      window.removeEventListener('beforeunload', handleHide);
    };
  }, [returnScope]);

  useEffect(() => {
    if (!isReady) return;
    log.debug('Detached canvas window owns its scope', { scopeKey: params.scopeKey });
  }, [isReady, params.scopeKey]);

  const toolbarActions = (
    <Tooltip content={t('canvas.returnToMainWindow')} placement="bottom">
      <IconButton
        size="sm"
        aria-label={t('canvas.returnToMainWindow')}
        icon={<Icon glyph={CornerUpLeft} size="sm" />}
        onClick={event => {
          event.stopPropagation();
          returnAndClose();
        }}
      />
    </Tooltip>
  );

  return (
    <div
      className="openbitfun-detached-canvas"
      data-openbitfun-component="content-canvas"
      data-openbitfun-part="root"
      data-openbitfun-mode="agent"
      data-openbitfun-state={isReady ? undefined : 'empty'}
    >
      {isReady ? (
        <ContentCanvas
          workspacePath={params.workspacePath || undefined}
          mode="agent"
          isSceneActive
          onCollapsePanel={returnAndClose}
          toolbarActions={toolbarActions}
          missionControlEnabled={false}
          emptyState={(
            <div
              className="openbitfun-detached-canvas__empty-state"
              data-openbitfun-component="content-canvas"
              data-openbitfun-part="emptyContent"
            >
              <p>{t('canvas.noContentOpen')}</p>
            </div>
          )}
        />
      ) : (
        <div
          className="openbitfun-detached-canvas__connecting"
          data-openbitfun-component="content-canvas"
          data-openbitfun-part="emptyContent"
          role="status"
        >
          {t('canvas.detachedConnecting')}
        </div>
      )}
    </div>
  );
};

DetachedCanvasHost.displayName = 'DetachedCanvasHost';

export default DetachedCanvasHost;
