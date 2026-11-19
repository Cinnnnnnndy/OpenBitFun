import type { FlowItem, FlowTextItem, FlowToolItem } from '../types/flow-chat';
import { READ_TOOL_NAMES, SEARCH_TOOL_NAMES } from '../tool-cards/toolCardMetadata';
import { splitFilePathAndContent } from '@/shared/utils/partialJsonParser';
import { isCodexVisualUri, visualArtifactUri, visualSidecarUri, visualReceiptPath } from '@/tools/visualize/reference';
import { DEFERRED_TOOL_GATEWAY_NAME, projectEffectiveToolItem } from './toolInvocationIdentity';

/** Shared by leaf cards and transcript composition so hidden cards leave no row. */
export function isToolCardVisible(toolItem: FlowToolItem): boolean {
  if (toolItem.importedSource) return true;
  const item = projectEffectiveToolItem(toolItem);
  const failed = item.status === 'error'
    || (item.status === 'completed' && item.toolResult?.success === false);
  if (failed) return !READ_TOOL_NAMES.has(item.toolName) && !SEARCH_TOOL_NAMES.has(item.toolName);

  if (item.status === 'pending_confirmation' || item.status === 'rejected' || item.status === 'cancelled'
    || (item.status !== 'completed' && (item.acpPermission || (item.requiresConfirmation && !item.userConfirmed)))) {
    return true;
  }
  if (item.isParamsStreaming && item.toolName === DEFERRED_TOOL_GATEWAY_NAME && !item.toolCall?.input?.tool_name) {
    return false;
  }
  if (item.toolName === 'Edit') {
    const path = visualReceiptPath(item.toolResult?.result) ?? item.toolCall?.input?.file_path;
    return typeof path !== 'string' || !isCodexVisualUri(path);
  }
  if (item.toolName !== 'Write') return true;

  const input = item.toolCall?.input;
  const payload = input?.payload;
  const destination = visualReceiptPath(item.toolResult?.result)
    ?? splitFilePathAndContent(payload)?.filePath
    ?? input?.file_path;
  // EarlyDetected arrives before the destination. Wait for the Write header so
  // a session figure never flashes a file card while its source is streaming.
  if (item.isParamsStreaming && (!destination || (typeof payload === 'string' && !payload.includes('\n')))) {
    return false;
  }
  return typeof destination !== 'string' || !(visualArtifactUri.test(destination) || visualSidecarUri.test(destination));
}

/** Presentation only: retain the recorded items and the identity of visible entries. */
export function isFlowItemVisible(item: FlowItem): boolean {
  if (item.type === 'text') {
    const textItem = item as FlowTextItem;
    const content = typeof textItem.content === 'string' ? textItem.content : String(textItem.content || '');
    return content.trim().length > 0;
  }
  return item.type !== 'tool' || isToolCardVisible(item as FlowToolItem);
}
