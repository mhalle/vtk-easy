// ShrinkPolyData — PORTS CLEANLY
// Loads a cow mesh over HTTP and applies a shrink filter.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkHttpDataSetReader from '@kitware/vtk.js/IO/Core/HttpDataSetReader';
import vtkShrinkPolyData from '@kitware/vtk.js/Filters/General/ShrinkPolyData';
import GUI from 'lil-gui';
import ez from 'vtk-easy';

const view = ez.create(vtkFullScreenRenderWindow);

const reader = ez.create(vtkHttpDataSetReader, { fetchGzip: true });
const shrink = ez.create(vtkShrinkPolyData, { shrinkFactor: 0.25 });

const actor = reader.pipe(shrink).actor();
view.add(actor);

reader.setUrl(`${__BASE_PATH__}/data/cow.vtp`).then(() => {
  reader.loadData().then(() => {
    view.renderer.resetCamera();
    view.renderWindow.render();
  });
});

// GUI
const gui = new GUI();
const params = { shrinkFactor: 0.25 };

gui.add(params, 'shrinkFactor', 0.1, 1.0, 0.1).name('Shrink factor').onChange((value) => {
  shrink.shrinkFactor = Number(value);
  view.renderWindow.render();
});
