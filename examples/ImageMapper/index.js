// ImageMapper — WORKS WITH CAVEATS
// Pipeline ports cleanly. Caveats: transfer functions, interactor style,
// and camera positioning are domain-specific and stay raw.

import '@kitware/vtk.js/Rendering/Profiles/Volume';
import Constants from '@kitware/vtk.js/Rendering/Core/ImageMapper/Constants';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkRTAnalyticSource from '@kitware/vtk.js/Filters/Sources/RTAnalyticSource';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import vtkInteractorStyleImage from '@kitware/vtk.js/Interaction/Style/InteractorStyleImage';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import ez from 'vtk-easy';

const { SlicingMode } = Constants;

const view = ez.create(vtkFullScreenRenderWindow);

// Transfer function (raw — point-by-point construction doesn't simplify)
const ofun = vtkPiecewiseFunction.newInstance();
ofun.addPoint(0, 1);
ofun.addPoint(150, 1);
ofun.addPoint(180, 0);
ofun.addPoint(255, 0);

// Pipeline — non-standard actor/mapper types
const actor = ez.pipeline(vtkRTAnalyticSource, {
    wholeExtent: [0, 200, 0, 200, 0, 200],
    center: [100, 100, 100],
    standardDeviation: 0.3,
  })
  .mapper(vtkImageMapper, {
    sliceAtFocalPoint: true,
    slicingMode: SlicingMode.Z,
  })
  .actor(vtkImageSlice, {
    property: {
      colorWindow: 255,
      colorLevel: 127,
      piecewiseFunction: ofun,
    },
  });

view.add(actor);

// Interactor style (raw — viewer concern, not pipeline)
const iStyle = vtkInteractorStyleImage.newInstance();
iStyle.setInteractionMode('IMAGE_SLICING');
view.interactor.setInteractorStyle(iStyle);

// Camera setup (raw — scene-specific positioning)
const camera = view.renderer.getActiveCamera();
const position = camera.getFocalPoint();
const normal = actor.mapper.getSlicingModeNormal();
position[0] += normal[0];
position[1] += normal[1];
position[2] += normal[2];
camera.setPosition(...position);
camera.setViewUp([0, 1, 0]);
camera.setParallelProjection(true);
view.renderer.resetCamera();
view.renderWindow.render();
