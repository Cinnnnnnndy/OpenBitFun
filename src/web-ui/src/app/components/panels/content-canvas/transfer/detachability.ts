/**
 * Which canvas tabs survive a window change.
 *
 * A detached window is a fresh renderer: it reloads the app and starts with no
 * live host sessions. Content that only reads files, or that owns its own
 * surface, rehydrates from the transferred scope; content bound to a per-window
 * runtime (a PTY, a flow-chat session, a git store, a review workspace) would
 * come back empty or half-wired, so it blocks the move instead of rendering a
 * broken tab.
 */

import type { PanelContent, PanelContentType } from '../types';

/**
 * Self-contained or file-backed content. These resolve from the transferred
 * scope alone plus the shared filesystem/host API.
 */
export const DETACHABLE_CONTENT_TYPES: readonly PanelContentType[] = [
  'code-preview',
  'code-viewer',
  'code-editor',
  'markdown-viewer',
  'markdown-editor',
  'text-viewer',
  'file-viewer',
  'image-viewer',
  'pdf-viewer',
  'diff-code-editor',
  'plan-viewer',
  'browser',
  'html-preview',
];

export function isDetachableContentType(type: PanelContentType): boolean {
  return DETACHABLE_CONTENT_TYPES.includes(type);
}

export interface DetachBlocker {
  id: string;
  title: string;
  type: PanelContentType;
}

/**
 * Content types this feature has not migrated yet, grouped by the runtime state
 * that keeps them pinned to the docking window. Used for copy, not behaviour.
 */
export const NON_DETACHABLE_REASON_KEYS: Partial<Record<PanelContentType, string>> = {
  terminal: 'canvas.detachBlockedTerminal',
  'background-command-output': 'canvas.detachBlockedTerminal',
  'ai-session': 'canvas.detachBlockedSession',
  'btw-session': 'canvas.detachBlockedSession',
  'task-detail': 'canvas.detachBlockedSession',
  'thinking-detail': 'canvas.detachBlockedSession',
  'session-usage': 'canvas.detachBlockedSession',
  'git-diff': 'canvas.detachBlockedGit',
  'git-graph': 'canvas.detachBlockedGit',
  'git-branch-history': 'canvas.detachBlockedGit',
  'git-settings': 'canvas.detachBlockedGit',
  'review-platform': 'canvas.detachBlockedReview',
  'review-platform-pr-detail': 'canvas.detachBlockedReview',
};

/**
 * Visible tabs that cannot move. Hidden tabs are ignored: they are not on
 * screen, so they must not silently block an action the user just triggered.
 */
export function findDetachBlockers(
  tabs: readonly { id: string; isHidden?: boolean; content: PanelContent }[],
): DetachBlocker[] {
  return tabs
    .filter(tab => !tab.isHidden && !isDetachableContentType(tab.content.type))
    .map(tab => ({ id: tab.id, title: tab.content.title, type: tab.content.type }));
}
