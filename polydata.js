// vtk-easy/polydata — build vtkPolyData from plain arrays
//
// Separate entry point to avoid pulling in vtkPolyData, vtkCellArray,
// and vtkDataArray for users who only need the core API.
//
// Usage:
//   import { polyData } from 'vtk-easy/polydata';
//   const pd = polyData({ points: [0,0,0, 1,0,0, 1,1,0], polys: [0,1,2] });

import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData.js';
import vtkCellArray from '@kitware/vtk.js/Common/Core/CellArray.js';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray.js';
import { wrap } from './index.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function buildCellArray(input, defaultCellSize) {
  if (!input) return null;

  // Raw typed array — passthrough
  if (ArrayBuffer.isView(input)) {
    const ca = vtkCellArray.newInstance();
    ca.setData(input);
    return ca;
  }

  let cells; // array of arrays

  if (Array.isArray(input) && input.length > 0 && Array.isArray(input[0])) {
    // Array of arrays — each sub-array is a cell
    cells = input;
  } else if (input && typeof input === 'object' && !Array.isArray(input) && input.data) {
    // { size, data } — chunk flat data by explicit size
    const { size, data } = input;
    cells = [];
    for (let i = 0; i < data.length; i += size) {
      cells.push(data.slice(i, i + size));
    }
  } else if (Array.isArray(input)) {
    // Flat array — chunk by defaultCellSize
    if (defaultCellSize == null) {
      throw new Error('Flat cell array requires a default cell size (use nested arrays or {size, data})');
    }
    cells = [];
    for (let i = 0; i < input.length; i += defaultCellSize) {
      cells.push(input.slice(i, i + defaultCellSize));
    }
  } else {
    return null;
  }

  // Build size-prefixed flat format
  const flat = [];
  for (const cell of cells) {
    flat.push(cell.length, ...cell);
  }

  const ca = vtkCellArray.newInstance();
  ca.setData(new Uint32Array(flat));
  return ca;
}

function buildDataArrays(spec) {
  if (!spec) return [];
  const arrays = [];
  for (const [name, value] of Object.entries(spec)) {
    let data, numberOfComponents;
    if (value && typeof value === 'object' && !Array.isArray(value) && value.data) {
      data = value.data;
      numberOfComponents = value.components || 1;
    } else {
      data = value;
      numberOfComponents = 1;
    }
    const arr = vtkDataArray.newInstance({
      name,
      values: Array.isArray(data) ? Float32Array.from(data) : data,
      numberOfComponents,
    });
    arrays.push(arr);
  }
  return arrays;
}

// ---------------------------------------------------------------------------
// polyData
// ---------------------------------------------------------------------------

function polyData(config) {
  const { points, polys, lines, verts, strips, pointData, cellData } = config;

  // Parse points
  let pointArray;
  if (ArrayBuffer.isView(points)) {
    pointArray = points instanceof Float32Array ? points : Float32Array.from(points);
  } else if (Array.isArray(points) && points.length > 0 && Array.isArray(points[0])) {
    pointArray = Float32Array.from(points.flat());
  } else {
    pointArray = Float32Array.from(points);
  }

  const pd = vtkPolyData.newInstance();
  pd.getPoints().setData(pointArray, 3);

  // Build cell arrays
  const polysCA = buildCellArray(polys, 3);
  const linesCA = buildCellArray(lines, 2);
  const vertsCA = buildCellArray(verts, 1);
  const stripsCA = buildCellArray(strips, null);

  if (polysCA) pd.setPolys(polysCA);
  if (linesCA) pd.setLines(linesCA);
  if (vertsCA) pd.setVerts(vertsCA);
  if (stripsCA) pd.setStrips(stripsCA);

  // Auto-vert: if no cells specified, generate one vert per point
  if (!polys && !lines && !verts && !strips) {
    const numPoints = pointArray.length / 3;
    const autoVerts = [];
    for (let i = 0; i < numPoints; i++) {
      autoVerts.push(1, i);
    }
    const ca = vtkCellArray.newInstance();
    ca.setData(new Uint32Array(autoVerts));
    pd.setVerts(ca);
  }

  // Point data
  const pdArrays = buildDataArrays(pointData);
  const pdData = pd.getPointData();
  pdArrays.forEach((arr, i) => {
    if (i === 0) pdData.setScalars(arr);
    else pdData.addArray(arr);
  });

  // Cell data
  const cdArrays = buildDataArrays(cellData);
  const cdData = pd.getCellData();
  cdArrays.forEach((arr, i) => {
    if (i === 0) cdData.setScalars(arr);
    else cdData.addArray(arr);
  });

  return wrap(pd);
}

export { polyData };
export default polyData;
