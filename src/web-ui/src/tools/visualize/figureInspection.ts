// The listener is scoped to one frame/document, including cancellation on retry or unmount.
export function watchFigureInspection(frame: HTMLIFrameElement, done: (issue: string | null) => void) {
  let port: MessagePort | undefined;
  const stop = () => {
    window.clearTimeout(timer);
    window.removeEventListener('message', receive);
    port?.close();
  };
  const finish = (issue: string | null) => {
    stop();
    done(issue);
  };
  const timer = window.setTimeout(() => finish('The visualization renderer did not finish loading.'), 12000);
  function receive(e: MessageEvent) {
    if (
      e.source !== frame.contentWindow ||
      e.data?.openBitFunVisual !== 2 ||
      e.data.type !== 'inspect-render' ||
      !e.ports[0] ||
      port
    )
      return;
    port = e.ports[0];
    port.onmessage = ({ data }) => {
      if (data === null || typeof data === 'string') finish(data);
    };
    port.postMessage('inspect');
  }
  window.addEventListener('message', receive);
  return stop;
}
