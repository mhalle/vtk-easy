// SphereSource — PORTS CLEANLY
// Sphere with adjustable resolution, theta/phi ranges, and edge visibility.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import GUI from 'lil-gui';
import ez from 'vtk-easy';

const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });

const source = ez.create(vtkSphereSource);
const actor = ez.pipeline(source).actor({ property: { edgeVisibility: true } });
view.add(actor);

view.renderer.resetCamera();
view.renderWindow.render();

// GUI
const gui = new GUI();
const params = {
  radius: 1.0, thetaResolution: 8, startTheta: 0, endTheta: 360,
  phiResolution: 8, startPhi: 0, endPhi: 180, edgeVisibility: true,
};

function render() { view.renderWindow.render(); }

function update(prop) {
  return (value) => {
    source[prop] = Number(value);
    render();
  };
}

gui.add(params, 'radius', 0.5, 2.0, 0.1).name('Radius').onChange(update('radius'));
gui.add(params, 'thetaResolution', 4, 100, 1).name('Theta resolution').onChange(update('thetaResolution'));
gui.add(params, 'startTheta', 0, 360, 1).name('Start theta').onChange(update('startTheta'));
gui.add(params, 'endTheta', 0, 360, 1).name('End theta').onChange(update('endTheta'));
gui.add(params, 'phiResolution', 4, 100, 1).name('Phi resolution').onChange(update('phiResolution'));
gui.add(params, 'startPhi', 0, 180, 1).name('Start phi').onChange(update('startPhi'));
gui.add(params, 'endPhi', 0, 180, 1).name('End phi').onChange(update('endPhi'));
gui.add(params, 'edgeVisibility').name('Edge visibility').onChange((value) => {
  actor.property.edgeVisibility = !!value;
  render();
});
