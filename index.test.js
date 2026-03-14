// Tests for vtk-easy
// Run: node index.test.js

import { defaults, wrap, unwrap, create, wireChain, applyProps, isVtkObject } from './index.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

// ---------------------------------------------------------------------------
// Mock vtk objects — simulate the macro-generated API
// ---------------------------------------------------------------------------

function mockVtkObject(className, defaults = {}) {
  const model = { ...defaults };
  const classHierarchy = ['vtkObject', className];
  const api = {
    isA: (name) => classHierarchy.includes(name),
    getClassName: () => className,
    getOutputPort: () => { const fn = () => model; fn.filter = api; return fn; },
    setInputConnection: (port, portIdx = 0) => { model[`_input${portIdx}`] = port; },
    addInputConnection: (port) => {
      if (!model._addedInputs) model._addedInputs = [];
      model._addedInputs.push(port);
    },
    setInputData: (data, port = 0) => { model[`_data${port}`] = data; },
    getProperty: () => mockVtkObject('vtkProperty'),
    set: (map) => { Object.assign(model, map); },
    get: (...names) => {
      if (!names.length) return model;
      const result = {};
      names.forEach(n => { result[n] = model[n]; });
      return result;
    },
    modified: () => {},
    _model: model,
  };

  for (const key of Object.keys(defaults)) {
    const cap = key[0].toUpperCase() + key.slice(1);
    api[`get${cap}`] = () => model[key];
    api[`set${cap}`] = (val) => { model[key] = val; return true; };
  }

  return api;
}

function mockVtkClass(className, defaults = {}) {
  return {
    newInstance: (initialValues = {}) => mockVtkObject(className, { ...defaults, ...initialValues }),
  };
}

