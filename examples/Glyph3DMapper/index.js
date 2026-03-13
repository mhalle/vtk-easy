// Glyph3DMapper — WORKS WITH CAVEATS
// Multi-port mapper wired manually. Caveat: calculator
// formula is imperative and domain-specific.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Glyph';
import vtkCalculator from '@kitware/vtk.js/Filters/General/Calculator';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkPlaneSource from '@kitware/vtk.js/Filters/Sources/PlaneSource';
import vtkConeSource from '@kitware/vtk.js/Filters/Sources/ConeSource';
import vtkGlyph3DMapper from '@kitware/vtk.js/Rendering/Core/Glyph3DMapper';
import vtkTransform from '@kitware/vtk.js/Common/Transform/Transform';
import { AttributeTypes } from '@kitware/vtk.js/Common/DataModel/DataSetAttributes/Constants';
import { FieldDataTypes } from '@kitware/vtk.js/Common/DataModel/DataSet/Constants';
import GUI from 'lil-gui';
import ez from 'vtk-easy';

const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });

// Calculator formula (raw — can't be declarative)
const calculator = vtkCalculator.newInstance();
calculator.setFormula({
  getArrays: () => ({
    input: [{ location: FieldDataTypes.COORDINATE }],
    output: [
      {
        location: FieldDataTypes.POINT,
        name: 'pressure',
        dataType: 'Float32Array',
        numberOfComponents: 3,
      },
      {
        location: FieldDataTypes.POINT,
        name: 'temperature',
        dataType: 'Float32Array',
        attribute: AttributeTypes.SCALARS,
        numberOfComponents: 1,
      },
    ],
  }),
  evaluate: (arraysIn, arraysOut) => {
    const [coords] = arraysIn.map((d) => d.getData());
    const [press, temp] = arraysOut.map((d) => d.getData());
    for (let i = 0, sz = coords.length / 3; i < sz; ++i) {
      press[i * 3] = (coords[3 * i] - 0.5) * (coords[3 * i] - 0.5);
      press[i * 3 + 1] = ((coords[3 * i + 1] - 0.5) * (coords[3 * i + 1] - 0.5) + 0.125) * 0.1;
      press[i * 3 + 2] = ((coords[3 * i] - 0.5) ** 2 + (coords[3 * i + 1] - 0.5) ** 2 + 0.125) * 0.1;
      temp[i] = coords[3 * i + 1] * 0.1;
    }
    arraysOut.forEach((x) => x.modified());
  },
});

const planeSource = ez.create(vtkPlaneSource);
const coneGlyph = ez.create(vtkConeSource, { resolution: 12 });

// Pipeline: plane → calculator → glyph3D mapper
const actor = ez.pipeline(planeSource)
  .filter(calculator)
  .mapper(vtkGlyph3DMapper, {
    orientationArray: 'pressure',
    scalarRange: [0.0, 0.1],
  })
  .actor();

// Wire glyph input manually (port 1)
ez.unwrap(actor).getMapper().setInputConnection(ez.unwrap(coneGlyph).getOutputPort(), 1);

view.add(actor);

// Camera transform
const transform = vtkTransform.newInstance();
transform.scale(1, 2, 1);

view.renderer.resetCamera();
view.renderer.getActiveCamera().setModelTransformMatrix(transform.getMatrix());
view.renderWindow.render();

// GUI
const gui = new GUI();
const params = { xResolution: 10, yResolution: 10 };

function render() { view.renderWindow.render(); }

gui.add(params, 'xResolution', 1, 25, 1).name('X resolution').onChange((value) => {
  planeSource.xResolution = Number(value);
  render();
});
gui.add(params, 'yResolution', 1, 25, 1).name('Y resolution').onChange((value) => {
  planeSource.yResolution = Number(value);
  render();
});
