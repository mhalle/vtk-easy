// VolumeMapper — HELPS A LITTLE
// Heavy transfer function setup and light configuration stay raw.
// vtk-easy helps with: helper geometry pipelines and GUI property access via proxy.

import '@kitware/vtk.js/Rendering/Profiles/Volume';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';

import { ColorMixPreset } from '@kitware/vtk.js/Rendering/Core/VolumeProperty/Constants';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkConeSource from '@kitware/vtk.js/Filters/Sources/ConeSource';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkHttpDataSetReader from '@kitware/vtk.js/IO/Core/HttpDataSetReader';
import vtkLight from '@kitware/vtk.js/Rendering/Core/Light';
import * as vtkMath from '@kitware/vtk.js/Common/Core/Math';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkProperty from '@kitware/vtk.js/Rendering/Core/Property';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import GUI from 'lil-gui';
import ez from 'vtk-easy';
const { Representation, Shading } = vtkProperty;

// --- view ---

const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
view.renderer.setTwoSidedLighting(false);

// --- transfer functions (raw — point-by-point, can't simplify) ---

const ctfun = vtkColorTransferFunction.newInstance();
ctfun.addRGBPoint(0, 0, 0, 0);
ctfun.addRGBPoint(95, 1.0, 1.0, 1.0);
ctfun.addRGBPoint(225, 0.66, 0.66, 0.5);
ctfun.addRGBPoint(255, 0.3, 0.3, 0.5);

const ofun = vtkPiecewiseFunction.newInstance();
ofun.addPoint(0.0, 0.1);
ofun.addPoint(255.0, 1.0);

// --- volume pipeline (raw — too many property calls for declarative config) ---

const actor = vtkVolume.newInstance();
const mapper = vtkVolumeMapper.newInstance({ sampleDistance: 0.7 });
actor.setMapper(mapper);

const prop = actor.getProperty();
prop.setComputeNormalFromOpacity(true);
prop.setLAOKernelRadius(5);
prop.setLAOKernelSize(10);
prop.setLocalAmbientOcclusion(0);
prop.setVolumetricScatteringBlending(0);
prop.setRGBTransferFunction(0, ctfun);
prop.setScalarOpacity(0, ofun);
prop.setInterpolationTypeToLinear();
prop.setUseGradientOpacity(0, true);
prop.setGradientOpacityMinimumValue(0, 2);
prop.setGradientOpacityMinimumOpacity(0, 0.0);
prop.setGradientOpacityMaximumValue(0, 20);
prop.setGradientOpacityMaximumOpacity(0, 1.0);
prop.setScalarOpacityUnitDistance(0, 2.955);
prop.setShade(true);
prop.setAmbient(0.3);
prop.setDiffuse(1);
prop.setSpecular(1);

view.renderer.addVolume(actor);

// --- light (raw) ---

view.renderer.removeAllLights();
const light = vtkLight.newInstance();
light.setLightTypeToSceneLight();
light.setPositional(true);
light.setPosition(450, 300, 200);
light.setFocalPoint(0, 0, 0);
light.setColor(0, 0.45, 0.45);
light.setConeAngle(25);
light.setIntensity(1.0);
view.renderer.addLight(light);

// --- helper geometry (vtk-easy helps here) ---

if (light.getPositional()) {
  // light source sphere
  const sphereActor = ez.pipeline(vtkSphereSource, {
    center: light.getPosition(),
    radius: 5.0,
  }).actor({
    property: {
      representation: Representation.WIREFRAME,
      interpolation: Shading.FLAT,
      color: light.getColor(),
      lineWidth: 2.0,
    },
  });

  // cone frustum
  const lightDir = [0, 0, 0];
  vtkMath.subtract(light.getFocalPoint(), light.getPosition(), lightDir);
  vtkMath.normalize(lightDir);
  const frustumCenter = light.getPosition();
  const frustumHeight = 80;
  const frustumRadius = frustumHeight * Math.tan((light.getConeAngle() * Math.PI) / 180);
  const halfDir = [0, 0, 0];
  vtkMath.add(frustumCenter, vtkMath.multiplyScalar(lightDir, frustumHeight * 0.5), halfDir);
  vtkMath.multiplyScalar(lightDir, -1, lightDir);

  const coneActor = ez.pipeline(vtkConeSource, {
    center: halfDir,
    radius: frustumRadius,
    height: frustumHeight,
    direction: lightDir,
    resolution: 6,
  }).actor({
    property: {
      representation: Representation.WIREFRAME,
      interpolation: Shading.FLAT,
      color: light.getColor(),
      lineWidth: 2.0,
    },
  });

  view.add(sphereActor, coneActor);
}

