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

const pointsActor = ez.pipeline(pointSource)
  .actor({ property: { pointSize: 5 } });
const outlineActor = ez.pipeline(pointSource)
  .filter(vtkOutlineFilter)
  .actor({ property: { lineWidth: 5 } });
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

const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
const cone = ez.create(vtkConeSource, { height: 1.5 });

const actor = ez.pipeline(cone).actor();
view.add(actor);

actor.property.color = [0.9, 0.2, 0.3];

view.renderer.resetCamera();
view.renderWindow.render();
```

## API

### `ez.defaults(config)`

Override the built-in Mapper/Actor used by `pipeline().actor()`. By default vtk-easy uses `vtkMapper` and `vtkActor`, so most code never needs this.

```js
ez.defaults({
  Mapper: vtkMyCustomMapper,
  Actor: vtkMyCustomActor,
});
```

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
actor.mapper             // calls getMapper(), auto-wrapped

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

### `ez.pipeline(input, props?)`

Build a vtk.js pipeline with a fluent chain. Returns a `PipelineBuilder` — call `.actor()` to terminate.

**From a class:**

```js
ez.pipeline(vtkConeSource).actor()
ez.pipeline(vtkConeSource, { height: 1.5 }).actor()
```

**From an existing instance or wrapped proxy:**

```js
const cone = ez.create(vtkConeSource);
ez.pipeline(cone).actor()
```

**From raw data:**

```js
ez.pipeline(polyData).actor()
```

**With filters:**

```js
ez.pipeline(planeSource)
  .filter(calculator)
  .filter(vtkWarpScalar)
  .actor()
```

**Non-default mapper/actor types:**

```js
ez.pipeline(vtkRTAnalyticSource, { wholeExtent: [0, 200, 0, 200, 0, 200] })
  .mapper(vtkImageMapper, { sliceAtFocalPoint: true, slicingMode: SlicingMode.Z })
  .actor(vtkImageSlice, { property: { colorWindow: 255, colorLevel: 127 } })
```

**Actor properties:**

```js
ez.pipeline(cone).actor({ property: { color: [1, 0, 0], edgeVisibility: true } })
```

**Branching** — same source, two pipelines:

```js
const pointSource = ez.create(vtkPointSource, { numberOfPoints: 25 });

const pointsActor = ez.pipeline(pointSource).actor({ property: { pointSize: 5 } });
const outlineActor = ez.pipeline(pointSource).filter(vtkOutlineFilter).actor();

view.add(pointsActor, outlineActor);
```

**Multi-port** — wire manually after building:

```js
const actor = ez.pipeline(planeSource)
  .filter(calculator)
  .mapper(vtkGlyph3DMapper, { orientationArray: 'pressure' })
  .actor();

// glyph source on port 1
actor.mapper.setInputConnection(coneSource.outputPort, 1);
```

### `view.add(...props)`

Any wrapped object with `getRenderer()` (FullScreenRenderWindow, GenericRenderWindow, etc.) gets a synthetic `add()` method that accepts actors, volumes, image slices — anything that is a vtkProp. Returns the view, so calls can be chained.

```js
view.add(actor1, actor2, volume);
```

Or chain inline pipelines:

```js
const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] })
  .add(ez.pipeline(cone1).actor())
  .add(ez.pipeline(cone2).actor({ property: { color: [1, 0, 0] } }));
```

Does one thing: calls `addViewProp` for each prop. No hidden resetCamera or render — those are explicit:

```js
view.renderer.resetCamera();
view.renderWindow.render();
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

// Use in a pipeline like any vtk.js filter
const actor = ez.pipeline(sphere)
  .filter(vtkJitterFilter, { amplitude: 0.2 })
  .actor();
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
- **Composable.** Branching pipelines, multi-port inputs, and mixed raw/wrapped code all work naturally.

## License

Apache-2.0
