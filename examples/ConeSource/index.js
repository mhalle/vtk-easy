// ConeSource — two cones with GUI controls.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkConeSource from '@kitware/vtk.js/Filters/Sources/ConeSource';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import GUI from 'lil-gui';
import ez from 'vtk-easy';

const view = ez.create(vtkFullScreenRenderWindow);

const cone1 = ez.create(vtkConeSource);
const cone2 = ez.create(vtkConeSource);

const actor1 = ez.pipeline(cone1).actor();
const actor2 = ez.pipeline(cone2).actor();
view.add(actor1, actor2);

actor1.property.representation = 1;
actor1.property.color = [1, 0, 0];

view.renderer.resetCamera();
view.renderWindow.render();

// GUI
const gui = new GUI();
const params = {
  height: 1.0, radius: 1.0, resolution: 6, capping: true,
  centerX: 0, centerY: 0, centerZ: 0,
  directionX: 1, directionY: 0, directionZ: 0,
};

function render() { view.renderWindow.render(); }

function updateDimensions() {
  [cone1, cone2].forEach((c) => {
    c.height = params.height;
    c.radius = params.radius;
    c.resolution = params.resolution;
    c.capping = params.capping;
  });
  render();
}

function updateTransformedCone() {
  cone2.set({
    center: [params.centerX, params.centerY, params.centerZ],
    direction: [params.directionX, params.directionY, params.directionZ],
  });
  render();
}

gui.add(params, 'height', 0.5, 2.0, 0.1).name('Height').onChange(() => updateDimensions());
gui.add(params, 'radius', 0.5, 2.0, 0.1).name('Radius').onChange(() => updateDimensions());
gui.add(params, 'resolution', 4, 100, 1).name('Resolution').onChange(() => updateDimensions());
gui.add(params, 'capping').name('Capping').onChange(() => updateDimensions());
gui.add(params, 'centerX', -1, 1, 0.1).name('Center X').onChange(updateTransformedCone);
gui.add(params, 'centerY', -1, 1, 0.1).name('Center Y').onChange(updateTransformedCone);
gui.add(params, 'centerZ', -1, 1, 0.1).name('Center Z').onChange(updateTransformedCone);
gui.add(params, 'directionX', -1, 1, 0.1).name('Direction X').onChange(updateTransformedCone);
gui.add(params, 'directionY', -1, 1, 0.1).name('Direction Y').onChange(updateTransformedCone);
gui.add(params, 'directionZ', -1, 1, 0.1).name('Direction Z').onChange(updateTransformedCone);

updateDimensions();
updateTransformedCone();
