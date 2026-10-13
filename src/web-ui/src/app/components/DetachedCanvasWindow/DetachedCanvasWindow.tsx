/**
 * Root of the detached canvas window (`?openbitfunWindow=detached-canvas`).
 *
 * The window starts empty and receives its scope from the docking window, so it
 * only needs the providers the canvas itself reads: workspace context for file
 * resolution and the runtime window adapter it already has.
 */

import React, { useEffect, useMemo } from 'react';
import { WorkspaceProvider } from '@/infrastructure/contexts/WorkspaceProvider';
import { useI18n } from '@/infrastructure/i18n';
import {
  readDetachedCanvasWindowParams,
  type DetachedCanvasWindowParams,
} from '../panels/content-canvas/transfer/detachedCanvasProtocol';
import DetachedCanvasHost from './DetachedCanvasHost';

import './DetachedCanvasWindow.scss';

export const DetachedCanvasWindow: React.FC = () => {
  const { t } = useI18n('components');
  const params = useMemo<DetachedCanvasWindowParams | null>(
    () => (typeof window === 'undefined' ? null : readDetachedCanvasWindowParams(window.location.search)),
    [],
  );

  useEffect(() => {
    if (!params) return;
    document.title = params.title || t('canvas.detachedWindowTitle');
  }, [params, t]);

  if (!params) {
    return (
      <div
        className="openbitfun-detached-canvas openbitfun-detached-canvas--invalid"
        data-openbitfun-component="content-canvas"
        data-openbitfun-part="emptyContent"
        role="alert"
      >
        {t('canvas.detachedWindowInvalid')}
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <DetachedCanvasHost params={params} />
    </WorkspaceProvider>
  );
};

DetachedCanvasWindow.displayName = 'DetachedCanvasWindow';

export default DetachedCanvasWindow;
