import patterns from './geographicRequestPatterns.json';
import { buildCodexFrame } from './codexFrameDocument';
import { watchFigureInspection, type MapPublicationCheck } from './figureInspection';
import { readBindings, inspectionBindings, usesRecordedData, type BoundValues, type FigureOwner } from './visualBindings';
import type { Session } from '@/flow_chat/types/flow-chat';
import { snapshotFigureScripts } from './figureResources';
import { localizeFigureImages } from './figureImages';
import { readFigureStyle } from './figureAppearance';

export async function inspectInBackground(source: string, snapshot?: BoundValues, publication?: MapPublicationCheck): Promise<string | null> {
  const declarations = readBindings(source);
  if (!declarations) return 'The visualization binding declaration is invalid.';
  const values = snapshot ?? inspectionBindings(declarations, undefined);
  if (!values) return 'This figure requires the producing turn’s binding snapshot.';
  const figureStyle = readFigureStyle(document.body);
  const doc = await buildCodexFrame(source, null, document.documentElement.lang, declarations, values, figureStyle);
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
  frame.style.colorScheme = figureStyle['color-scheme'];
  let kitPort: MessagePort | undefined;
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
      figureStyle,
      globals: { theme: figureStyle['color-scheme'] },
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
  window.addEventListener('message', ready);
  try {
    return await new Promise((resolve) => {
      watchFigureInspection(frame, resolve, publication);
      frame.srcdoc = doc;
      document.body.append(frame);
    });
  } finally {
    window.removeEventListener('message', ready);
    kitPort?.close();
    frame.remove();
  }
}

interface CheckedFigure {
  renderedSource?: string;
  bindings?: BoundValues;
  deferred?: boolean;
}

const geographicRequests = Object.values(patterns).map(({ map, schematic, itinerary }) => ({
  map: new RegExp(map, 'iu'), schematic: new RegExp(schematic, 'iu'), itinerary: new RegExp(itinerary, 'iu'),
}));

// A direct request from the producing turn also covers a generic filename
// and a fragment that omitted all map metadata. Other visualizations in a
// discussion about maps should continue to use the normal render check.
function requestsGeographicMap(message: unknown) {
  if (typeof message !== 'string') return false;
  const first = message.trim().split(/[。！？.!?\n]/u, 1)[0];
  return geographicRequests.some(({ map, schematic }) => map.test(first) && !schematic.test(first));
}

export async function inspectWrittenFigure(
  request: FigureOwner & { source: string },
  getProducer: (id: string) => Promise<Session | undefined>,
): Promise<CheckedFigure> {
  const declarations = readBindings(request.source);
  if (!declarations) throw Error('Invalid visualization bindings.');
  const entries = Object.values(declarations);
  const needsHistory = entries.some(usesRecordedData);
  const producer = request.sessionId ? await getProducer(request.sessionId) : undefined;
  let bindings = inspectionBindings(declarations, producer, request);
  if (!bindings) return { deferred: true };
  const hasImages = entries.some(entry => entry.type === 'image');
  if (hasImages) bindings = await localizeFigureImages(declarations, bindings);
  const { materializeRegionalMaps } = await import('./regionalAtlas');
  const allowPublicLookup = entries.every(entry => entry.type === 'image');
  const html = await snapshotFigureScripts(await materializeRegionalMaps(request.source, true, allowPublicLookup), declarations);
  const turn = producer?.dialogTurns.find(turn => turn.id === request.turnId);
  const mapExpected = /\/map-[^/]+\.html$/.test(request.uri) || requestsGeographicMap(turn?.userMessage?.content);
  let itineraryExpected = false;
  if (html.includes('data-visual-atlas-map')) {
    const fragment = document.createElement('template');
    fragment.innerHTML = html;
    const headings = Array.from(fragment.content.querySelectorAll('h1,h2,h3'), el => el.textContent).join(' ');
    const intent = [turn?.userMessage?.content, headings].join(' ');
    itineraryExpected = geographicRequests.some(({ itinerary }) => itinerary.test(intent));
  }
  const issue = await inspectInBackground(html, bindings, { mapExpected, itineraryExpected });
  if (issue) throw Error(issue);
  return {
    renderedSource: html === request.source ? undefined : html,
    bindings: needsHistory || hasImages ? bindings : undefined,
  };
}
