import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'vtk-easy': path.resolve(__dirname, 'index.js'),
    },
  },
  define: {
    __BASE_PATH__: JSON.stringify(''),
  },
  optimizeDeps: {
    include: [
      '@kitware/vtk.js/Rendering/Profiles/Geometry',
      '@kitware/vtk.js/Rendering/Profiles/Volume',
      '@kitware/vtk.js/Rendering/Profiles/Glyph',
      '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow',
      '@kitware/vtk.js/Rendering/Core/Actor',
      '@kitware/vtk.js/Rendering/Core/Mapper',
      '@kitware/vtk.js/Rendering/Core/ImageMapper',
      '@kitware/vtk.js/Rendering/Core/ImageMapper/Constants',
      '@kitware/vtk.js/Rendering/Core/ImageSlice',
      '@kitware/vtk.js/Rendering/Core/Glyph3DMapper',
      '@kitware/vtk.js/Filters/Sources/ConeSource',
      '@kitware/vtk.js/Filters/Sources/SphereSource',
      '@kitware/vtk.js/Filters/Sources/PlaneSource',
      '@kitware/vtk.js/Filters/Sources/PointSource',
      '@kitware/vtk.js/Filters/Sources/RTAnalyticSource',
      '@kitware/vtk.js/Filters/General/OutlineFilter',
      '@kitware/vtk.js/Filters/General/TubeFilter',
      '@kitware/vtk.js/Filters/General/TubeFilter/Constants',
      '@kitware/vtk.js/Filters/General/Calculator',
      '@kitware/vtk.js/Filters/General/WarpScalar',
      '@kitware/vtk.js/Interaction/Style/InteractorStyleImage',
      '@kitware/vtk.js/Common/Core/DataArray',
      '@kitware/vtk.js/Common/Core/DataArray/Constants',
      '@kitware/vtk.js/Common/Core/LookupTable',
      '@kitware/vtk.js/Common/Core/Math',
      '@kitware/vtk.js/Common/Core/Points',
      '@kitware/vtk.js/Common/DataModel/DataSet',
      '@kitware/vtk.js/Common/DataModel/DataSet/Constants',
      '@kitware/vtk.js/Common/DataModel/DataSetAttributes/Constants',
      '@kitware/vtk.js/Common/DataModel/PiecewiseFunction',
      '@kitware/vtk.js/Common/DataModel/PolyData',
      '@kitware/vtk.js/Common/Transform/Transform',
      '@kitware/vtk.js/macros',
      'lil-gui',
    ],
  },
});
