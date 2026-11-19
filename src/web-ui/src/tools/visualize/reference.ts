export const visualArtifactUri =
  /^openbitfun:\/\/current-session\/artifacts\/visualizations\/(?:v2\/)?[a-z0-9][a-z0-9-]{0,95}\.html$/;

export function isCodexVisualUri(uri: string) {
  return visualArtifactUri.test(uri) && uri.includes('/visualizations/v2/');
}

/** The producing host can attest a local session path while preserving the requested file_path. */
export function visualReceiptPath(result?: { file_path?: unknown; visualization_uri?: unknown }) {
  const uri = result?.visualization_uri;
  return typeof uri === 'string' && isCodexVisualUri(uri) ? uri : result?.file_path;
}

// Content references are interpreted only as complete Markdown paragraphs.
export function readVisualReference(text: string) {
  if (!text.startsWith('visualize') || !text.endsWith('')) return;
  try {
    const ref = JSON.parse(text.slice('visualize'.length, -''.length));
    if (typeof ref?.path !== 'string' || !isCodexVisualUri(ref.path)) return;
    return {
      path: ref.path,
      title: typeof ref.title === 'string' ? ref.title : ref.path.split('/').pop()!.slice(0, -5),
      wide: ref.mode === 'wide',
    };
  } catch {
    return;
  }
}

// A file beside a v2 figure is an internal data source, including nested CSVs.
export const visualSidecarUri =
  /^openbitfun:\/\/current-session\/artifacts\/visualizations\/v2\/(?:[\w-][\w.-]*\/)*[\w-][\w.-]*$/;
