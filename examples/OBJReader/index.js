// OBJReader — PORTS CLEANLY
// Loads a multi-part OBJ model with MTL materials. Dynamic pipeline per part.

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkOBJReader from '@kitware/vtk.js/IO/Misc/OBJReader';
import vtkMTLReader from '@kitware/vtk.js/IO/Misc/MTLReader';
import GUI from 'lil-gui';
import ez from 'vtk-easy';

const fileName = 'space-shuttle-orbiter';

const view = ez.create(vtkFullScreenRenderWindow);
const scene = [];
const gui = new GUI();

const reader = vtkOBJReader.newInstance({ splitMode: 'usemtl' });
const materialsReader = vtkMTLReader.newInstance();

materialsReader
  .setUrl(`${__BASE_PATH__}/data/obj/${fileName}/${fileName}.mtl`)
  .then(() => {
    reader
      .setUrl(`${__BASE_PATH__}/data/obj/${fileName}/${fileName}.obj`)
      .then(() => {
        const size = reader.getNumberOfOutputPorts();
        for (let i = 0; i < size; i++) {
          const polydata = reader.getOutputData(i);
          const name = polydata.get('name').name;

          const actor = ez.pipeline(polydata).actor();

          // Materials need the raw actor for applyMaterialToActor
          materialsReader.applyMaterialToActor(name, ez.unwrap(actor));

          view.add(actor);
          scene.push({ name, actor });
        }
        view.renderer.resetCamera();
        view.renderWindow.render();

        scene.forEach((item) => {
          const param = { visible: true };
          gui.add(param, 'visible').name(item.name).onChange((value) => {
            item.actor.visibility = value;
            view.renderWindow.render();
          });
        });
      });
  });
