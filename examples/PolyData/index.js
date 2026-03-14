// PolyData — colored triangle built from scratch.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import GUI from 'lil-gui';
import ez from 'vtk-easy';
import { polyData } from 'vtk-easy/polydata';

const view = ez.create(vtkFullScreenRenderWindow, { background: [0.1, 0.1, 0.15] });

let pd = polyData({
  points: [
    0.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    0.5, 1.0, 0.0,
  ],
  polys: [0, 1, 2],
  pointData: {
    colors: {
      data: [
        255, 0, 0,
        0, 255, 0,
        0, 0, 255,
      ],
      components: 3,
    },
  },
});

const actor = pd.actor();
view.add(actor);
view.renderer.resetCamera();
view.renderWindow.render();

// GUI
const gui = new GUI();
const params = {
  apexX: 0.5,
  apexY: 1.0,
  r1: 255, g1: 0, b1: 0,
  r2: 0, g2: 255, b2: 0,
  r3: 0, g3: 0, b3: 255,
};

function rebuild() {
  pd = polyData({
    points: [
      0.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      params.apexX, params.apexY, 0.0,
    ],
    polys: [0, 1, 2],
    pointData: {
      colors: {
        data: [
          params.r1, params.g1, params.b1,
          params.r2, params.g2, params.b2,
          params.r3, params.g3, params.b3,
        ],
        components: 3,
      },
    },
  });
  ez.unwrap(actor).getMapper().setInputData(ez.unwrap(pd));
  view.renderWindow.render();
}

const shape = gui.addFolder('Shape');
shape.add(params, 'apexX', -1, 2, 0.05).name('Apex X').onChange(rebuild);
shape.add(params, 'apexY', 0.1, 2, 0.05).name('Apex Y').onChange(rebuild);

const colors = gui.addFolder('Vertex Colors');
colors.add(params, 'r1', 0, 255, 1).name('V1 Red').onChange(rebuild);
colors.add(params, 'g1', 0, 255, 1).name('V1 Green').onChange(rebuild);
colors.add(params, 'b1', 0, 255, 1).name('V1 Blue').onChange(rebuild);
colors.add(params, 'r2', 0, 255, 1).name('V2 Red').onChange(rebuild);
colors.add(params, 'g2', 0, 255, 1).name('V2 Green').onChange(rebuild);
colors.add(params, 'b2', 0, 255, 1).name('V2 Blue').onChange(rebuild);
colors.add(params, 'r3', 0, 255, 1).name('V3 Red').onChange(rebuild);
colors.add(params, 'g3', 0, 255, 1).name('V3 Green').onChange(rebuild);
colors.add(params, 'b3', 0, 255, 1).name('V3 Blue').onChange(rebuild);
