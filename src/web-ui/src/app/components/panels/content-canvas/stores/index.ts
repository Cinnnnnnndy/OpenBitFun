/**
 * Unified exports for stores module.
 */

export {
  CanvasStoreModeContext,
  useCanvasStore,
  useAgentCanvasStore,
  useGitCanvasStore,
  useBottomTerminalCanvasStore,
  useGroupTabs,
  useActiveTabId,
  useLayout,
  useDragging,
  switchAgentCanvasScope,
  clearAgentCanvasForPeerSwitch,
  readAgentCanvasScopeState,
  applyAgentCanvasScopeState,
  releaseAgentCanvasScope,
} from './canvasStore';
export type { CanvasStoreState } from './canvasStore';
