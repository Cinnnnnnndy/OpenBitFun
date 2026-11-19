// This script starts before the fragment executes. Return evidence over a private
// port so application messages and authored postMessage traffic cannot finish a check.
(() => {
  const channel = new MessageChannel();
  const reply = channel.port1;
  const issues = [];
  const bound = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  function error(event) {
    const el = event.target;
    if (el instanceof HTMLLinkElement && ['preload', 'modulepreload'].includes(el.rel)) return;
    if (event.message || el?.matches?.('script[src], link[rel=stylesheet], img[src]')) {
      issues.push(
        String(event.message || 'Could not load ' + (el.getAttribute('src') || el.href)).slice(0, 240),
      );
    }
  }
  const rejection = (e) => issues.push(String(e.reason?.message || e.reason).slice(0, 240));
  addEventListener('error', error, true);
  addEventListener('unhandledrejection', rejection);
  parent.postMessage({ openBitFunVisual: 2, type: 'inspect-render' }, '*', [channel.port2]);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function sampleCanvas(el) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 64;
    const ctx = probe.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(el, 0, 0, 64, 64);
    return ctx.getImageData(0, 0, 64, 64).data.join(',');
  }
  function motion(el) {
    if (el instanceof HTMLCanvasElement) return sampleCanvas(el);
    const r = el.getBoundingClientRect();
    return [
      el.outerHTML,
      ...[el, ...el.querySelectorAll('*')].map((e) => getComputedStyle(e).transform),
      r.x,
      r.y,
      r.width,
      r.height,
    ].join('|');
  }
  function inspect() {
    if (issues.length) return issues[0];
    if (document.readyState === 'loading') return 'Markup is still loading';
    const map = document.querySelector('[data-visual-map]');
    if (map) {
      const shapes = [...map.querySelectorAll('[data-visual-region], path[d], polygon[points]')];
      if (
        !shapes.some(
          (el) => bound(el) && (el instanceof SVGGeometryElement ? el.getTotalLength() > 0 : false),
        )
      ) {
        return 'The map has no visible projected geometry. Embed the basemap and check its projection.';
      }
      for (const marker of map.querySelectorAll('[data-visual-marker]')) {
        if (!bound(marker)) return 'A required map marker or label is hidden or unprojected.';
      }
    }
    for (const e of document.body.children) {
      if (
        !e.matches('script,style,link,template,noscript') &&
        bound(e) &&
        (e.innerText?.trim() ||
          e.matches('svg,canvas,img,input,button') ||
          e.childElementCount ||
          getComputedStyle(e).backgroundImage !== 'none' ||
          e.shadowRoot)
      )
        return '';
    }
    return 'The fragment produced no visible content.';
  }
  async function run() {
    let issue;
    const start = Date.now();
    do {
      await delay(100);
      issue = inspect();
    } while (issue && !issues.length && Date.now() - start < 5500);
    if (!issue && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const movers = [...document.querySelectorAll('[data-visual-motion]')].filter(bound);
      if (movers.length) {
        const first = movers.map(motion);
        let moving = false;
        for (const ms of [135, 310, 700]) {
          await delay(ms);
          if (movers.some((el, i) => motion(el) !== first[i])) {
            moving = true;
            break;
          }
        }
        if (!moving)
          issue = 'The marked simulation is stationary. Check its animation target and startup state.';
      }
    }
    return issues[0] || issue || null;
  }
  reply.onmessage = async () => {
    reply.onmessage = null;
    try {
      reply.postMessage(await run());
    } catch (e) {
      reply.postMessage(String(e?.message || e).slice(0, 240));
    } finally {
      removeEventListener('error', error, true);
      removeEventListener('unhandledrejection', rejection);
      reply.close();
    }
  };
})();