// Actor-like mock: has setMapper/getMapper/getProperty (like real vtkActor)
function mockActorClass(className = 'vtkActor', defaults = {}) {
  return {
    newInstance: (initialValues = {}) => {
      const obj = mockVtkObject(className, { ...defaults, ...initialValues });
      obj.setMapper = (m) => { obj._model._mapper = m; };
      obj.getMapper = () => obj._model._mapper;
      return obj;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: core utilities
// ---------------------------------------------------------------------------

console.log('--- isVtkObject ---');
assert(isVtkObject(mockVtkObject('vtkFoo')) === true, 'detects vtk object');
assert(isVtkObject({ foo: 1 }) === false, 'rejects plain object');
assert(!isVtkObject(null), 'rejects null');
assert(isVtkObject('string') === false, 'rejects string');

console.log('--- wireChain ---');
{
  const a = mockVtkObject('vtkA', {});
  const b = mockVtkObject('vtkB', {});
  const c = mockVtkObject('vtkC', {});
  wireChain([a, b, c]);
  assert(b._model._input0 !== undefined, 'b got input connection');
  assert(c._model._input0 !== undefined, 'c got input connection');
}

console.log('--- wrap getter/setter ---');
{
  const obj = mockVtkObject('vtkSource', { height: 1.0, resolution: 20 });
  const p = wrap(obj);

  assert(p.height === 1.0, 'proxy getter reads property');
  p.height = 2.5;
  assert(p.height === 2.5, 'proxy setter writes property');
  assert(obj.getHeight() === 2.5, 'underlying object updated');
  p.resolution = 80;
  assert(p.resolution === 80, 'second property works');
}

console.log('--- wrap method passthrough ---');
{
  const obj = mockVtkObject('vtkSource', { height: 1.0 });
  const p = wrap(obj);

  assert(typeof p.isA === 'function', 'isA passes through');
  assert(p.isA('vtkSource') === true, 'isA works correctly');
  assert(typeof p.getOutputPort === 'function', 'getOutputPort passes through');
  assert(typeof p.set === 'function', 'set method passes through');
}

console.log('--- wrap auto-wraps returned vtk objects ---');
{
  const obj = mockVtkObject('vtkActor', { height: 1.0 });
  const p = wrap(obj);
  const prop = p.getProperty();
  assert(prop !== undefined, 'getProperty returns something');
  assert(prop.isA('vtkProperty'), 'returned object is proxied and functional');
}

console.log('--- wrap idempotent ---');
{
  const obj = mockVtkObject('vtkFoo', {});
  const p1 = wrap(obj);
  const p2 = wrap(p1);
  assert(p1 === p2, 'double-wrapping returns same proxy');
}

console.log('--- unwrap ---');
{
  const obj = mockVtkObject('vtkFoo', { height: 1 });
  const wrapped = wrap(obj);
  assert(unwrap(wrapped) === obj, 'unwrap returns raw target');
  assert(unwrap(obj) === obj, 'unwrap on raw object is identity');
  assert(unwrap(null) === null, 'unwrap on null returns null');
}

console.log('--- create ---');
{
  const MockSource = mockVtkClass('vtkSource', { height: 1.0, resolution: 20 });
  const src = create(MockSource, { height: 5.0 });

  assert(src.height === 5.0, 'create passes props and wraps');
  src.height = 10.0;
  assert(src.height === 10.0, 'create result is wrapped — property setter works');
  assert(typeof src.isA === 'function', 'create result has vtk methods');
}

console.log('--- applyProps ---');
{
  const obj = mockVtkObject('vtkFoo', { height: 1, width: 2 });
  applyProps(obj, { height: 10, width: 20 });
  assert(obj.getHeight() === 10, 'applyProps sets height');
  assert(obj.getWidth() === 20, 'applyProps sets width');
}

// ---------------------------------------------------------------------------
// Tests: synthetic .mapper(), .actor() on wrapped objects
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests: pipe()
// ---------------------------------------------------------------------------

console.log('--- pipe: class ---');
{
  const src = mockVtkObject('vtkSource', {});
  const MockFilter = mockVtkClass('vtkFilter', {});
  const result = wrap(src).pipe(MockFilter);
  assert(unwrap(result).isA('vtkFilter'), 'pipe creates filter from class');
  assert(unwrap(result)._model._input0 !== undefined, 'pipe wired input connection');
}

console.log('--- pipe: class with props ---');
{
  const src = mockVtkObject('vtkSource', {});
  const MockFilter = mockVtkClass('vtkFilter', { factor: 1.0 });
  const result = wrap(src).pipe(MockFilter, { factor: 2.0 });
  assert(unwrap(result).getFactor() === 2.0, 'pipe passes props to newInstance');
  assert(unwrap(result)._model._input0 !== undefined, 'pipe wired input');
}

console.log('--- pipe: existing instance ---');
{
  const src = mockVtkObject('vtkSource', {});
  const existing = mockVtkObject('vtkFilter', {});
  const result = wrap(src).pipe(existing);
  assert(unwrap(result) === existing, 'pipe with instance returns same instance wrapped');
  assert(existing._model._input0 !== undefined, 'pipe wired existing instance');
}

console.log('--- pipe: wrapped proxy ---');
{
  const src = mockVtkObject('vtkSource', {});
  const filter = mockVtkObject('vtkFilter', {});
  const wrappedFilter = wrap(filter);
  const result = wrap(src).pipe(wrappedFilter);
  assert(unwrap(result) === filter, 'pipe unwraps wrapped input');
  assert(filter._model._input0 !== undefined, 'pipe wired unwrapped filter');
}

console.log('--- pipe: chaining ---');
{
  const src = mockVtkObject('vtkSource', {});
  const MockFilter1 = mockVtkClass('vtkFilter1', {});
  const MockFilter2 = mockVtkClass('vtkFilter2', {});
  const result = wrap(src).pipe(MockFilter1).pipe(MockFilter2);
  assert(unwrap(result).isA('vtkFilter2'), 'chained pipe produces final filter');
  assert(unwrap(result)._model._input0 !== undefined, 'final filter is wired');
}

console.log('--- pipe: from data object (no getOutputPort) ---');
{
  const data = mockVtkObject('vtkPolyData', {});
  delete data.getOutputPort;  // simulate a data object
  const MockFilter = mockVtkClass('vtkFilter', {});
  const result = wrap(data).pipe(MockFilter);
  assert(unwrap(result)._model._data0 === data, 'pipe from data uses setInputData');
}

console.log('--- pipe: from plain data ---');
{
  const fakeData = { fake: 'polydata' };
  const MockFilter = mockVtkClass('vtkFilter', {});
  const result = wrap(fakeData).pipe(MockFilter);
  assert(unwrap(result)._model._data0 === fakeData, 'pipe from plain data uses setInputData');
}

// ---------------------------------------------------------------------------
// Tests: ez.pipe() — deferred pipeline templates
// ---------------------------------------------------------------------------

console.log('--- ez.pipe: basic template ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const template = pipe(MockFilter).pipe(MockMapper);
  assert(typeof template === 'function', 'pipe returns a callable');
  assert(typeof template.pipe === 'function', 'pipe result has .pipe()');

  const src = mockVtkObject('vtkSource', {});
  const result = template(src);
  assert(unwrap(result).isA('vtkMapper'), 'template produces final stage');
  assert(unwrap(result)._model._input0 !== undefined, 'final stage is wired');
}

console.log('--- ez.pipe: fresh instances per call ---');
{
  const MockFilter = mockVtkClass('vtkFilter', { value: 0 });
  const template = pipe(MockFilter);

  const src1 = mockVtkObject('vtkSource1', {});
  const src2 = mockVtkObject('vtkSource2', {});
  const r1 = template(src1);
  const r2 = template(src2);
  assert(unwrap(r1) !== unwrap(r2), 'each call creates a fresh instance');
}

console.log('--- ez.pipe: props passed through ---');
{
  const MockFilter = mockVtkClass('vtkFilter', { factor: 1.0 });
  const template = pipe(MockFilter, { factor: 5.0 });

  const src = mockVtkObject('vtkSource', {});
  const result = template(src);
  assert(unwrap(result).getFactor() === 5.0, 'props applied to fresh instance');
}

console.log('--- ez.pipe: works with data source ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const template = pipe(MockFilter);

  const data = mockVtkObject('vtkPolyData', {});
  delete data.getOutputPort;
  const result = template(data);
  assert(unwrap(result)._model._data0 === data, 'template uses setInputData for data objects');
}

console.log('--- ez.pipe: accepts class + props as source ---');
{
  const MockSource = mockVtkClass('vtkSource', { height: 1.0 });
  const MockFilter = mockVtkClass('vtkFilter', {});
  const template = pipe(MockFilter);

  const result = template(MockSource, { height: 5.0 });
  assert(unwrap(result).isA('vtkFilter'), 'template applied to class produces filter');
  assert(unwrap(result)._model._input0 !== undefined, 'filter is wired');
}

console.log('--- ez.pipe: rejects instances ---');
{
  const instance = mockVtkObject('vtkFilter', {});
  let threw = false;
  try { pipe(instance); } catch (e) { threw = true; }
  assert(threw, 'ez.pipe() throws on instance');
}

console.log('--- ez.pipe: .pipe() rejects instances ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const instance = mockVtkObject('vtkFilter', {});
  let threw = false;
  try { pipe(MockFilter).pipe(instance); } catch (e) { threw = true; }
  assert(threw, 'template.pipe() throws on instance');
}

console.log('--- ez.pipe: .mapper() on template ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  defaults({ Mapper: MockMapper });

  const template = pipe(MockFilter).mapper();
  const src = mockVtkObject('vtkSource', {});
  const result = template(src);
  assert(unwrap(result).isA('vtkMapper'), 'template.mapper() creates mapper');
  assert(unwrap(result)._model._input0 !== undefined, 'mapper wired');

  defaults({ Mapper: null });
}

console.log('--- ez.pipe: .mapper() with explicit type ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockImageMapper = mockVtkClass('vtkImageMapper', { slicing: 0 });
  const template = pipe(MockFilter).mapper(MockImageMapper, { slicing: 3 });
  const src = mockVtkObject('vtkSource', {});
  const result = template(src);
  assert(unwrap(result).isA('vtkImageMapper'), 'template uses explicit mapper type');
  assert(unwrap(result).getSlicing() === 3, 'mapper props passed');
}

console.log('--- ez.pipe: .actor() on template ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const template = pipe(MockFilter).actor();
  const src = mockVtkObject('vtkSource', {});
  const result = template(src);
  assert(unwrap(result).isA('vtkActor'), 'template.actor() creates actor');
  assert(unwrap(result)._model._mapper !== undefined, 'actor has mapper');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- ez.pipe: .actor() with props ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const template = pipe(MockFilter).actor({ property: { color: [1, 0, 0] } });
  const src = mockVtkObject('vtkSource', {});
  const result = template(src);
  assert(unwrap(result).isA('vtkActor'), 'template.actor() with props');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- ez.pipe: .mapper().actor() on template ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockImageMapper = mockVtkClass('vtkImageMapper', {});
  const MockActor = mockActorClass();
  defaults({ Actor: MockActor });

  const template = pipe(MockFilter).mapper(MockImageMapper).actor();
  const src = mockVtkObject('vtkSource', {});
  const result = template(src);
  assert(unwrap(result).isA('vtkActor'), 'template mapper+actor creates actor');
  assert(unwrap(result)._model._mapper.isA('vtkImageMapper'), 'uses explicit mapper');

  defaults({ Actor: null });
}

console.log('--- ez.pipe: .actor() fresh instances per call ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const template = pipe(MockFilter).actor();
  const src1 = mockVtkObject('vtkSource1', {});
  const src2 = mockVtkObject('vtkSource2', {});
  const r1 = template(src1);
  const r2 = template(src2);
  assert(unwrap(r1) !== unwrap(r2), 'template.actor() creates fresh actors');
  assert(unwrap(r1)._model._mapper !== unwrap(r2)._model._mapper, 'fresh mappers too');

  defaults({ Mapper: null, Actor: null });
}

// ---------------------------------------------------------------------------
// Tests: synthetic .filter(), .mapper(), .actor() on wrapped objects
// ---------------------------------------------------------------------------

console.log('--- synthetic mapper: creates default mapper ---');
{
  const MockMapper = mockVtkClass('vtkMapper', { mode: 'default' });
  defaults({ Mapper: MockMapper });

  const src = mockVtkObject('vtkSource', {});
  const result = wrap(src).mapper();
  assert(unwrap(result).isA('vtkMapper'), 'mapper creates default mapper');
  assert(unwrap(result)._model._input0 !== undefined, 'mapper wires input');

  defaults({ Mapper: null });
}

console.log('--- synthetic mapper: explicit type ---');
{
  const MockImageMapper = mockVtkClass('vtkImageMapper', { slicing: 0 });
  const src = mockVtkObject('vtkSource', {});
  const result = wrap(src).mapper(MockImageMapper, { slicing: 2 });
  assert(unwrap(result).isA('vtkImageMapper'), 'mapper uses explicit type');
  assert(unwrap(result).getSlicing() === 2, 'mapper passes props');
}

console.log('--- synthetic actor: full chain source.mapper().actor() ---');
{
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const src = mockVtkObject('vtkSource', {});
  const actor = wrap(src).mapper().actor();
  assert(unwrap(actor).isA('vtkActor'), 'actor created');
  assert(unwrap(actor)._model._mapper !== undefined, 'actor has mapper');
  assert(unwrap(actor)._model._mapper.isA('vtkMapper'), 'mapper is correct type');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- synthetic actor: auto-creates mapper ---');
{
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const src = mockVtkObject('vtkSource', {});
  const actor = wrap(src).actor();
  assert(unwrap(actor).isA('vtkActor'), 'actor auto-creates mapper');
  assert(unwrap(actor)._model._mapper !== undefined, 'auto-mapper attached');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- synthetic actor: with property config ---');
{
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const src = mockVtkObject('vtkSource', {});
  const actor = wrap(src).actor({ property: { color: [1, 0, 0] } });
  assert(unwrap(actor).isA('vtkActor'), 'actor with props created');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- synthetic actor: explicit actor type ---');
{
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockSlice = mockActorClass('vtkImageSlice');
  defaults({ Mapper: MockMapper });

  const src = mockVtkObject('vtkSource', {});
  const actor = wrap(src).actor(MockSlice);
  assert(unwrap(actor).isA('vtkImageSlice'), 'explicit actor type used');

  defaults({ Mapper: null });
}

console.log('--- synthetic: full chain source.pipe().pipe().mapper().actor() ---');
{
  const MockFilter1 = mockVtkClass('vtkFilter1', {});
  const MockFilter2 = mockVtkClass('vtkFilter2', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const src = mockVtkObject('vtkSource', {});
  const actor = wrap(src).pipe(MockFilter1).pipe(MockFilter2).mapper().actor();
  assert(unwrap(actor).isA('vtkActor'), 'full chain creates actor');
  assert(unwrap(actor)._model._mapper.isA('vtkMapper'), 'mapper in chain');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- synthetic: source.pipe().actor() auto-mapper ---');
{
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const src = mockVtkObject('vtkSource', {});
  const actor = wrap(src).pipe(MockFilter).actor();
  assert(unwrap(actor).isA('vtkActor'), 'pipe.actor() auto-creates mapper');
  assert(unwrap(actor)._model._mapper !== undefined, 'auto-mapper present');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- synthetic: no clash with getMapper/getActor ---');
{
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const src = mockVtkObject('vtkSource', {});
  const actor = wrap(src).actor();

  // actor.mapper should call getMapper(), not return the synthetic function
  const m = actor.mapper;
  assert(isVtkObject(m), 'actor.mapper returns getMapper() result, not synthetic');
  assert(typeof m !== 'function', 'actor.mapper is not a function');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- view.add ---');
{
  const added = [];
  const mockRenderer = {
    addViewProp: (a) => added.push(a),
    isA: () => true,
  };
  const mockView = mockVtkObject('vtkFullScreenRenderWindow', {});
  mockView.getRenderer = () => mockRenderer;
  const wrappedView = wrap(mockView);

  const actor1 = mockVtkObject('vtkActor', {});
  const actor2 = mockVtkObject('vtkActor', {});

  const result = wrappedView.add(wrap(actor1), actor2);
  assert(added.length === 2, 'view.add added two props');
  assert(added[0] === actor1, 'view.add unwrapped first actor');
  assert(added[1] === actor2, 'view.add passed raw second actor');
  assert(result === wrappedView, 'view.add returns the wrapped view for chaining');

  // chaining
  const actor3 = mockVtkObject('vtkActor', {});
  wrappedView.add(actor3).add(actor3);
  assert(added.length === 4, 'view.add chaining works');
}

console.log('--- wrap auto-unwraps method arguments ---');
{
  let received = null;
  const renderer = mockVtkObject('vtkRenderer', {});
  renderer.addViewProp = (arg) => { received = arg; };
  const wrappedRenderer = wrap(renderer);

  const actor = mockVtkObject('vtkActor', {});
  const wrappedActor = wrap(actor);

  wrappedRenderer.addViewProp(wrappedActor);
  assert(received === actor, 'wrapped arg was auto-unwrapped');

  received = null;
  wrappedRenderer.addViewProp(actor);
  assert(received === actor, 'raw arg passed through unchanged');

  received = null;
  wrappedRenderer.addViewProp('hello');
  assert(received === 'hello', 'non-vtk arg passed through unchanged');
}

console.log('--- proxy property access for getOutputPort ---');
{
  const portFn = () => 'port-object';
  const source = mockVtkObject('vtkConeSource', {});
  source.getOutputPort = portFn;
  const wrappedSource = wrap(source);

  // outputPort as property should call getOutputPort() and return the result
  const port = wrappedSource.outputPort;
  assert(port === 'port-object', 'outputPort property calls getOutputPort()');

  // setInputConnection with port value and index
  let receivedArgs = null;
  const mapper = mockVtkObject('vtkMapper', {});
  mapper.setInputConnection = (...args) => { receivedArgs = args; };
  const wrappedMapper = wrap(mapper);

  wrappedMapper.setInputConnection(wrappedSource.outputPort, 1);
  assert(receivedArgs[0] === 'port-object', 'port value passed correctly');
  assert(receivedArgs[1] === 1, 'port index passed correctly');
}

// ---------------------------------------------------------------------------
// defineFilter / defineSource (uses real vtk.js macros)
// ---------------------------------------------------------------------------

import { defineFilter, defineSource, prop, pipe, merge } from './index.js';
import { polyData } from './polydata.js';

// ---------------------------------------------------------------------------
// Tests: merge()
// ---------------------------------------------------------------------------

console.log('--- merge: array form (addInputConnection) ---');
{
  const src1 = mockVtkObject('vtkSource1', {});
  const src2 = mockVtkObject('vtkSource2', {});
  const src3 = mockVtkObject('vtkSource3', {});
  const MockAppend = mockVtkClass('vtkAppendPolyData', {});

  const result = merge([wrap(src1), wrap(src2), wrap(src3)]).pipe(MockAppend);
  const raw = unwrap(result);
  assert(raw.isA('vtkAppendPolyData'), 'merge array creates filter');
  assert(raw._model._addedInputs.length === 3, 'three inputs added via addInputConnection');
}

console.log('--- merge: object form (setInputConnection) ---');
{
  const main = mockVtkObject('vtkMain', {});
  const glyph = mockVtkObject('vtkGlyph', {});
  const MockMapper = mockVtkClass('vtkGlyph3DMapper', {});

  const result = merge({ 0: wrap(main), 1: wrap(glyph) }).pipe(MockMapper);
  const raw = unwrap(result);
  assert(raw.isA('vtkGlyph3DMapper'), 'merge object creates mapper');
  assert(raw._model._input0 !== undefined, 'port 0 wired via setInputConnection');
  assert(raw._model._input1 !== undefined, 'port 1 wired via setInputConnection');
}

console.log('--- merge: mixed (array value = addInputConnection on that port) ---');
{
  const src1 = mockVtkObject('vtkSource1', {});
  const src2 = mockVtkObject('vtkSource2', {});
  const glyph = mockVtkObject('vtkGlyph', {});
  const MockMapper = mockVtkClass('vtkGlyph3DMapper', {});

  const result = merge({ 0: [wrap(src1), wrap(src2)], 1: wrap(glyph) }).pipe(MockMapper);
  const raw = unwrap(result);
  assert(raw._model._addedInputs.length === 2, 'port 0: two inputs added');
  assert(raw._model._input1 !== undefined, 'port 1: single input set');
}

console.log('--- merge: unwrapped sources work ---');
{
  const src1 = mockVtkObject('vtkSource1', {});
  const src2 = mockVtkObject('vtkSource2', {});
  const MockAppend = mockVtkClass('vtkAppendPolyData', {});

  const result = merge([src1, src2]).pipe(MockAppend);
  assert(unwrap(result)._model._addedInputs.length === 2, 'raw instances accepted');
}

console.log('--- merge: data objects (no getOutputPort) ---');
{
  const data1 = mockVtkObject('vtkPolyData1', {});
  delete data1.getOutputPort;
  const data2 = mockVtkObject('vtkPolyData2', {});
  delete data2.getOutputPort;
  const MockAppend = mockVtkClass('vtkAppendPolyData', {});

  const result = merge({ 0: data1, 1: data2 }).pipe(MockAppend);
  const raw = unwrap(result);
  assert(raw._model._data0 === data1, 'data object on port 0 via setInputData');
  assert(raw._model._data1 === data2, 'data object on port 1 via setInputData');
}

console.log('--- merge: chaining to .mapper().actor() ---');
{
  const src1 = mockVtkObject('vtkSource1', {});
  const src2 = mockVtkObject('vtkSource2', {});
  const MockAppend = mockVtkClass('vtkAppendPolyData', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = merge([wrap(src1), wrap(src2)]).pipe(MockAppend).actor();
  assert(unwrap(actor).isA('vtkActor'), 'merge → pipe → actor works');
  assert(unwrap(actor)._model._mapper !== undefined, 'actor has mapper');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- defineFilter: basic ---');
{
  const vtkDoubleFilter = defineFilter({
    name: 'vtkDoubleFilter',
    props: {
      factor: 2.0,
    },
    requestData(publicAPI, model, inData, outData) {
      outData[0] = { value: inData[0].value * model.factor };
    },
  });

  assert(typeof vtkDoubleFilter.newInstance === 'function', 'defineFilter returns newInstance');
  assert(typeof vtkDoubleFilter.extend === 'function', 'defineFilter returns extend');

  const f = vtkDoubleFilter.newInstance({ factor: 3.0 });
  assert(f.isA('vtkDoubleFilter'), 'isA works');
  assert(f.isA('vtkObject'), 'isA vtkObject works');
  assert(f.getFactor() === 3.0, 'getter works with initial value');
  f.setFactor(5.0);
  assert(f.getFactor() === 5.0, 'setter works');
  assert(typeof f.getOutputPort === 'function', 'algo getOutputPort exists');
  assert(typeof f.setInputData === 'function', 'algo setInputData exists');
  assert(typeof f.setInputConnection === 'function', 'algo setInputConnection exists');
}

console.log('--- defineFilter: array props ---');
{
  const vtkOffsetFilter = defineFilter({
    name: 'vtkOffsetFilter',
    props: {
      offset: [0, 0, 0],
      scale: 1.0,
    },
    requestData(publicAPI, model, inData, outData) {
      outData[0] = model.offset.map((v) => v * model.scale);
    },
  });

  const f = vtkOffsetFilter.newInstance();
  assert(JSON.stringify(f.getOffset()) === '[0,0,0]', 'array getter returns default');
  f.setOffset([1, 2, 3]);
  assert(JSON.stringify(f.getOffset()) === '[1,2,3]', 'array setter works');
  assert(f.getScale() === 1.0, 'scalar prop coexists with array prop');
}

console.log('--- defineFilter: custom methods ---');
{
  const vtkCustomFilter = defineFilter({
    name: 'vtkCustomFilter',
    props: { count: 0 },
    methods: {
      increment(publicAPI, model) {
        model.count++;
        publicAPI.modified();
      },
    },
    requestData(publicAPI, model, inData, outData) {
      outData[0] = inData[0];
    },
  });

  const f = vtkCustomFilter.newInstance();
  assert(f.getCount() === 0, 'initial count');
  f.increment();
  assert(f.getCount() === 1, 'custom method works');
}

console.log('--- defineSource ---');
{
  const vtkConstantSource = defineSource({
    name: 'vtkConstantSource',
    props: {
      value: 42,
    },
    requestData(publicAPI, model, inData, outData) {
      outData[0] = { value: model.value };
    },
  });

  const s = vtkConstantSource.newInstance();
  assert(s.isA('vtkConstantSource'), 'source isA works');
  assert(s.getValue() === 42, 'source getter works');
  assert(typeof s.getOutputPort === 'function', 'source has getOutputPort');
  // source has 0 inputs
  assert(s.getNumberOfInputPorts() === 0, 'source has 0 input ports');
}

console.log('--- defineFilter: default props not shared between instances ---');
{
  const vtkArrFilter = defineFilter({
    name: 'vtkArrFilter',
    props: { center: [0, 0, 0] },
    requestData() {},
  });

  const a = vtkArrFilter.newInstance();
  const b = vtkArrFilter.newInstance();
  a.setCenter([1, 2, 3]);
  assert(JSON.stringify(b.getCenter()) === '[0,0,0]', 'instances have independent defaults');
}

console.log('--- prop: min/max clamping ---');
{
  const vtkClampFilter = defineFilter({
    name: 'vtkClampFilter',
    props: {
      factor: prop(0.5, { min: 0, max: 1 }),
    },
    requestData() {},
  });

  const f = vtkClampFilter.newInstance();
  assert(f.getFactor() === 0.5, 'prop default works');
  f.setFactor(2.0);
  assert(f.getFactor() === 1.0, 'prop max clamps');
  f.setFactor(-0.5);
  assert(f.getFactor() === 0.0, 'prop min clamps');
  f.setFactor(0.7);
  assert(f.getFactor() === 0.7, 'prop accepts valid value');
}

console.log('--- prop: validate transform ---');
{
  const vtkRoundFilter = defineFilter({
    name: 'vtkRoundFilter',
    props: {
      count: prop(10, { validate: v => Math.floor(Math.abs(v)) }),
    },
    requestData() {},
  });

  const f = vtkRoundFilter.newInstance();
  f.setCount(3.7);
  assert(f.getCount() === 3, 'validate rounds down');
  f.setCount(-5.2);
  assert(f.getCount() === 5, 'validate takes abs then floors');
}

console.log('--- prop: validate throws ---');
{
  const vtkStrictFilter = defineFilter({
    name: 'vtkStrictFilter',
    props: {
      mode: prop('linear', {
        validate: v => {
          if (!['linear', 'cubic'].includes(v)) throw new Error(`invalid mode: ${v}`);
          return v;
        },
      }),
    },
    requestData() {},
  });

  const f = vtkStrictFilter.newInstance();
  f.setMode('cubic');
  assert(f.getMode() === 'cubic', 'validate accepts valid value');

  let threw = false;
  try { f.setMode('quadratic'); } catch (e) { threw = true; }
  assert(threw, 'validate throws on invalid value');
  assert(f.getMode() === 'cubic', 'value unchanged after throw');
}

console.log('--- prop: min/max + validate combined ---');
{
  const vtkComboFilter = defineFilter({
    name: 'vtkComboFilter',
    props: {
      step: prop(1, { min: 0, max: 100, validate: v => Math.round(v) }),
    },
    requestData() {},
  });

  const f = vtkComboFilter.newInstance();
  f.setStep(3.7);
  assert(f.getStep() === 4, 'clamp then round');
  f.setStep(150.2);
  assert(f.getStep() === 100, 'clamp to max then round');
  f.setStep(-5);
  assert(f.getStep() === 0, 'clamp to min');
}

console.log('--- prop: mixed with plain props ---');
{
  const vtkMixedFilter = defineFilter({
    name: 'vtkMixedFilter',
    props: {
      name: 'default',
      factor: prop(0.5, { min: 0 }),
      center: [0, 0, 0],
    },
    requestData() {},
  });

  const f = vtkMixedFilter.newInstance();
  assert(f.getName() === 'default', 'plain scalar prop works');
  assert(JSON.stringify(f.getCenter()) === '[0,0,0]', 'plain array prop works');
  f.setFactor(-1);
  assert(f.getFactor() === 0, 'validated prop clamps');
  f.setName('test');
  assert(f.getName() === 'test', 'plain prop still unconstrained');
}

console.log('--- schema: metadata accessible ---');
{
  const vtkDocFilter = defineFilter({
    name: 'vtkDocFilter',
    props: {
      factor: prop(0.5, { min: 0, max: 1, description: 'Scale factor' }),
      center: [0, 0, 0],
      mode: prop('linear', { description: 'Interpolation mode' }),
    },
    requestData() {},
  });

  assert(vtkDocFilter.schema.factor.default === 0.5, 'schema has default');
  assert(vtkDocFilter.schema.factor.min === 0, 'schema has min');
  assert(vtkDocFilter.schema.factor.max === 1, 'schema has max');
  assert(vtkDocFilter.schema.factor.description === 'Scale factor', 'schema has description');
  assert(JSON.stringify(vtkDocFilter.schema.center.default) === '[0,0,0]', 'plain prop in schema');
  assert(vtkDocFilter.schema.center.description === undefined, 'no description for plain prop');
  assert(vtkDocFilter.schema.mode.description === 'Interpolation mode', 'string prop description');
}

// ---------------------------------------------------------------------------
// polyData
// ---------------------------------------------------------------------------

console.log('--- polyData: flat points, auto-verts ---');
{
  const pd = polyData({ points: [0,0,0, 1,0,0, 1,1,0] });
  const raw = unwrap(pd);
  assert(raw.isA('vtkPolyData'), 'returns vtkPolyData');
  const pts = raw.getPoints().getData();
  assert(pts.length === 9, 'flat points parsed (9 floats)');
  assert(pts[3] === 1, 'second point x = 1');
  // auto-verts: 3 points → 3 vert cells
  const vData = raw.getVerts().getData();
  assert(vData.length === 6, 'auto-verts: 6 entries (3 cells × [1, idx])');
  assert(vData[0] === 1 && vData[1] === 0, 'first vert cell');
  assert(vData[4] === 1 && vData[5] === 2, 'third vert cell');
}

console.log('--- polyData: nested points ---');
{
  const pd = polyData({ points: [[0,0,0], [1,0,0], [1,1,0]] });
  const pts = unwrap(pd).getPoints().getData();
  assert(pts.length === 9, 'nested points flattened');
  assert(pts[6] === 1 && pts[7] === 1 && pts[8] === 0, 'third nested point correct');
}

console.log('--- polyData: Float32Array points ---');
{
  const typed = new Float32Array([0,0,0, 1,0,0]);
  const pd = polyData({ points: typed });
  const pts = unwrap(pd).getPoints().getData();
  assert(pts.length === 6, 'typed array points passed through');
  assert(pts instanceof Float32Array, 'result is Float32Array');
}

console.log('--- polyData: flat polys (auto-triangle) ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 1,1,0],
    polys: [0, 1, 2],
  });
  const raw = unwrap(pd);
  const pData = raw.getPolys().getData();
  assert(pData[0] === 3, 'triangle cell size prefix = 3');
  assert(pData[1] === 0 && pData[2] === 1 && pData[3] === 2, 'triangle indices');
  // no auto-verts since polys were given
  const vData = raw.getVerts().getData();
  assert(vData.length === 0, 'no auto-verts when polys specified');
}

console.log('--- polyData: nested polys ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 1,1,0, 0,1,0],
    polys: [[0,1,2], [0,2,3]],
  });
  const pData = unwrap(pd).getPolys().getData();
  assert(pData.length === 8, '2 triangles: 8 entries');
  assert(pData[0] === 3 && pData[4] === 3, 'size prefixes correct');
}

console.log('--- polyData: {size, data} polys ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 1,1,0, 0,1,0],
    polys: { size: 4, data: [0, 1, 2, 3] },
  });
  const pData = unwrap(pd).getPolys().getData();
  assert(pData[0] === 4, 'quad cell size = 4');
  assert(pData.length === 5, '1 quad: 5 entries');
}

console.log('--- polyData: raw Uint32Array polys (passthrough) ---');
{
  const raw = new Uint32Array([3, 0, 1, 2]);
  const pd = polyData({
    points: [0,0,0, 1,0,0, 1,1,0],
    polys: raw,
  });
  const pData = unwrap(pd).getPolys().getData();
  assert(pData.length === 4, 'raw passthrough length');
  assert(pData[0] === 3, 'raw passthrough data preserved');
}

console.log('--- polyData: flat lines (auto-pairs) ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 2,0,0],
    lines: [0, 1, 1, 2],
  });
  const lData = unwrap(pd).getLines().getData();
  assert(lData.length === 6, '2 line segments: 6 entries');
  assert(lData[0] === 2, 'line cell size = 2');
}

console.log('--- polyData: nested lines ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 2,0,0],
    lines: [[0, 1], [1, 2]],
  });
  const lData = unwrap(pd).getLines().getData();
  assert(lData.length === 6, 'nested lines: 6 entries');
}

console.log('--- polyData: point data (1-component) ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 1,1,0],
    polys: [0, 1, 2],
    pointData: { temperature: [20, 25, 30] },
  });
  const raw = unwrap(pd);
  const scalars = raw.getPointData().getScalars();
  assert(scalars !== null, 'scalars set');
  assert(scalars.getName() === 'temperature', 'scalar name correct');
  assert(scalars.getNumberOfComponents() === 1, '1 component');
  assert(scalars.getData().length === 3, '3 values');
}

