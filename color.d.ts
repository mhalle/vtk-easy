/**
 * vtk-easy/color — CSS Color Level 4 strings to sRGB tuples for vtk.js
 *
 * Converts any CSS color (named, hex, rgb(), hsl(), oklch(), etc.) to
 * sRGB components in 0–1 range. vtk.js passes colors to WebGL which
 * assumes an sRGB framebuffer, so sRGB is the correct target space.
 *
 * Usage:
 *   import { rgb, rgba } from 'vtk-easy/color';
 *   actor.property.color = rgb('tomato');
 */

/**
 * Parse any CSS color string and return [r, g, b] in 0–1 range.
 *
 *   rgb('tomato')              // [0.996, 0.388, 0.278]
 *   rgb('#4a90d9')             // [0.290, 0.565, 0.851]
 *   rgb('hsl(210, 80%, 50%)')  // [0.100, 0.500, 0.900]
 */
export function rgb(cssColor: string): [number, number, number];

/**
 * Parse any CSS color string and return [r, g, b, a] in 0–1 range.
 * Alpha comes from the string if present, or from the optional second arg
 * (which overrides string alpha). Defaults to 1 if neither is specified.
 *
 *   rgba('tomato')                  // [0.996, 0.388, 0.278, 1]
 *   rgba('tomato', 0.5)            // [0.996, 0.388, 0.278, 0.5]
 *   rgba('rgba(255, 99, 71, 0.3)') // [1, 0.388, 0.278, 0.3]
 */
export function rgba(cssColor: string, alpha?: number): [number, number, number, number];
