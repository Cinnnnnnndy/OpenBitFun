import guestTypography from './figureTypography.json';
import { cssVariables } from '@openbitfun/design-tokens';
import { themeCssVariables } from '@openbitfun/theme-openbitfun';

// Map the kit's presentation vocabulary to the colors at this figure's position in FlowChat.
// Only resolved presentation values cross into the guest. Skin stylesheets and artwork stay in the host.
const colors = {
  '--background': 'color.surface.canvas',
  '--foreground': 'color.content.primary',
  '--card': 'color.surface.panel',
  '--card-foreground': 'color.content.primary',
  '--popover': 'color.surface.raised',
  '--popover-foreground': 'color.content.primary',
  '--primary': 'color.action.primary.background',
  '--primary-foreground': 'color.action.primary.content',
  '--secondary': 'color.action.secondary.background',
  '--secondary-foreground': 'color.action.secondary.content',
  '--muted': 'color.surface.subtle',
  '--muted-foreground': 'color.content.secondary',
  '--accent': 'color.accent.surface',
  '--accent-foreground': 'color.accent.default',
  '--destructive': 'color.status.danger.content',
  '--border': 'color.border.default',
  '--input': 'color.border.strong',
  '--ring': 'color.focus.ring',
  '--viz-series-1': 'color.accent.default',
  '--viz-series-2': 'color.status.warning.content',
  '--viz-series-3': 'color.status.success.content',
  '--viz-series-4': 'color.status.danger.content',
  '--viz-series-5': 'color.accent.secondary',
  '--viz-series-6': 'color.status.info.content',
} as const satisfies Record<string, keyof typeof themeCssVariables>;

// Both the read-only HTML viewer and the live kit consume these guest font aliases.
const typographySources: Record<string, { property: string; variable: string }> = {
  body: { property: 'font-family', variable: cssVariables['type.flow.body.fontFamily'] },
  code: { property: 'font-family', variable: cssVariables['type.flow.code.fontFamily'] },
  size: { property: 'font-size', variable: cssVariables['type.flow.body.fontSize'] },
};
const typography = Object.entries(guestTypography).map(([name, role]) => ({ name, ...typographySources[role] }));
export const staticFigureTypography = '@layer visualize-base {:root{' +
  typography.map(({ name, variable }) => name + ':var(' + variable + ')').join(';') + '}}';

export function readFigureStyle(host: HTMLElement): Record<string, string> {
  const style = getComputedStyle(host);
  const resolved: Record<string, string> = {};
  for (const [name, token] of Object.entries(colors)) {
    const value = style.getPropertyValue(themeCssVariables[token]).trim();
    if (value && CSS.supports('color', value)) resolved[name] = value;
  }
  for (const { name, property, variable } of typography) {
    const value = style.getPropertyValue(variable).trim();
    if (value && CSS.supports(property, value)) resolved[name] = value;
  }
  return resolved;
}