console.log('--- polyData: point data (multi-component) ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 1,1,0],
    polys: [0, 1, 2],
    pointData: { velocity: { data: [1,0,0, 0,1,0, 0,0,1], components: 3 } },
  });
  const scalars = unwrap(pd).getPointData().getScalars();
  assert(scalars.getNumberOfComponents() === 3, '3 components');
  assert(scalars.getData().length === 9, '9 values for 3 vectors');
}

console.log('--- polyData: cell data ---');
{
  const pd = polyData({
    points: [0,0,0, 1,0,0, 1,1,0],
    polys: [0, 1, 2],
    cellData: { pressure: [101.3] },
  });
  const scalars = unwrap(pd).getCellData().getScalars();
  assert(scalars !== null, 'cell scalars set');
  assert(scalars.getName() === 'pressure', 'cell scalar name');
  assert(scalars.getData()[0] === Float32Array.from([101.3])[0], 'cell scalar value');
}

console.log('--- polyData: return value is wrapped ---');
{
  const pd = polyData({ points: [0,0,0, 1,0,0, 1,1,0], polys: [0,1,2] });
  // wrapped means property-style access works
  assert(typeof pd.isA === 'function', 'has isA method');
  assert(pd.isA('vtkPolyData'), 'isA vtkPolyData');
}

console.log('--- polyData: actor integration ---');
{
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockActorClass();
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const pd = polyData({ points: [0,0,0, 1,0,0, 1,1,0], polys: [0,1,2] });
  const actor = pd.actor();
  assert(unwrap(actor).isA('vtkActor'), 'polyData.actor() creates actor');
  assert(unwrap(actor)._model._mapper !== undefined, 'actor has mapper');

  defaults({ Mapper: null, Actor: null });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
