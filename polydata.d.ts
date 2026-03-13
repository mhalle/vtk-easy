import type { Wrapped } from './index.js';

/** Data array spec: plain array (1 component) or { data, components } for vectors. */
type DataArraySpec = number[] | Float32Array | { data: number[] | Float32Array; components: number };

interface PolyDataConfig {
  /** Point coordinates — flat [x,y,z,...], nested [[x,y,z],...], or Float32Array. */
  points: number[] | number[][] | Float32Array;
  /** Polygon cells — flat (groups of 3), nested, {size, data}, or Uint32Array. */
  polys?: number[] | number[][] | { size: number; data: number[] } | Uint32Array;
  /** Line cells — flat (groups of 2), nested, {size, data}, or Uint32Array. */
  lines?: number[] | number[][] | { size: number; data: number[] } | Uint32Array;
  /** Vertex cells — flat (groups of 1), nested, {size, data}, or Uint32Array. */
  verts?: number[] | number[][] | { size: number; data: number[] } | Uint32Array;
  /** Triangle strip cells — nested or {size, data} (no default group size). */
  strips?: number[][] | { size: number; data: number[] } | Uint32Array;
  /** Per-point data arrays. */
  pointData?: Record<string, DataArraySpec>;
  /** Per-cell data arrays. */
  cellData?: Record<string, DataArraySpec>;
}

/**
 * Build a vtkPolyData from plain arrays.
 *
 *   import { polyData } from 'vtk-easy/polydata';
 *   const tri = polyData({
 *     points: [0,0,0, 1,0,0, 0.5,1,0],
 *     polys: [0, 1, 2],
 *   });
 */
export function polyData(config: PolyDataConfig): Wrapped;
export default polyData;