// --- data loading ---

const reader = vtkHttpDataSetReader.newInstance({ fetchGzip: true });

const volumeOptions = {};
const gui = new GUI();
const params = {
  ParallelProjection: false,
  Lighting: true,
  LAO: false,
  Scattering: 0.0,
  Volume: '',
  Preset: 'DEFAULT',
};

const presetKeys = Object.keys(ColorMixPreset).filter((k) => k !== 'CUSTOM');

function render() { view.renderWindow.render(); }

reader.setUrl(`${__BASE_PATH__}/data/volume/LIDC2.vti`).then(() => {
  reader.loadData().then(() => {
    const imageData = reader.getOutputData();
    mapper.setInputData(imageData);

    const array = imageData.getPointData().getArray(0);
    const baseData = array.getData();
    const dims = imageData.getDimensions();

    // Build labelmap volumes
    const newComp = 2;
    const cubeData = new Float32Array(newComp * baseData.length);
    const sphereData = new Float32Array(newComp * baseData.length);
    for (let z = 0; z < dims[2]; ++z) {
      for (let y = 0; y < dims[1]; ++y) {
        for (let x = 0; x < dims[0]; ++x) {
          const i = x + dims[0] * (y + dims[1] * z);
          cubeData[i * 2] = baseData[i];
          cubeData[i * 2 + 1] = (x >= 0.3 * dims[0] && x <= 0.7 * dims[0] &&
            y >= 0.3 * dims[1] && y <= 0.7 * dims[1] &&
            z >= 0.3 * dims[2] && z <= 0.7 * dims[2]) ? 1 : 0;
          sphereData[i * 2] = baseData[i];
          sphereData[i * 2 + 1] = ((x / dims[0] - 0.5) ** 2 +
            (y / dims[1] - 0.5) ** 2 + (z / dims[2] - 0.5) ** 2 < 0.04) ? 1 : 0;
        }
      }
    }

    volumeOptions['Base volume'] = { comp: 1, data: baseData };
    volumeOptions['Sphere labelmap volume'] = { comp: newComp, data: sphereData };
    volumeOptions['Cube labelmap volume'] = { comp: newComp, data: cubeData };

    // Labelmap transfer functions
    const maskCtfun = vtkColorTransferFunction.newInstance();
    maskCtfun.addRGBPoint(0, 0, 0, 0);
    maskCtfun.addRGBPoint(0.9999, 0, 0, 0);
    maskCtfun.addRGBPoint(1, 1, 0, 1);
    const maskOfun = vtkPiecewiseFunction.newInstance();
    maskOfun.addPoint(0, 0);
    maskOfun.addPoint(0.9999, 0);
    maskOfun.addPoint(1, 1);
    prop.setRGBTransferFunction(1, maskCtfun);
    prop.setScalarOpacity(1, maskOfun);

    gui.add(params, 'Volume', Object.keys(volumeOptions)).name('Volume').onChange((value) => {
      const { comp, data } = volumeOptions[value];
      if (comp === 1) prop.setColorMixPreset(ColorMixPreset.DEFAULT);
      array.setData(data);
      array.setNumberOfComponents(comp);
      mapper.modified();
      render();
    });

    const interactor = view.renderWindow.getInteractor();
    interactor.setDesiredUpdateRate(15.0);
    view.renderer.getActiveCamera().azimuth(90);
    view.renderer.getActiveCamera().roll(90);
    view.renderer.getActiveCamera().azimuth(-60);
    view.renderer.resetCamera();
    render();
  });
});

// --- GUI (vtk-easy proxy helps here) ---

const wrappedActor = ez.wrap(actor);

gui.add(params, 'ParallelProjection').name('Parallel Projection').onChange((v) => {
  view.renderer.getActiveCamera().setParallelProjection(Boolean(v));
  render();
});
gui.add(params, 'Lighting').name('Lighting').onChange((v) => {
  wrappedActor.property.shade = Boolean(v);
  render();
});
gui.add(params, 'LAO').name('Toggle LAO').onChange((v) => {
  wrappedActor.property.localAmbientOcclusion = Boolean(v);
  render();
});
gui.add(params, 'Scattering', 0.0, 1.0, 0.1).name('Volumetric Scattering').onChange((v) => {
  wrappedActor.property.volumetricScatteringBlending = Number(v);
  render();
});
gui.add(params, 'Preset', presetKeys).name('Preset').onChange((key) => {
  prop.setColorMixPreset(ColorMixPreset[key]);
  render();
});
