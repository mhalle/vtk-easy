// DefineFilter demo — custom jitter filter defined with ez.defineFilter
//
// Adds random displacement to each point in a polydata mesh.
// Demonstrates: defineFilter, props, pipeline integration, GUI.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import GUI from 'lil-gui';
import ez from 'vtk-easy';

// --- define a custom filter ---

const vtkJitterFilter = ez.defineFilter({
  name: 'vtkJitterFilter',
  props: {
    amplitude: ez.prop(0.1, { min: 0, max: 2, description: 'Displacement magnitude per vertex' }),
    seed: ez.prop(42, { validate: v => Math.floor(Math.abs(v)), description: 'Pseudo-random seed' }),
  },
  requestData(publicAPI, model, inData, outData) {
    const input = inData[0];
    if (!input) return;

    const inPts = input.getPoints().getData();
    const outPts = new Float32Array(inPts.length);

    // Simple seeded pseudo-random
    let s = model.seed;
    function rand() {
      s = (s * 16807 + 0) % 2147483647;
      return (s / 2147483647) * 2 - 1;  // -1 to 1
    }

    for (let i = 0; i < inPts.length; i += 3) {
      outPts[i]     = inPts[i]     + model.amplitude * rand();
      outPts[i + 1] = inPts[i + 1] + model.amplitude * rand();
      outPts[i + 2] = inPts[i + 2] + model.amplitude * rand();
    }

    const output = outData[0]?.initialize() || vtkPolyData.newInstance();
    output.shallowCopy(input);
    output.getPoints().setData(outPts, 3);
    outData[0] = output;
  },
});

// --- scene ---

const view = ez.create(vtkFullScreenRenderWindow, { background: [0.1, 0.1, 0.2] });

const sphere = ez.create(vtkSphereSource, {
  thetaResolution: 40,
  phiResolution: 40,
});

const jitter = vtkJitterFilter.newInstance({ amplitude: 0.05 });

const actor = ez.pipeline(sphere)
  .filter(jitter)
  .actor({ property: { color: [0.4, 0.8, 0.5], edgeVisibility: true } });

view.add(actor);
view.renderer.resetCamera();
view.renderWindow.render();

// --- GUI ---

const gui = new GUI();
const params = { amplitude: 0.05, seed: 42, phiResolution: 40 };

function render() { view.renderWindow.render(); }

gui.add(params, 'amplitude', 0, 0.5, 0.01).name('Jitter amplitude').onChange((v) => {
  jitter.setAmplitude(v);
  render();
});
gui.add(params, 'seed', 1, 1000, 1).name('Random seed').onChange((v) => {
  jitter.setSeed(v);
  render();
});
gui.add(params, 'phiResolution', 4, 80, 1).name('Sphere resolution').onChange((v) => {
  sphere.phiResolution = v;
  sphere.thetaResolution = v;
  render();
});
