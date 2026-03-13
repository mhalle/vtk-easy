// Tests for vtk-easy
// Run: node index.test.js

import { defaults, wrap, unwrap, create, pipeline, wireChain, applyProps, isVtkObject } from './index.js';

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
    setInputData: (data, port = 0) => { model[`_data${port}`] = data; },
    setMapper: (m) => { model._mapper = m; },
    getMapper: () => model._mapper,
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
// Tests: pipeline() — fluent builder
// ---------------------------------------------------------------------------

console.log('--- pipeline: from class ---');
{
  const MockSource = mockVtkClass('vtkSource', { height: 1.0 });
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(MockSource, { height: 5.0 }).actor();
  assert(isVtkObject(unwrap(actor)), 'returns a vtk actor');
  assert(unwrap(actor).isA('vtkActor'), 'actor has correct type');
  assert(unwrap(actor)._model._mapper !== undefined, 'actor has mapper');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: from class, no props ---');
{
  const MockSource = mockVtkClass('vtkSource', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(MockSource).actor();
  assert(unwrap(actor).isA('vtkActor'), 'actor created from class with no props');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: from existing instance ---');
{
  const existing = mockVtkObject('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(existing).actor();
  assert(unwrap(actor).isA('vtkActor'), 'works with existing instance');
  assert(unwrap(actor)._model._mapper._model._input0 !== undefined, 'mapper wired to instance');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: from wrapped proxy ---');
{
  const raw = mockVtkObject('vtkSource', { height: 1.0 });
  const wrapped = wrap(raw);
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(wrapped).actor();
  assert(unwrap(actor).isA('vtkActor'), 'works with wrapped proxy');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: from raw data ---');
{
  const fakeData = { fake: 'polydata' };
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(fakeData).actor();
  assert(unwrap(actor).isA('vtkActor'), 'data pipeline creates actor');
  assert(unwrap(actor)._model._mapper._model._data0 === fakeData, 'data set on mapper');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: with explicit mapper ---');
{
  const MockSource = mockVtkClass('vtkSource', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Actor: MockActor });

  const actor = pipeline(MockSource).mapper(MockMapper).actor();
  assert(unwrap(actor).isA('vtkActor'), 'actor created');
  assert(unwrap(actor)._model._mapper !== undefined, 'actor has mapper');

  defaults({ Actor: null });
}

console.log('--- pipeline: with filter ---');
{
  const MockSource = mockVtkClass('vtkSource', {});
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(MockSource).filter(MockFilter).actor();
  assert(unwrap(actor).isA('vtkActor'), 'actor created with filter');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: with multiple filters ---');
{
  const MockSource = mockVtkClass('vtkSource', {});
  const MockFilter1 = mockVtkClass('vtkFilter1', {});
  const MockFilter2 = mockVtkClass('vtkFilter2', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(MockSource).filter(MockFilter1).filter(MockFilter2).actor();
  assert(unwrap(actor).isA('vtkActor'), 'actor created with two filters');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: non-default actor type ---');
{
  const MockSource = mockVtkClass('vtkSource', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockSlice = mockVtkClass('vtkImageSlice', {});
  defaults({ Mapper: MockMapper });

  const actor = pipeline(MockSource).actor(MockSlice);
  assert(unwrap(actor).isA('vtkImageSlice'), 'non-default actor type used');

  defaults({ Mapper: null });
}

console.log('--- pipeline: actor with property config ---');
{
  const MockSource = mockVtkClass('vtkSource', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(MockSource).actor({ property: { color: [1, 0, 0] } });
  assert(unwrap(actor).isA('vtkActor'), 'actor with property config created');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: branching (same source, two actors) ---');
{
  const src = mockVtkObject('vtkSource', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const a1 = pipeline(src).actor();
  const a2 = pipeline(src).actor();
  assert(unwrap(a1) !== unwrap(a2), 'two different actors');
  assert(unwrap(a1)._model._mapper !== unwrap(a2)._model._mapper, 'two different mappers');

  defaults({ Mapper: null, Actor: null });
}

console.log('--- pipeline: data with filter ---');
{
  const fakeData = { fake: 'polydata' };
  const MockFilter = mockVtkClass('vtkFilter', {});
  const MockMapper = mockVtkClass('vtkMapper', {});
  const MockActor = mockVtkClass('vtkActor', {});
  defaults({ Mapper: MockMapper, Actor: MockActor });

  const actor = pipeline(fakeData).filter(MockFilter).actor();
  assert(unwrap(actor).isA('vtkActor'), 'data + filter pipeline creates actor');

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
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
