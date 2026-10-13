/**
 * AuxPane — AI Agent scene right pane.
 * Hosts ContentCanvas with tab management for editor views and visualizations.
 *
 * Renamed from panels/ContentPanel. All logic preserved.
 */

import { forwardRef, useEffect, useMemo, useRef, useImperativeHandle, useCallback, useSyncExternalStore } from 'react';
import { CornerUpLeft, Maximize2, Minimize2, PictureInPicture2, SquareDashed } from 'lucide-react';
import { Button, Empty, Icon, IconButton, Tooltip } from '@openbitfun/ui';
import { ContentCanvas, useCanvasStore } from '../../components/panels/content-canvas';
import { usePanelTabCoordinator } from '../../components/panels/content-canvas/hooks/usePanelTabCoordinator';
import { TAB_EVENTS } from '../../components/panels/content-canvas/types';
import { NON_DETACHABLE_REASON_KEYS } from '../../components/panels/content-canvas/transfer/detachability';
import { collapseSessionAuxPane, expandSessionAuxPane, hideSessionAuxPane } from './sessionPanelLayout';
import { useDetachedAuxPane } from './useDetachedAuxPane';
import { switchAgentCanvasScope } from '../../components/panels/content-canvas/stores';
import { useI18n } from '@/infrastructure/i18n';
import type { PanelContent as OldPanelContent } from '../../components/panels/base/types';
import type { PanelContent } from '../../components/panels/content-canvas/types';
import { createLogger } from '@/shared/utils/logger';
import { notificationService } from '@/shared/notification-system';
import { flowChatStore } from '@/flow_chat/store/FlowChatStore';
import { isCanvasTabVisibleForSession } from '../../components/panels/content-canvas/types';

import './AuxPane.scss';

const log = createLogger('AuxPane');

export interface AuxPaneRef {
  addTab: (content: OldPanelContent) => void;
  switchToTab: (tabId: string) => void;
  findTabByMetadata: (metadata: Record<string, any>) => { tabId: string } | null;
  updateTabContent: (tabId: string, content: OldPanelContent) => void;
  closeAllTabs: () => void;
}

