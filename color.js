// vtk-easy/color — CSS color strings to vtk.js [r, g, b] tuples
//
// Converts any CSS Color Level 4 string to sRGB components in 0–1 range.
// vtk.js passes color values straight to WebGL, which assumes an sRGB
// framebuffer, so sRGB is the correct target space.
//
// Separate entry point so culori is only bundled if you use it.
//
// Usage:
//   import { rgb, rgba } from 'vtk-easy/color';
//   actor.property.color = rgb('tomato');
//   actor.property.color = rgb('hsl(210, 80%, 50%)');

import { parse, converter } from 'culori';

const toSrgb = converter('rgb');

/**
 * Parse any CSS color string and return [r, g, b] in 0–1 range.
 *
 *   rgb('tomato')              // [0.996, 0.388, 0.278]
 *   rgb('#4a90d9')             // [0.290, 0.565, 0.851]
 *   rgb('hsl(210, 80%, 50%)')  // [0.100, 0.500, 0.900]
 *   rgb('oklch(0.7 0.15 210)') // [r, g, b]
 */
export function rgb(cssColor) {
  const parsed = parse(cssColor);
  if (!parsed) throw new Error(`Invalid color: ${cssColor}`);
  const c = toSrgb(parsed);
  return [c.r, c.g, c.b];
}

/**
 * Parse any CSS color string and return [r, g, b, a] in 0–1 range.
 * Alpha comes from the string if present, or from the optional second arg,
 * which overrides any string alpha. Defaults to 1 if neither is specified.
 *
 *   rgba('tomato')                 // [0.996, 0.388, 0.278, 1]
 *   rgba('tomato', 0.5)           // [0.996, 0.388, 0.278, 0.5]
 *   rgba('rgba(255, 99, 71, 0.3)') // [1, 0.388, 0.278, 0.3]
 *   rgba('rgba(255, 99, 71, 0.3)', 0.8) // [1, 0.388, 0.278, 0.8]
 */
export function rgba(cssColor, alpha) {
  const parsed = parse(cssColor);
  if (!parsed) throw new Error(`Invalid color: ${cssColor}`);
  const c = toSrgb(parsed);
  const a = alpha !== undefined ? alpha : (c.alpha !== undefined ? c.alpha : 1);
  return [c.r, c.g, c.b, a];
}
