import { describe, expect, it } from 'vitest';
import {
  DETACHABLE_CONTENT_TYPES,
  NON_DETACHABLE_REASON_KEYS,
  findDetachBlockers,
  isDetachableContentType,
} from './detachability';
import type { PanelContent, PanelContentType } from '../types';

function tab(id: string, type: PanelContentType, title = id, isHidden = false) {
  return { id, isHidden, content: { type, title } as PanelContent };
}

describe('canvas detachability', () => {
  it('allows file-backed and self-contained content', () => {
    ['code-editor', 'markdown-viewer', 'image-viewer', 'browser', 'html-preview'].forEach(type => {
      expect(isDetachableContentType(type as PanelContentType)).toBe(true);
    });
  });

  it('keeps content bound to a per-window runtime in the docking window', () => {
    ['terminal', 'background-command-output', 'ai-session', 'btw-session', 'git-graph', 'review-platform'].forEach(type => {
      expect(isDetachableContentType(type as PanelContentType)).toBe(false);
    });
  });

  it('reports nothing to block when every visible tab is portable', () => {
    expect(findDetachBlockers([
      tab('a', 'code-editor'),
      tab('b', 'browser'),
    ])).toEqual([]);
  });

  it('names the visible tab that blocks the move', () => {
    const blockers = findDetachBlockers([
      tab('a', 'code-editor'),
      tab('b', 'terminal', 'Terminal 1'),
    ]);
    expect(blockers).toEqual([{ id: 'b', title: 'Terminal 1', type: 'terminal' }]);
    expect(NON_DETACHABLE_REASON_KEYS.terminal).toBe('canvas.detachBlockedTerminal');
  });

  it('does not let a hidden tab block an action the user just triggered', () => {
    expect(findDetachBlockers([
      tab('a', 'code-editor'),
      tab('b', 'terminal', 'Hidden terminal', true),
    ])).toEqual([]);
  });

  it('offers a reason key for every content type it refuses', () => {
    const refused = ['terminal', 'background-command-output', 'ai-session', 'btw-session', 'task-detail',
      'thinking-detail', 'session-usage', 'git-diff', 'git-graph', 'git-branch-history', 'git-settings',
      'review-platform', 'review-platform-pr-detail'] as PanelContentType[];
    refused.forEach(type => {
      expect(isDetachableContentType(type)).toBe(false);
      expect(NON_DETACHABLE_REASON_KEYS[type]).toMatch(/^canvas\.detachBlocked/);
      expect(DETACHABLE_CONTENT_TYPES).not.toContain(type);
    });
  });
});