interface AuxPaneProps {
  workspacePath?: string;
  isSceneActive?: boolean;
  terminalResizeSuspended?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const AuxPane = forwardRef<AuxPaneRef, AuxPaneProps>(
  ({ workspacePath, isSceneActive = true, terminalResizeSuspended = false, isFullscreen = false, onToggleFullscreen }, ref) => {
    const { t } = useI18n('components');
    const activeSessionId = useSyncExternalStore(
      flowChatStore.subscribe.bind(flowChatStore),
      () => flowChatStore.getState().activeSessionId,
      () => flowChatStore.getState().activeSessionId,
    );

    // Fine-grained selectors so unrelated store changes do not re-render.
    const addTab = useCanvasStore(state => state.addTab);
    const switchToTab = useCanvasStore(state => state.switchToTab);
    const findTabByMetadata = useCanvasStore(state => state.findTabByMetadata);
    const updateTabContent = useCanvasStore(state => state.updateTabContent);
    const closeAllTabs = useCanvasStore(state => state.closeAllTabs);
    const primaryGroup = useCanvasStore(state => state.primaryGroup);
    const secondaryGroup = useCanvasStore(state => state.secondaryGroup);
    const tertiaryGroup = useCanvasStore(state => state.tertiaryGroup);
    const canvasScopeKey = useCanvasStore(state => state.scopeKey);
    const visibleTabs = useMemo(
      () => [primaryGroup, secondaryGroup, tertiaryGroup]
        .flatMap(group => group.tabs.filter(tab =>
          !tab.isHidden && isCanvasTabVisibleForSession(tab, activeSessionId),
        )),
      [activeSessionId, primaryGroup, secondaryGroup, tertiaryGroup],
    );
    const detach = useDetachedAuxPane({
      visibleTabs,
      scopeKey: canvasScopeKey,
      sessionId: activeSessionId,
      workspacePath,
      title: t('canvas.detachedWindowTitle'),
    });
    const { expandPanel } = usePanelTabCoordinator({
      // While the canvas lives in another window this pane still reports the
      // count it had when it let go, so the host does not collapse the panel
      // and take the recall affordance with it.
      visibleTabCount: detach.layoutTabCount,
      scopeKey: canvasScopeKey,
      expandEventName: TAB_EVENTS.EXPAND_RIGHT_PANEL,
      onExpand: expandSessionAuxPane,
      onCollapse: collapseSessionAuxPane,
    });

    const { status: detachStatus, blockers: detachBlockers, error: detachError } = detach;

    // A refused or failed detach must not look like nothing happened.
    useEffect(() => {
      if (!detachError) return;
      const blocker = detachBlockers[0];
      const reasonKey = blocker ? NON_DETACHABLE_REASON_KEYS[blocker.type] : undefined;
      notificationService.warning(
        blocker
          ? t('canvas.detachBlocked', { title: blocker.title }) + (reasonKey ? ` ${t(reasonKey)}` : '')
          : t('canvas.detachFailed', { reason: detachError.message }),
      );
    }, [detachBlockers, detachError, t]);

    const convertContent = useCallback((oldContent: OldPanelContent): PanelContent => {
      return {
        type: oldContent.type,
        title: oldContent.title,
        data: oldContent.data,
        metadata: oldContent.metadata,
      };
    }, []);

    useImperativeHandle(ref, () => ({
      addTab: (content: OldPanelContent) => {
        addTab(convertContent(content), 'active');
        expandPanel();
      },
      switchToTab: (tabId: string) => {
        if (primaryGroup.tabs.find(t => t.id === tabId)) {
          switchToTab(tabId, 'primary');
          expandPanel();
        } else if (secondaryGroup.tabs.find(t => t.id === tabId)) {
          switchToTab(tabId, 'secondary');
          expandPanel();
        }
      },
      findTabByMetadata: (metadata: Record<string, any>) => {
        const result = findTabByMetadata(metadata);
        return result ? { tabId: result.tab.id } : null;
      },
      updateTabContent: (tabId: string, content: OldPanelContent) => {
        if (primaryGroup.tabs.find(t => t.id === tabId)) {
          updateTabContent(tabId, 'primary', convertContent(content));
        } else if (secondaryGroup.tabs.find(t => t.id === tabId)) {
          updateTabContent(tabId, 'secondary', convertContent(content));
        }
      },
      closeAllTabs: () => {
        closeAllTabs();
      },
    }), [
      addTab,
      switchToTab,
      findTabByMetadata,
      updateTabContent,
      closeAllTabs,
      primaryGroup.tabs,
      secondaryGroup.tabs,
      convertContent,
      expandPanel,
    ]);

    const prevScopeKeyRef = useRef<string | undefined>(undefined);

    const syncAgentCanvasScope = useCallback((next: string | undefined) => {
      const prev = prevScopeKeyRef.current;
      if (prev === next) return;

      log.debug('Active session changed, swapping agent canvas snapshot', {
        from: prev ?? '(none)',
        to: next ?? '(none)',
      });
      prevScopeKeyRef.current = next;
      switchAgentCanvasScope(next ?? null);
    }, []);

    useEffect(() => {
      syncAgentCanvasScope(flowChatStore.getState().activeSessionId ?? undefined);
      // FlowChatStore notifies synchronously while a session switch is still in
      // progress. Swap the canvas before callers can open content for the target
      // session; the store itself ignores a swap to the scope already live.
      return flowChatStore.subscribe(state => {
        syncAgentCanvasScope(state.activeSessionId ?? undefined);
      });
    }, [syncAgentCanvasScope]);

    const handleInteraction = useCallback(async (itemId: string, userInput: string) => {
      log.debug('Panel interaction', { itemId, userInput });
    }, []);

    const handleBeforeClose = useCallback(async (_content: any) => {
      return true;
    }, []);

    const canDetach = detach.supported
      && detachStatus === 'docked'
      && detachBlockers.length === 0
      && visibleTabs.length > 0;
    const detachHint = detachBlockers.length > 0
      ? `${t('canvas.detachBlocked', { title: detachBlockers[0].title })}`
      : t('canvas.detachToWindow');

    const isDetached = detachStatus !== 'docked';

    return (
      <div data-openbitfun-component="aux-pane" data-openbitfun-part="root" className="openbitfun-aux-pane"
        data-openbitfun-state={isDetached ? 'detached' : undefined}
      >
        {isDetached ? (
          <div
            className="openbitfun-aux-pane__detached"
            data-openbitfun-component="aux-pane"
            data-openbitfun-part="detachedPlaceholder"
            data-openbitfun-state="detached"
          >
            <Empty
              imageSize="md"
              icon={<Icon glyph={PictureInPicture2} size="lg" />}
              title={t('canvas.detachedElsewhere')}
              description={t('canvas.detachedHint')}
              actions={(
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Icon glyph={CornerUpLeft} size="sm" />}
                  onClick={detach.recall}
                >
                  {t('canvas.recallToMainWindow')}
                </Button>
              )}
            />
          </div>
        ) : (
          <ContentCanvas
            workspacePath={workspacePath}
            mode="agent"
            isSceneActive={isSceneActive}
            onReveal={expandPanel}
            onCollapsePanel={hideSessionAuxPane}
            toolbarActions={(
              <>
                {detach.supported && (
                  <Tooltip content={detachHint} placement="bottom">
                    <IconButton
                      size="sm"
                      aria-label={detachHint}
                      disabled={!canDetach}
                      icon={<Icon glyph={PictureInPicture2} size="sm" />}
                      onClick={event => {
                        event.stopPropagation();
                        detach.detach();
                      }}
                    />
                  </Tooltip>
                )}
                {onToggleFullscreen && (
                  <Tooltip content={t(isFullscreen ? 'canvas.restorePanel' : 'canvas.maximizePanel')} placement="bottom">
                    <IconButton
                      size="sm"
                      aria-label={t(isFullscreen ? 'canvas.restorePanel' : 'canvas.maximizePanel')}
                      aria-pressed={isFullscreen}
                      icon={<Icon glyph={isFullscreen ? Minimize2 : Maximize2} size="sm" />}
                      onClick={event => {
                        event.stopPropagation();
                        onToggleFullscreen();
                      }}
                    />
                  </Tooltip>
                )}
                <Tooltip content={t('canvas.hidePanel')} placement="bottom">
                  <IconButton
                    size="sm"
                    aria-label={t('canvas.hidePanel')}
                    icon={<Icon glyph={SquareDashed} size="sm" />}
                    onClick={event => {
                      event.stopPropagation();
                      hideSessionAuxPane();
                    }}
                  />
                </Tooltip>
              </>
            )}
            onInteraction={handleInteraction}
            onBeforeClose={handleBeforeClose}
            terminalResizeSuspended={terminalResizeSuspended}
            missionControlEnabled={false}
            emptyState={(
              <div
                className="openbitfun-aux-pane__empty-state"
                data-openbitfun-component="aux-pane"
                data-openbitfun-part="emptyState"
              >
                {t('canvas.noContentOpen')}
              </div>
            )}
          />
        )}
      </div>
    );
  }
);

AuxPane.displayName = 'AuxPane';

export default AuxPane;
