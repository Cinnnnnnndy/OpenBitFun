import { emit, listen } from '@tauri-apps/api/event';

/** Local to the producing desktop. No relay, peer routing or selected chat is involved. */
export function listenForFigureChecks() {
  return listen<{ id: string; source: string }>('figure-check', async ({ payload }) => {
    if (!/^[0-9a-f-]{36}$/i.test(payload.id) || typeof payload.source !== 'string') return;
    let result: { Ok: string | null } | { Err: string };
    try {
      const { inspectInBackground } = await import('@/tools/visualize/backgroundInspection');
      const { materializeRegionalMaps } = await import('@/tools/visualize/regionalAtlas');
      const html = await materializeRegionalMaps(payload.source);
      const issue = await inspectInBackground(html);
      result = issue ? { Err: issue } : { Ok: html === payload.source ? null : html };
    } catch (e) {
      result = { Err: e instanceof Error ? e.message : String(e) };
    }
    await emit('figure-check-result-' + payload.id, result);
  });
}
