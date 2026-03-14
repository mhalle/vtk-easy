# Changelog

## 0.4.0

### Added
- Synthetic `.pipe()`, `.mapper()`, `.actor()` methods on all wrapped objects — build pipelines by chaining directly from sources: `cone.pipe(vtkNormals).actor()`.
- `ez.merge()` for multi-input wiring — array form uses `addInputConnection`, object form uses `setInputConnection` per port, mixed form supports both.
- `.mapper()` and `.actor()` on deferred `ez.pipe()` templates.
- `hasGetter` guard prevents `.mapper()`/`.actor()` synthetics from shadowing `getMapper()`/`getActor()` property access on actors.

### Removed
- `pipeline()` and `PipelineBuilder` — replaced by synthetic methods on wrapped objects.
- `.filter()` — redundant alias for `.pipe()`.

### Changed
- All examples migrated from `pipeline()` to the new chaining API.
- README rewritten with API sections ordered by usage frequency.

## 0.3.0

### Added
- `polyData()` function to build `vtkPolyData` from plain JS arrays — supports flat, nested, and typed-array points; multiple cell formats (flat with default grouping, nested, `{size, data}`, raw `Uint32Array`); auto-vert generation for point clouds; and `pointData`/`cellData` with single or multi-component arrays.
- Separate entry point `vtk-easy/polydata` to avoid pulling in `vtkPolyData`, `vtkCellArray`, and `vtkDataArray` for users who only need the core API.
- PolyData interactive example with vertex-colored triangle and lil-gui controls.
- Exported `Wrapped` type from `index.d.ts`.

### Fixed
- `pipeline()` now correctly detects data objects (e.g. `vtkPolyData`) vs algorithm sources by checking for `getOutputPort`, and uses `setInputData` instead of `setInputConnection`.

## 0.2.0

### Added
- `defineFilter()` and `defineSource()` for declarative vtk.js module creation.
- `ez.prop()` tagged property descriptors with min/max clamping, validation, and schema metadata.
- DefineFilter interactive example.

## 0.1.0

### Added
- Initial release.
- `wrap()` / `unwrap()` — property-style Proxy access for vtk.js objects.
- `create()` — shorthand for `Type.newInstance(props)`, returns wrapped.
- `pipeline()` — fluent pipeline builder (source/filter/mapper/actor).
- `defaults()` — configure default Mapper/Actor classes.
- `applyProps()`, `wireChain()`, `isVtkObject()` helpers.
- Interactive examples: ConeSource, SphereSource, OutlineFilter, TubeFilter, ImageMapper, Glyph3DMapper, Calculator.
