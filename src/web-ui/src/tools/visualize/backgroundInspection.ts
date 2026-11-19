import { buildCodexFrame } from './codexFrameDocument';
import { watchFigureInspection } from './figureInspection';
import { readBindings, type BoundValues } from './visualBindings';
import { readFigureStyle } from './figureAppearance';

export async function inspectInBackground(source: string): Promise<string | null> {
  const declarations = readBindings(source);
  if (!declarations) return 'The visualization binding declaration is invalid.';
  const values: BoundValues = {};
  for (const [name, entry] of Object.entries(declarations)) {
    if (entry.type === 'json') values[name] = { kind: 'json', value: entry.value };
    if (entry.type === 'image') values[name] = { kind: 'image', value: entry.url };
  }
  const doc = await buildCodexFrame(source, null, document.documentElement.lang, declarations, values);
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.allow =
    "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'";
  frame.inert = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  // Keep a real layout viewport without occupying a conversation row or taking focus.
  frame.style.cssText =
    'position:fixed;left:0;top:0;width:min(760px,100vw);height:460px;opacity:0;pointer-events:none;z-index:-1';
  const ready = (event: MessageEvent) => {
    if (
      event.source !== frame.contentWindow ||
      event.data?.openBitFunVisual !== 2 ||
      event.data.type !== 'ready'
    )
      return;
    const bridge = new MessageChannel();
    frame.contentWindow?.postMessage({ openBitFunVisual: 2, type: 'attach' }, '*', [bridge.port2]);
    bridge.port1.postMessage({
      figureStyle: readFigureStyle(document.body),
      globals: { theme: getComputedStyle(document.body).colorScheme.includes('dark') ? 'dark' : 'light' },
    });
    bridge.port1.close();
    const kit = new MessageChannel();
    kit.port1.onmessage = ({ data }) => {
      if (data.type === 'widget-state-write')
        kit.port1.postMessage({ type: 'widget-state-result', id: data.id, ok: true });
    };
    kitPort = kit.port1;
    frame.contentWindow?.postMessage({ type: 'codex-visualization-initialize' }, '*', [kit.port2]);
  };
  let kitPort: MessagePort | undefined;
  window.addEventListener('message', ready);
  try {
    return await new Promise((resolve) => {
      watchFigureInspection(frame, resolve);
      frame.srcdoc = doc;
      document.body.append(frame);
    });
  } finally {
    window.removeEventListener('message', ready);
    kitPort?.close();
    frame.remove();
  }
}
