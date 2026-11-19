import type { DialogTurn, FlowTextItem, FlowToolItem, Session } from '@/flow_chat/types/flow-chat';
import { projectEffectiveToolItem } from '@/flow_chat/utils/toolInvocationIdentity';
import { splitFilePathAndContent } from '@/shared/utils/partialJsonParser';
import { isCodexVisualUri, visualReplyParts, visualArtifactUri, visualReceiptPath } from './reference';

/** Some models replace the content-reference marker with prose. Recover only
 * completed figure receipts preceding the final answer in this exact turn. */
export function missingInlineFigures(turn: DialogTurn | undefined, reply: FlowTextItem): string[] {
  if (turn?.status !== 'completed' || reply.status !== 'completed' || reply.isStreaming) return [];
  const lastRound = turn.modelRounds[turn.modelRounds.length - 1];
  const lastText =
    lastRound &&
    [...lastRound.items]
      .reverse()
      .find((item) => item.type === 'text' && item.subagentSessionId === reply.subagentSessionId);
  if (lastText?.id !== reply.id) return [];
  const generated = new Set<string>();
  const displayed = new Set<string>();
  for (const round of turn.modelRounds) {
    for (const item of round.items) {
      if (item.subagentSessionId !== reply.subagentSessionId) continue;
      if (item.type === 'text') {
        for (const part of visualReplyParts(typeof item.content === 'string' ? item.content : '')) {
          if (typeof part !== 'string') displayed.add(part.path);
        }
        if (item.id === reply.id) {
          const published = turn.publishedFigures;
          return [...generated].filter(uri => !displayed.has(uri) && (!published || Object.prototype.hasOwnProperty.call(published, uri)));
        }
      }
      if (
        item.type !== 'tool' ||
        item.importedSource ||
        item.status !== 'completed' ||
        !item.toolResult?.success
      )
        continue;
      const effective = projectEffectiveToolItem(item);
      const uri = visualReceiptPath(effective.toolResult?.result);
      if (
        typeof uri === 'string' &&
        isCodexVisualUri(uri) &&
        (effective.toolName === 'Write' || effective.toolName === 'Edit')
      )
        generated.add(uri);
    }
  }
  return [];
}

/** A script can generate an inline figure directly. Its final reply anchors the
 * host snapshot and scopes bindings to results preceding that reply. */
export function publishedFigureReply(turn: DialogTurn, textId: string, uri: string) {
  if (turn.status !== 'completed' || !Object.prototype.hasOwnProperty.call(turn.publishedFigures ?? {}, uri)) return;
  for (const round of [...turn.modelRounds].reverse()) {
    const text = [...round.items].reverse().find((item): item is FlowTextItem =>
      item.type === 'text' && !item.subagentSessionId);
    if (text) return text.id === textId ? text : undefined;
  }
}

export function findVisualWrite(
  session: Session | undefined,
  textId: string,
  uri: string,
  turnId?: string,
): FlowToolItem | undefined {
  if (!session || !visualArtifactUri.test(uri)) return;
  for (const turn of session.dialogTurns) {
    if (turnId && turn.id !== turnId) continue;
    const writes = new Map<string | undefined, FlowToolItem>();
    for (const round of turn.modelRounds) {
      for (const item of round.items) {
        if (item.type === 'text' && item.id === textId) return writes.get(item.subagentSessionId);
        if (
          item.type !== 'tool' ||
          item.importedSource ||
          item.status !== 'completed' ||
          !item.toolResult?.success
        )
          continue;
        if (visualReceiptPath(item.toolResult.result) !== uri) continue;
        const effective = projectEffectiveToolItem(item);
        // A follow-up turn can edit an existing session figure without another
        // Write. Its own full receipt is sufficient to replay that turn.
        if (
          effective.toolName === 'Write' ||
          (!writes.has(item.subagentSessionId) &&
            effective.toolName === 'Edit' &&
            isCodexVisualUri(uri) &&
            effective.toolCall.input?.file_path === effective.toolResult?.result?.file_path &&
            typeof effective.toolResult?.result?.visualization_source === 'string')
        ) {
          writes.set(item.subagentSessionId, item);
        }
      }
    }
  }
}

