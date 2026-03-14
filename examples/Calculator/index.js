// Calculator + WarpScalar — WORKS WITH CAVEATS
// Branching pipeline with shared lookup table. Caveats: formula setup,
// lookup table configuration, and formula validation stay raw.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import macro from '@kitware/vtk.js/macros';
import vtkCalculator from '@kitware/vtk.js/Filters/General/Calculator';
import vtkDataSet from '@kitware/vtk.js/Common/DataModel/DataSet';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkLookupTable from '@kitware/vtk.js/Common/Core/LookupTable';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPlaneSource from '@kitware/vtk.js/Filters/Sources/PlaneSource';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkWarpScalar from '@kitware/vtk.js/Filters/General/WarpScalar';
import GUI from 'lil-gui';
import ez from 'vtk-easy';
const { ColorMode, ScalarMode } = vtkMapper;
const { FieldDataTypes } = vtkDataSet;
const { vtkErrorMacro } = macro;

let formulaIdx = 0;
const FORMULA = [
  '((x[0] - 0.5) * (x[0] - 0.5)) + ((x[1] - 0.5) * (x[1] - 0.5)) + 0.125',
  '0.25 * Math.sin(Math.sqrt(((x[0] - 0.5) * (x[0] - 0.5)) + ((x[1] - 0.5) * (x[1] - 0.5)))*50)',
];

const view = ez.create(vtkFullScreenRenderWindow);

// Lookup table and filter setup (raw — domain-specific)
const lookupTable = vtkLookupTable.newInstance({ hueRange: [0.666, 0] });

const planeSource = ez.create(vtkPlaneSource, { xResolution: 25, yResolution: 25 });

const simpleFilter = vtkCalculator.newInstance();
simpleFilter.setFormulaSimple(FieldDataTypes.POINT, [], 'z',
  (x) => (x[0] - 0.5) * (x[0] - 0.5) + (x[1] - 0.5) * (x[1] - 0.5) + 0.125
);
simpleFilter.setInputConnection(planeSource.outputPort);

const warpScalar = ez.create(vtkWarpScalar);
warpScalar.setInputArrayToProcess(0, 'z', 'PointData', 'Scalars');

// Pipeline 1: flat plane colored by z
const wrappedFilter = ez.wrap(simpleFilter);
const planeActor = wrappedFilter
  .mapper(vtkMapper, {
    interpolateScalarsBeforeMapping: true,
    useLookupTableScalarRange: true,
    lookupTable,
    colorMode: ColorMode.DEFAULT,
    scalarMode: ScalarMode.DEFAULT,
  })
  .actor({ property: { edgeVisibility: true } });

// Pipeline 2: warped surface — branches from same calculator
const warpActor = wrappedFilter
  .pipe(warpScalar)
  .mapper(vtkMapper, {
    interpolateScalarsBeforeMapping: true,
    useLookupTableScalarRange: true,
    lookupTable,
  })
  .actor();

view.add(planeActor, warpActor);

view.renderer.resetCamera();
view.renderWindow.render();

// --- GUI ---

const gui = new GUI();
const params = {
  xResolution: 50, yResolution: 50, scaleFactor: 1,
  planeVisible: true, formula: FORMULA[0], min: 0, max: 1,
};

function render() { view.renderWindow.render(); }

function updateScalarRange() {
  const min = Number(params.min);
  const max = Number(params.max);
  if (!Number.isNaN(min) && !Number.isNaN(max)) {
    lookupTable.setMappingRange(min, max);
    render();
  }
}

function applyFormula() {
  const formulaStr = params.formula;
  let fn = null;
  try {
    fn = new Function('x,y', `return ${formulaStr}`);
  } catch (exc) {
    if (!('name' in exc && exc.name === 'SyntaxError')) vtkErrorMacro(`Unexpected exception ${exc}`);
    return;
  }
  if (fn) {
    const formulaObj = simpleFilter.createSimpleFormulaObject(FieldDataTypes.POINT, [], 'z', fn);
    planeSource.update();
    const arraySpec = formulaObj.getArrays(planeSource.getOutputData());
    const testData = vtkPolyData.newInstance();
    const testPts = vtkPoints.newInstance({ name: 'coords', numberOfComponents: 3, size: 3, values: [0, 0, 0] });
    testData.setPoints(testPts);
    const testOut = vtkPolyData.newInstance();
    testOut.shallowCopy(testData);
    const testArrays = simpleFilter.prepareArrays(arraySpec, testData, testOut);
    try {
      formulaObj.evaluate(testArrays.arraysIn, testArrays.arraysOut);
      simpleFilter.setFormula(formulaObj);
      simpleFilter.update();
      const [min, max] = simpleFilter.getOutputData().getPointData().getScalars().getRange();
      params.min = min;
      params.max = max;
      lookupTable.setMappingRange(min, max);
      render();
    } catch (exc) {
      vtkErrorMacro(`Unexpected exception ${exc}`);
    }
  }
}

gui.add(params, 'xResolution', 2, 100, 1).name('X resolution').onChange((value) => {
  planeSource.xResolution = Number(value);
  render();
});
gui.add(params, 'yResolution', 2, 100, 1).name('Y resolution').onChange((value) => {
  planeSource.yResolution = Number(value);
  render();
});
gui.add(params, 'scaleFactor', 0, 2, 0.1).name('Displacement scale').onChange((value) => {
  warpScalar.scaleFactor = Number(value);
  render();
});
gui.add(params, 'planeVisible').name('Plane visibility').onChange((value) => {
  planeActor.visibility = !!value;
  render();
});
gui.add(params, 'formula').name('Formula').onFinishChange(() => applyFormula());

const rangeFolder = gui.addFolder('Scalar range');
rangeFolder.add(params, 'min').name('Min').onFinishChange(() => updateScalarRange());
rangeFolder.add(params, 'max').name('Max').onFinishChange(() => updateScalarRange());

gui.add({
  next: () => {
    formulaIdx = (formulaIdx + 1) % FORMULA.length;
    params.formula = FORMULA[formulaIdx];
    gui.controllers.forEach((c) => c.updateDisplay?.());
    applyFormula();
  },
}, 'next').name('Next formula');

applyFormula();
