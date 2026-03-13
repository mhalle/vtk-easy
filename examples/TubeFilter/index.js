// TubeFilter — WORKS WITH CAVEATS
// Hand-built polydata + setInputArrayToProcess stay raw.
// Pipeline wiring and GUI interaction use vtk-easy.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import Constants from '@kitware/vtk.js/Filters/General/TubeFilter/Constants';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import * as vtkMath from '@kitware/vtk.js/Common/Core/Math';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkTubeFilter from '@kitware/vtk.js/Filters/General/TubeFilter';
import { DesiredOutputPrecision } from '@kitware/vtk.js/Common/DataModel/DataSetAttributes/Constants';
import { VtkDataTypes } from '@kitware/vtk.js/Common/Core/DataArray/Constants';
import GUI from 'lil-gui';
import ez from 'vtk-easy';
const { VaryRadius } = Constants;

const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });

// --- build polydata (raw — domain-specific data construction) ---

vtkMath.randomSeed(15222);
const numSegments = 3;

function initializePolyData(dType) {
  let pointType = VtkDataTypes.FLOAT;
  if (dType === DesiredOutputPrecision.DOUBLE) pointType = VtkDataTypes.DOUBLE;

  const polyData = vtkPolyData.newInstance();
  const points = vtkPoints.newInstance({ dataType: pointType });
  points.setNumberOfPoints(numSegments + 1);
  const pointData = new Float32Array(3 * (numSegments + 1));
  const verts = new Uint32Array(2 * (numSegments + 1));
  const lines = new Uint32Array(numSegments + 2);
  lines[0] = numSegments + 1;
  const scalarsData = new Float32Array(numSegments + 1);
  const scalars = vtkDataArray.newInstance({ name: 'Scalars', values: scalarsData });

  for (let i = 0; i < numSegments + 1; ++i) {
    for (let j = 0; j < 3; ++j) pointData[3 * i + j] = vtkMath.random();
    scalarsData[i] = i * 0.1;
    verts[i] = 1;
    verts[i + 1] = i;
    lines[i + 1] = i;
  }

  points.setData(pointData);
  polyData.setPoints(points);
  polyData.getVerts().setData(verts);
  polyData.getLines().setData(lines);
  polyData.getPointData().setScalars(scalars);
  return polyData;
}

const polyData = initializePolyData(DesiredOutputPrecision.DOUBLE);

// --- tube filter (caveat: setInputArrayToProcess is imperative) ---

const tubeFilter = ez.create(vtkTubeFilter, {
  capping: false,
  numberOfSides: 50,
  radius: 0.1,
});
tubeFilter.setInputData(polyData);
tubeFilter.setInputArrayToProcess(0, 'Scalars', 'PointData', 'Scalars');

// --- pipelines ---

const rawActor = ez.pipeline(polyData).actor();
const tubeActor = ez.pipeline(tubeFilter).actor();
view.add(rawActor, tubeActor);

view.renderer.resetCamera();
view.renderWindow.render();

// --- GUI ---

const gui = new GUI();
const params = {
  tubing: true, numberOfSides: 50, radius: 0.1,
  varyRadius: 'VARY_RADIUS_OFF', capping: false, onRatio: 1,
};

function render() { view.renderWindow.render(); }

gui.add(params, 'tubing').name('Tubing').onChange((value) => {
  tubeActor.visibility = !!value;
  render();
});
gui.add(params, 'numberOfSides', 3, 100, 1).name('Number of sides').onChange((value) => {
  tubeFilter.numberOfSides = Number(value);
  render();
});
gui.add(params, 'radius', 0.01, 1.0, 0.01).name('Radius').onChange((value) => {
  tubeFilter.radius = Number(value);
  render();
});
gui.add(params, 'varyRadius', [
  'VARY_RADIUS_OFF', 'VARY_RADIUS_BY_SCALAR',
  'VARY_RADIUS_BY_VECTOR', 'VARY_RADIUS_BY_ABSOLUTE_SCALAR',
]).name('Vary radius').onChange((value) => {
  tubeFilter.varyRadius = VaryRadius[value];
  render();
});
gui.add(params, 'capping').name('Capping').onChange((value) => {
  tubeFilter.capping = !!value;
  render();
});
gui.add(params, 'onRatio', 1, 4, 1).name('OnRatio').onChange((value) => {
  tubeFilter.onRatio = Number(value);
  render();
});
