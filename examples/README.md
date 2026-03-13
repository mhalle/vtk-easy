# vtk-easy examples

Conversions of real vtk-js examples showing how vtk-easy helps at different levels.

## Ports cleanly

Standard source/filter/mapper/actor pipelines where vtk-easy handles all wiring.

| Example | Pattern shown |
|---------|--------------|
| [ConeSource](ConeSource/) | Two pipelines, GUI property updates via proxy |
| [SphereSource](SphereSource/) | Simple source, property-style GUI callbacks |
| [OutlineFilter](OutlineFilter/) | Branching pipeline from shared source |
| [ShrinkPolyData](ShrinkPolyData/) | HTTP data reader with filter chain |
| [OBJReader](OBJReader/) | Dynamic per-part pipelines, `ez.unwrap` for material application |

## Works with caveats

Pipeline wiring uses vtk-easy. Domain-specific setup (formulas, transfer functions, array selection) stays raw.

| Example | What stays raw |
|---------|---------------|
| [TubeFilter](TubeFilter/) | Hand-built polydata, `setInputArrayToProcess` |
| [ImageMapper](ImageMapper/) | Transfer function, interactor style, camera positioning |
| [Glyph3DMapper](Glyph3DMapper/) | Calculator formula definition |
| [Calculator](Calculator/) | Formula setup/validation, lookup table, branching with shared config |

## Helps a little

Mostly raw code. vtk-easy reduces viewer boilerplate and simplifies helper geometry.

| Example | Where vtk-easy helps |
|---------|---------------------|
| [VolumeMapper](VolumeMapper/) | Viewer setup, helper geometry (light sphere/cone), GUI proxy |
