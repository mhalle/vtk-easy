# vtk-easy

Ergonomic veneer over [vtk.js](https://github.com/Kitware/vtk-js). Property-style access, fluent pipelines, and auto-unwrapping — without touching vtk.js internals.

Every object returned is a real vtk.js instance. Drop down to the raw API any time.

## Before and after

OutlineFilter example — raw vtk.js vs vtk-easy.

**Before** (raw vtk.js):

```js
const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({ background: [0, 0, 0] });
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

const pointSource = vtkPointSource.newInstance({ numberOfPoints: 25, radius: 0.25 });
const outline = vtkOutlineFilter.newInstance();
outline.setInputConnection(pointSource.getOutputPort());

const pointMapper = vtkMapper.newInstance();
pointMapper.setInputConnection(pointSource.getOutputPort());
const pointActor = vtkActor.newInstance();
pointActor.setMapper(pointMapper);
pointActor.getProperty().setPointSize(5);
renderer.addActor(pointActor);

const outlineMapper = vtkMapper.newInstance();
outlineMapper.setInputConnection(outline.getOutputPort());
const outlineActor = vtkActor.newInstance();
outlineActor.setMapper(outlineMapper);
outlineActor.getProperty().setLineWidth(5);
renderer.addActor(outlineActor);

renderer.resetCamera();
renderWindow.render();
```

**After** (vtk-easy):

```js
const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
const pointSource = ez.create(vtkPointSource, { numberOfPoints: 25, radius: 0.25 });

const pointsActor = pointSource.actor({ property: { pointSize: 5 } });
const outlineActor = pointSource.pipe(vtkOutlineFilter).actor({ property: { lineWidth: 5 } });
view.add(pointsActor, outlineActor);

view.renderer.resetCamera();
view.renderWindow.render();
```

## Install

```bash
npm install mhalle/vtk-easy @kitware/vtk.js
```

## Quick start

```js
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkConeSource from '@kitware/vtk.js/Filters/Sources/ConeSource';
import ez from 'vtk-easy';
import { rgb } from 'vtk-easy/color';

const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
const cone = ez.create(vtkConeSource, { height: 1.5 });

const actor = cone.actor();
view.add(actor);

actor.property.color = rgb('tomato');  // CSS colors — see vtk-easy/color

view.renderer.resetCamera();
view.renderWindow.render();
```

## API

### `ez.create(VtkClass, props?)`

Shorthand for `VtkClass.newInstance(props)` that returns a wrapped instance.

```js
const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
const cone = ez.create(vtkConeSource, { height: 1.5, resolution: 60 });
cone.height = 2.0;  // already wrapped — calls setHeight(2.0)
```

### `ez.wrap(instance)` / `ez.unwrap(obj)`

Wrap a vtk.js instance with a Proxy for property-style access.

```js
const cone = ez.wrap(vtkConeSource.newInstance());
cone.height = 2.0;          // calls setHeight(2.0)
console.log(cone.height);   // calls getHeight()

// sub-objects are auto-wrapped too
actor.property.color = [1, 0, 0];  // getProperty() → setColor()

// getXxx() results are available as properties too
cone.outputPort          // calls getOutputPort()
actor.getMapper()        // calls getMapper(), auto-wrapped

// all existing methods still pass through
cone.getOutputPort();   // works
cone.isA('vtkObject');  // works
cone.set({ height: 3 }); // works
```

Arguments passed to methods through a wrapped proxy are auto-unwrapped, so you can pass wrapped objects to vtk.js methods without thinking about it:

```js
view.renderer.addViewProp(wrappedActor);  // auto-unwraps the actor
```

Auto-unwrap only works when calling methods through a wrapped proxy. If you're calling a method on a raw vtk.js object, either wrap it first:

```js
const materials = ez.wrap(materialsReader);
materials.applyMaterialToActor(name, actor);  // auto-unwraps actor
```

Or use `ez.unwrap()` to get the raw instance:

```js
materialsReader.applyMaterialToActor(name, ez.unwrap(actor));
```

### `.pipe(typeOrInstance, props?)`

Every wrapped object has a `.pipe()` method that wires its output into a downstream stage. For algorithms (sources, filters), it uses `setInputConnection`; for data objects (like `vtkPolyData`), it uses `setInputData`. Returns the wrapped downstream object, so calls chain.

```js
const cone = ez.create(vtkConeSource, { height: 1.5 });
const normals = cone.pipe(vtkPolyDataNormals, { computeCellNormals: true });
const mapper = normals.pipe(vtkMapper);
```

Accepts a vtk class (creates a new instance), an existing instance, or a wrapped proxy:

```js
source.pipe(vtkFilter)              // class → newInstance, wire, return wrapped
source.pipe(vtkFilter, { k: v })    // class + props
source.pipe(existingFilter)         // instance → wire, return wrapped
source.pipe(wrappedFilter)          // unwrap, wire, return wrapped
```

Works with data objects too:

```js
import { polyData } from 'vtk-easy/polydata';
const pd = polyData({ points: [...], polys: [...] });
pd.pipe(vtkMapper)  // uses setInputData since polyData has no getOutputPort
```

### `.mapper(type?, props?)`

Shorthand for `.pipe(defaultMapper)` that tags the result so `.actor()` knows to use it directly. If no type is given, uses the default Mapper from `ez.defaults()`.

```js
// Default mapper
source.mapper().actor()

// Explicit mapper type
source.mapper(vtkImageMapper, { sliceAtFocalPoint: true }).actor(vtkImageSlice)
```

### `.actor(typeOrProps?, props?)`

Terminal method that creates a mapper (if needed) and an actor wired together.

```js
// Simplest — default mapper + default actor
cone.actor()

// With actor properties
cone.actor({ property: { color: [1, 0, 0], edgeVisibility: true } })

// Non-default actor type
source.mapper(vtkImageMapper, { slicingMode: SlicingMode.Z })
      .actor(vtkImageSlice, { property: { colorWindow: 255, colorLevel: 127 } })
```

If called after `.mapper()`, uses that mapper. Otherwise auto-creates a default mapper.

**Branching** — same source, two actors:

```js
const pointSource = ez.create(vtkPointSource, { numberOfPoints: 25 });

const pointsActor = pointSource.actor({ property: { pointSize: 5 } });
const outlineActor = pointSource.pipe(vtkOutlineFilter).actor();

view.add(pointsActor, outlineActor);
```

**Full chain with filters:**

```js
const actor = source
  .pipe(calculator)
  .pipe(vtkWarpScalar)
  .actor();
```

### `view.add(...props)`

Any wrapped object with `getRenderer()` (FullScreenRenderWindow, GenericRenderWindow, etc.) gets a synthetic `add()` method that accepts actors, volumes, image slices — anything that is a vtkProp. Returns the view, so calls can be chained.

```js
view.add(actor1, actor2, volume);
```

Or chain inline:

```js
const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] })
  .add(cone1.actor())
  .add(cone2.actor({ property: { color: [1, 0, 0] } }));
```

Does one thing: calls `addViewProp` for each prop. No hidden resetCamera or render — those are explicit:

```js
view.renderer.resetCamera();
view.renderWindow.render();
```

### `rgb(cssColor)` / `rgba(cssColor, alpha?)`

Parse any CSS Color Level 4 string into an sRGB tuple for vtk.js. Imported from the separate `vtk-easy/color` entry point so that the `culori` dependency is only bundled if you use it.

```js
import { rgb, rgba } from 'vtk-easy/color';
```

`rgb()` returns a 3-tuple `[r, g, b]` in 0–1 range:

```js
rgb('tomato')              // [1, 0.388, 0.278]
rgb('#4a90d9')             // [0.290, 0.565, 0.851]
rgb('hsl(210, 80%, 50%)')  // [0.100, 0.500, 0.900]
rgb('oklch(0.7 0.15 210)') // [r, g, b]
```

`rgba()` returns a 4-tuple `[r, g, b, a]`. Alpha comes from the CSS string if present, or from the optional second argument (which overrides string alpha). Defaults to 1.

```js
rgba('tomato')                  // [1, 0.388, 0.278, 1]
rgba('tomato', 0.5)             // [1, 0.388, 0.278, 0.5]
rgba('rgba(255, 99, 71, 0.3)')  // [1, 0.388, 0.278, 0.3]
rgba('rgba(255, 99, 71, 0.3)', 0.8)  // override → alpha 0.8
```

Use anywhere vtk.js expects a color array:

```js
actor.property.color = rgb('tomato');
actor.property.diffuseColor = rgb('hsl(210, 80%, 50%)');
actor.property.edgeColor = rgb('#4a90d9');
```

All CSS Color Level 4 formats are supported: named colors, hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, and more. Conversion to sRGB is handled by [culori](https://culorijs.org/).

### `ez.merge(spec)`

Wire multiple sources into a multi-input filter or mapper. Accepts an array or an object.

**Array form** — `addInputConnection` (all on port 0):

```js
ez.merge([source1, source2, source3])
  .pipe(vtkAppendPolyData)
  .actor()
```

**Object form** — `setInputConnection` per port:

```js
ez.merge({ 0: planeSource.pipe(calculator), 1: coneGlyph })
  .pipe(vtkGlyph3DMapper, { orientationArray: 'pressure' })
  .actor()
```

**Mixed** — array value means `addInputConnection` on that port, scalar means `setInputConnection`:

```js
ez.merge({ 0: [src1, src2], 1: glyphSource })
  .pipe(vtkGlyph3DMapper)
  .actor()
```

The result of `merge()` has a `.pipe()` method that returns a wrapped object, so you can chain `.mapper()`, `.actor()`, etc. as usual.

### `ez.pipe(type, props?)` — deferred pipeline template

The standalone `ez.pipe()` creates a reusable pipeline template. It looks like eager `.pipe()` chaining but defers execution — no instances are created until you apply it to a source.

```js
// Define a reusable template (classes only, not instances)
const withNormals = ez.pipe(vtkPolyDataNormals);

// Apply to different sources — fresh instances each time
const coneNormals = withNormals(cone);
const sphereNormals = withNormals(sphere);

// Also accepts a class + props
const result = withNormals(vtkConeSource, { height: 1.5 });
```

Templates chain just like eager `.pipe()`:

```js
const enhance = ez.pipe(vtkPolyDataNormals, { computeCellNormals: true })
  .pipe(vtkCellCenters);

enhance(cone)       // fresh normals + cellCenters, wired to cone
enhance(cylinder)   // fresh normals + cellCenters, wired to cylinder
```

Templates can include `.mapper()` and `.actor()`:

```js
const withNormals = ez.pipe(vtkPolyDataNormals);

const coneActor = withNormals(cone).actor({ property: { color: [1, 0.4, 0.2] } });
const sphereActor = withNormals(sphere).actor({ property: { color: [0.2, 0.5, 1] } });

view.add(coneActor, sphereActor);
```

Only classes are accepted — passing an instance throws, since instances would be shared across calls. Use eager `.pipe()` for instances.

### `ez.defaults(config)`

Override the built-in Mapper/Actor used by `.mapper()` and `.actor()`. By default vtk-easy uses `vtkMapper` and `vtkActor`, so most code never needs this.

```js
ez.defaults({
  Mapper: vtkMyCustomMapper,
  Actor: vtkMyCustomActor,
});
```

### `ez.applyProps(target, props)`

Apply a plain object of properties to a vtk.js instance using setXxx conventions.

```js
ez.applyProps(actor.getProperty(), { color: [1, 0, 0], opacity: 0.5 });
```

### `ez.defineFilter(spec)` / `ez.defineSource(spec)`

Create a vtk.js filter or source without the boilerplate. The result is a standard vtk.js module with `newInstance` and `extend` — it plugs into pipelines, has `getXxx`/`setXxx` methods, and passes `isA()` checks.

**Simple filter:**

```js
const vtkJitterFilter = ez.defineFilter({
  name: 'vtkJitterFilter',
  props: {
    amplitude: 0.1,
    seed: 42,
  },
  requestData(publicAPI, model, inData, outData) {
    const input = inData[0];
    const inPts = input.getPoints().getData();
    const outPts = new Float32Array(inPts.length);
    // ... jitter each point by model.amplitude ...
    const output = vtkPolyData.newInstance();
    output.shallowCopy(input);
    output.getPoints().setData(outPts, 3);
    outData[0] = output;
  },
});

// Use in a pipeline
const actor = sphere.pipe(vtkJitterFilter, { amplitude: 0.2 }).actor();
```

**Simple source:**

```js
const vtkGridSource = ez.defineSource({
  name: 'vtkGridSource',
  props: {
    size: 10,
    spacing: 1.0,
  },
  requestData(publicAPI, model, inData, outData) {
    // ... generate grid points ...
    outData[0] = polyData;
  },
});
```

Sources have zero input ports by default; filters have one input and one output.

**Props with validation** — use `ez.prop()` to add constraints:

```js
props: {
  factor: ez.prop(0.5, { min: 0, max: 1, description: 'Scale factor' }),
  seed: ez.prop(42, { validate: v => Math.floor(Math.abs(v)) }),
  center: [0, 0, 0],   // plain array — no constraints
  name: 'default',      // plain scalar — no constraints
}
```

- `min`/`max` — auto-clamps the value
- `validate` — transform, coerce, or throw on bad input
- `description` — metadata for GUIs or documentation
- Plain values (no `ez.prop()`) work as before with no validation

The `validate` function receives the (already clamped) value and returns the corrected value. Throw to reject:

```js
mode: ez.prop('linear', {
  validate: v => {
    if (!['linear', 'cubic'].includes(v)) throw new Error(`invalid mode: ${v}`);
    return v;
  },
  description: 'Interpolation mode',
}),
```

**Schema introspection** — every defined module exposes its prop metadata:

```js
vtkJitterFilter.schema
// { amplitude: { default: 0.1 }, seed: { default: 42 } }

vtkMyFilter.schema.factor
// { default: 0.5, min: 0, max: 1, description: 'Scale factor' }
```

**Custom methods:**

```js
const vtkAccumulator = ez.defineFilter({
  name: 'vtkAccumulator',
  props: { count: 0 },
  methods: {
    increment(publicAPI, model) { model.count++; publicAPI.modified(); },
    reset(publicAPI, model) { model.count = 0; publicAPI.modified(); },
  },
  requestData(publicAPI, model, inData, outData) { ... },
});

const f = vtkAccumulator.newInstance();
f.increment();
f.reset();
```

`defineFilter` is best for simple to medium filters where the boilerplate dominates. For complex filters with many interrelated methods (like vtkCalculator), the raw vtk.js pattern may still be clearer.

## Design principles

- **Thin veneer, not a framework.** The proxy adds minimal convenience methods (like `view.add()`) but never modifies vtk.js objects themselves.
- **Everything is a real vtk.js object.** Wrapped objects are Proxies over the actual instances. Call any raw vtk.js method at any time.
- **Explicit over magical.** You pass the vtk classes you use. No auto-import, no string-based lookups, no class registration. Camera reset and rendering are never hidden.
- **Composable.** Branching pipelines, multi-port inputs, reusable templates via `ez.pipe()`, and mixed raw/wrapped code all work naturally.

## Corner cases

**`.mapper` and `.actor` property access vs synthetic methods.** The synthetic `.mapper()` and `.actor()` methods are only injected when the wrapped object does *not* have a corresponding `getMapper()` or `getActor()` method. This means:

- On a **source or filter** (no `getMapper`): `source.mapper()` calls the synthetic — creates and wires a mapper.
- On an **actor** (has `getMapper`): `actor.mapper` is *not* the synthetic — it calls `getMapper()` and returns the existing mapper, just like any other property-style access.

This is usually what you want. If you ever need to access a getter that shares a name with a synthetic, use the explicit `getXxx()` form:

```js
actor.getMapper()   // always works, even if .mapper() synthetic existed
```

**`.pipe()` is always available.** Unlike `.mapper()` and `.actor()`, the `.pipe()` synthetic is injected on all wrapped objects because no vtk.js class has `getPipe()`. On an actor this is harmless but meaningless — actors are terminal.

**Deferred templates mutate in place.** Calling `.mapper()` or `.actor()` on a template returned by `ez.pipe()` modifies the template (builder pattern), just like `.pipe()` does. There is no way to "branch" a template — build separate templates if you need different terminations.

## License

Apache-2.0
