// OutlineFilter — PORTS CLEANLY
// Point cloud with bounding box outline. Branching pipeline from shared source.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkPointSource from '@kitware/vtk.js/Filters/Sources/PointSource';
import vtkOutlineFilter from '@kitware/vtk.js/Filters/General/OutlineFilter';
import * as vtkMath from '@kitware/vtk.js/Common/Core/Math';
import GUI from 'lil-gui';
import ez from 'vtk-easy';
vtkMath.randomSeed(141592);

const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
const pointSource = ez.create(vtkPointSource, { numberOfPoints: 25, radius: 0.25 });

const pointsActor = pointSource.actor({ property: { pointSize: 5 } });
const outlineActor = pointSource.pipe(vtkOutlineFilter).actor({ property: { lineWidth: 5 } });
view.add(pointsActor, outlineActor);

view.renderer.resetCamera();
view.renderWindow.render();

// GUI
const gui = new GUI();
const params = { numberOfPoints: 25, radius: 0.25 };

function render() { view.renderWindow.render(); }

gui.add(params, 'numberOfPoints', 1, 500, 1).name('Number of points').onChange((value) => {
  pointSource.numberOfPoints = Number(value);
  render();
});

gui.add(params, 'radius', 0.1, 0.5, 0.01).name('Radius').onChange((value) => {
  pointSource.radius = Number(value);
  render();
});
