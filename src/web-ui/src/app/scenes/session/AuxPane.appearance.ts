import type { AppearanceSurfaceDescriptor } from '@/infrastructure/appearance';
export const auxPaneAppearanceDescriptor: AppearanceSurfaceDescriptor = {
  id: 'aux-pane',
  parts: [
    { id: 'root' },
    { id: 'emptyState' },
    { id: 'detachedPlaceholder' },
  ],
  states: [
    { id: 'detached', selector: { kind: 'self', suffix: '[data-openbitfun-state~="detached"]' } },
  ],
};