export function readVisualWrite(item: FlowToolItem | undefined, uri: string): string | undefined {
  if (!item) return;
  const { toolName, toolCall, toolResult } = projectEffectiveToolItem(item);
  const result = toolResult?.result;
  if (result?.visualization_checked === false) return;
  if (result?.visualization_checked === true && result.visualization_rendered_source !== undefined &&
      visualReceiptPath(result) === uri && isCodexVisualUri(uri)) {
    return readRecordedSource(result.visualization_rendered_source, result.visualization_rendered_bytes);
  }
  if (toolName === 'Edit') {
    if (
      !isCodexVisualUri(uri) ||
      visualReceiptPath(result) !== uri ||
      toolCall.input?.file_path !== result?.file_path
    ) return;
    return readRecordedSource(result.visualization_source, result.content_bytes);
  }
  const parts = splitFilePathAndContent(toolCall.input?.payload);
  if (
    visualReceiptPath(result) !== uri ||
    !parts ||
    parts.filePath !== result?.file_path ||
    typeof parts.content !== 'string' ||
    parts.content.length > 1024 * 1024
  )
    return;
  const bytes = new TextEncoder().encode(parts.content).length;
  if (bytes <= 1024 * 1024 && bytes === (result?.content_bytes ?? result?.bytes_written))
    return parts.content;
}

function readRecordedSource(source: unknown, expectedBytes: unknown) {
  if (typeof source !== 'string' || source.length > 1024 * 1024) return;
  const bytes = new TextEncoder().encode(source).length;
  if (bytes <= 1024 * 1024 && bytes === expectedBytes) return source;
}

/** Stop at the reply. A later edit to the same filename cannot rewrite history. */
export function readVisualRevision(
  session: Session | undefined,
  write: FlowToolItem | FlowTextItem | undefined,
  textId: string,
  uri: string,
) {
  if (!write) return;
  const turn = session?.dialogTurns.find(t => t.modelRounds.some(round => round.items.includes(write)));
  if (turn && publishedFigureReply(turn, textId, uri)) {
    const snapshot = turn.publishedFigures?.[uri];
    return readRecordedSource(snapshot?.source, snapshot?.contentBytes);
  }
  if (write.type !== 'tool') return;
  let source = readVisualWrite(write, uri);
  if (!source || !isCodexVisualUri(uri)) return source;
  let afterWrite = false;
  for (const round of turn?.modelRounds ?? []) {
    for (const item of round.items) {
      if (item === write) {
        afterWrite = true;
        continue;
      }
      if (!afterWrite || item.subagentSessionId !== write.subagentSessionId) continue;
      if (item.type === 'text' && item.id === textId) return source;
      if (
        item.type !== 'tool' ||
        item.importedSource ||
        item.status !== 'completed' ||
        !item.toolResult?.success
      )
        continue;
      const edit = projectEffectiveToolItem(item);
      const input = edit.toolCall.input,
        result = edit.toolResult?.result;
      if (
        edit.toolName !== 'Edit' ||
        visualReceiptPath(result) !== uri ||
        input?.file_path !== result?.file_path
      ) continue;
      if (result.visualization_checked === false) return;
      if (result.visualization_checked === true && result.visualization_rendered_source !== undefined) {
        source = readRecordedSource(result.visualization_rendered_source, result.visualization_rendered_bytes);
        if (!source) return;
        continue;
      }
      if (typeof result.visualization_source === 'string') {
        source = readRecordedSource(result.visualization_source, result.content_bytes);
        continue;
      }
      // Exact replacements can also be recovered from older Edit records.
      if (
        source === undefined ||
        !result.old_string ||
        typeof result.old_string !== 'string' ||
        typeof result.new_string !== 'string' ||
        input.old_string !== result.old_string ||
        input.new_string !== result.new_string
      )
        return;
      const pieces: string[] = source.split(result.old_string);
      const count = pieces.length - 1;
      if (count !== result.match_count || count < 1 || (count !== 1 && !input.replace_all)) return;
      if (source.length + count * (result.new_string.length - result.old_string.length) > 1024 * 1024) return;
      source = pieces.join(result.new_string);
      if (new TextEncoder().encode(source).length > 1024 * 1024) return;
    }
  }
}
