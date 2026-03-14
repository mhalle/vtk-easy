// vtk-easy — ergonomic veneer over vtk.js
//
// Does not modify or patch vtk.js internals. Every returned object
// is a real vtk.js instance (optionally wrapped in a Proxy for
// property-style access). Drop down to the raw API any time.
//
// Usage:
//   import ez from 'vtk-easy';
//   const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
//   const actor = ez.pipeline(vtkConeSource, { height: 1.5 }).actor();
//   view.add(actor);
//   view.renderer.resetCamera();
//   view.renderWindow.render();

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor.js';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper.js';
import macro from '@kitware/vtk.js/macros.js';

// ---------------------------------------------------------------------------
// defaults — override the built-in Mapper/Actor if needed
// ---------------------------------------------------------------------------

const _defaults = {
  Mapper: vtkMapper,
  Actor: vtkActor,
};

function defaults(config) {
  Object.assign(_defaults, config);
}

// ---------------------------------------------------------------------------
// wrap — property-style access for vtk.js objects
// ---------------------------------------------------------------------------
//
//   const cone = wrap(vtkConeSource.newInstance());
//   cone.height = 2.0;          // calls setHeight(2.0)
//   console.log(cone.height);   // calls getHeight()
//
// Methods on frozen publicAPI pass through unchanged (Proxy invariant).
// The getXxx() convention is used for property-style reads:
//   actor.property.color = [1, 0, 0];   // actor.getProperty() → wrap → setColor

const WRAP_TAG = Symbol('vtkEasyWrap');
const RAW_TAG = Symbol('vtkEasyRaw');

function wrap(instance) {
  if (!instance) return instance;
  if (instance[WRAP_TAG]) return instance; // already wrapped

  return new Proxy(instance, {
    get(target, prop, receiver) {
      if (prop === WRAP_TAG) return true;
      if (prop === RAW_TAG) return target;
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);

      // direct properties and methods pass through first
      const direct = target[prop];
      if (direct !== undefined) {
        if (typeof direct === 'function') {
          // Proxy invariant: non-configurable data properties must return
          // their exact value.  vtk.js freezes publicAPI, so every method
          // is non-configurable — return it as-is.
          const desc = Object.getOwnPropertyDescriptor(target, prop);
          if (desc && !desc.configurable) return direct;
          // wrap methods that return vtk objects so the chain stays proxied
          return (...args) => {
            const result = direct.apply(target, args.map(unwrapArg));
            if (isVtkObject(result)) return wrap(result);
            return result;
          };
        }
        return direct;
      }

      // synthetic pipe() — wire this object's output into a downstream stage
      //   source.pipe(vtkFilterClass, props?)  → creates, wires, returns wrapped
      //   source.pipe(existingInstance)         → wires, returns wrapped
      //   data.pipe(vtkFilterClass)             → uses setInputData
      if (prop === 'pipe') {
        return (typeOrInstance, props) => {
          const downstream = resolveArg(typeOrInstance, props);
          if (typeof target.getOutputPort === 'function') {
            downstream.setInputConnection(target.getOutputPort());
          } else {
            downstream.setInputData(target);
          }
          return wrap(downstream);
        };
      }

      // synthetic add() for objects with a renderer (FullScreenRenderWindow, etc.)
      if (prop === 'add' && typeof target.getRenderer === 'function') {
        return (...actors) => {
          const renderer = target.getRenderer();
          actors.forEach((a) => renderer.addViewProp(unwrap(a)));
          return receiver;
        };
      }

      // try the getXxx() convention
      const cap = capitalize(prop);
      const getter = target[`get${cap}`];
      if (typeof getter === 'function') {
        const val = getter.call(target);
        if (isVtkObject(val)) return wrap(val);
        return val;
      }

      return undefined;
    },

    set(target, prop, value) {
      const setter = target[`set${capitalize(prop)}`];
      if (typeof setter === 'function') {
        setter.call(target, value);
        return true;
      }
      target[prop] = value;
      return true;
    },
  });
}

// Get the raw vtk.js instance from a wrapped object (or return as-is).
function unwrap(obj) {
  if (!obj) return obj;
  return obj[RAW_TAG] || obj;
}

// ---------------------------------------------------------------------------
// create — shorthand for Type.newInstance(props), returns wrapped
// ---------------------------------------------------------------------------
//
//   const cone = create(vtkConeSource, { height: 1.5, resolution: 60 });
//   cone.height = 2.0;  // already wrapped

function create(Type, props = {}) {
  return wrap(Type.newInstance(props));
}

// ---------------------------------------------------------------------------
// pipeline — fluent pipeline builder
// ---------------------------------------------------------------------------
//
// From a class:
//   ez.pipeline(vtkConeSource).actor()
//   ez.pipeline(vtkConeSource, { height: 1.5 }).actor()
//
// From an existing instance or wrapped proxy:
//   const cone = ez.create(vtkConeSource);
//   ez.pipeline(cone).actor()
//
// From raw data:
//   ez.pipeline(polyData).actor()
//
// With filters:
//   ez.pipeline(vtkPlaneSource).filter(calculator).filter(vtkWarpScalar).actor()
//
// Non-default mapper/actor:
//   ez.pipeline(vtkRTAnalyticSource)
//     .mapper(vtkImageMapper, { sliceAtFocalPoint: true })
//     .actor(vtkImageSlice, { property: { colorWindow: 255 } })
//
// Add to view:
//   view.add(
//     ez.pipeline(vtkConeSource).actor(),
//     ez.pipeline(vtkConeSource, { center: [2, 0, 0] }).actor({ property: { color: [1, 0, 0] } }),
//   );

class PipelineBuilder {
  constructor(input) {
    this._input = input;  // raw vtk instance or data object
    this._filters = [];
    this._mapperConfig = null;
  }

  filter(typeOrInstance, props) {
    this._filters.push({ typeOrInstance, props });
    return this;
  }

  mapper(typeOrInstance, props) {
    this._mapperConfig = { typeOrInstance, props };
    return this;
  }

  actor(typeOrInstanceOrProps, props) {
    // actor()                        — default type, no props
    // actor({ property: {...} })     — default type, with props
    // actor(vtkImageSlice)           — explicit type, no props
    // actor(vtkImageSlice, { ... })  — explicit type, with props
    let actorInstance;
    let actorProps;

    if (!typeOrInstanceOrProps) {
      actorInstance = _defaults.Actor.newInstance();
      actorProps = null;
    } else if (isVtkObject(typeOrInstanceOrProps)) {
      actorInstance = typeOrInstanceOrProps;
      actorProps = null;
    } else if (isVtkClass(typeOrInstanceOrProps)) {
      actorInstance = typeOrInstanceOrProps.newInstance(stripReserved(props || {}));
      actorProps = props;
    } else {
      // plain config object like { property: { color: [1,0,0] } }
      actorInstance = _defaults.Actor.newInstance();
      actorProps = typeOrInstanceOrProps;
    }

    // Resolve mapper
    const mapperCfg = this._mapperConfig;
    const mapper = mapperCfg
      ? resolveArg(mapperCfg.typeOrInstance, mapperCfg.props)
      : _defaults.Mapper.newInstance();

    // Wire: input → filters → mapper using pipe()
    let current = wrap(this._input);
    for (const { typeOrInstance: ft, props: fp } of this._filters) {
      current = current.pipe(ft, fp);
    }
    current.pipe(mapper);

    // Actor ← mapper
    actorInstance.setMapper(mapper);

    // Actor properties
    const propConfig = actorProps && actorProps.property;
    if (propConfig && typeof propConfig === 'object') {
      applyProps(actorInstance.getProperty(), propConfig);
    }

    // Return wrapped actor
    return wrap(actorInstance);
  }
}

function pipeline(input, props) {
  // Detect what we got:
  //   vtk class (has newInstance)  → create instance
  //   vtk instance or wrapped     → unwrap
  //   anything else               → raw data
  // pipe() handles algorithm-vs-data detection automatically.
  if (isVtkClass(input)) {
    return new PipelineBuilder(input.newInstance(props || {}));
  }
  const raw = unwrap(input);
  if (isVtkObject(raw)) {
    return new PipelineBuilder(raw);
  }
  return new PipelineBuilder(input);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const RESERVED_KEYS = new Set(['type', 'property', 'inputs']);

function stripReserved(obj) {
  const props = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!RESERVED_KEYS.has(k)) props[k] = v;
  }
  return props;
}

// Resolve a (Type, props) or (instance) argument to a vtk instance.
function resolveArg(typeOrInstance, props) {
  if (isVtkObject(typeOrInstance)) return typeOrInstance;
  const raw = unwrap(typeOrInstance);
  if (isVtkObject(raw)) return raw;
  if (isVtkClass(typeOrInstance)) {
    return typeOrInstance.newInstance(props ? stripReserved(props) : {});
  }
  throw new Error('Expected a vtk class or instance');
}

function isVtkObject(obj) {
  return obj && typeof obj === 'object' && typeof obj.isA === 'function';
}

function isVtkClass(obj) {
  return obj && typeof obj.newInstance === 'function';
}

function unwrapArg(a) {
  return (a && a[RAW_TAG]) ? a[RAW_TAG] : a;
}

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function wireChain(chain) {
  for (let i = 1; i < chain.length; i++) {
    const prev = chain[i - 1];
    const curr = chain[i];
    if (typeof curr.setInputConnection === 'function' &&
        typeof prev.getOutputPort === 'function') {
      curr.setInputConnection(prev.getOutputPort());
    }
  }
}

function applyProps(target, props) {
  if (!target || !props) return;
  for (const [key, value] of Object.entries(props)) {
    const setter = target[`set${capitalize(key)}`];
    if (typeof setter === 'function') {
      setter.call(target, value);
    }
  }
}

// ---------------------------------------------------------------------------
// prop — tagged property descriptor for defineFilter/defineSource
// ---------------------------------------------------------------------------
//
//   ez.prop(0.5, { min: 0, max: 1, description: 'Scale factor' })
//   ez.prop(42, { validate: v => Math.floor(v) })

const PROP_TAG = Symbol('vtkEasyProp');

function prop(defaultValue, options = {}) {
  return { [PROP_TAG]: true, default: defaultValue, ...options };
}

// ---------------------------------------------------------------------------
// defineFilter / defineSource — declarative vtk.js module creation
// ---------------------------------------------------------------------------
//
// Generates a standard vtk.js module ({ newInstance, extend }) from a
// simple declaration.  The result plugs into pipelines, has proper
// getXxx/setXxx methods, and passes isA() checks — it IS a vtk.js object.
//
//   const vtkMyFilter = ez.defineFilter({
//     name: 'vtkMyFilter',
//     props: {
//       shrinkFactor: ez.prop(0.5, { min: 0, max: 1 }),
//       center: [0, 0, 0],
//       seed: 42,
//     },
//     requestData(publicAPI, model, inData, outData) { ... },
//   });
//
//   const f = vtkMyFilter.newInstance({ shrinkFactor: 0.8 });

function defineModule(spec, numInputs, numOutputs) {
  const { name, props = {}, requestData, methods } = spec;
  if (!name) throw new Error('defineFilter/defineSource requires a name');

  // Parse props: separate scalar vs array, extract defaults and validators
  const scalarFields = [];
  const arrayFields = {};  // field → size
  const defaultValues = {};
  const validators = {};   // field → validate function

  const schema = {};  // field → { default, min, max, description, ... }

  for (const [key, raw] of Object.entries(props)) {
    const isPropDescriptor = raw && raw[PROP_TAG];
    const value = isPropDescriptor ? raw.default : raw;
    defaultValues[key] = value;

    if (Array.isArray(value)) {
      arrayFields[key] = value.length;
    } else {
      scalarFields.push(key);
    }

    // Build schema entry
    const entry = { default: value };
    if (isPropDescriptor) {
      const { min, max, description, validate } = raw;
      if (min != null) entry.min = min;
      if (max != null) entry.max = max;
      if (description) entry.description = description;

      if (validate || min != null || max != null) {
        validators[key] = (v) => {
          let result = v;
          if (min != null && result < min) result = min;
          if (max != null && result > max) result = max;
          if (validate) result = validate(result);
          return result;
        };
      }
    }
    schema[key] = entry;
  }

  function impl(publicAPI, model) {
    model.classHierarchy.push(name);

    if (requestData) {
      publicAPI.requestData = (inData, outData) =>
        requestData(publicAPI, model, inData, outData);
    }

    // Override setters for validated props
    for (const [field, validate] of Object.entries(validators)) {
      const cap = capitalize(field);
      const original = publicAPI[`set${cap}`];
      publicAPI[`set${cap}`] = (value) => original(validate(value));
    }

    // Attach any extra methods
    if (methods) {
      for (const [methodName, fn] of Object.entries(methods)) {
        publicAPI[methodName] = (...args) => fn(publicAPI, model, ...args);
      }
    }
  }

  function extend(publicAPI, model, initialValues = {}) {
    Object.assign(model, structuredClone(defaultValues), initialValues);
    macro.obj(publicAPI, model);
    macro.algo(publicAPI, model, numInputs, numOutputs);
    if (scalarFields.length > 0) {
      macro.setGet(publicAPI, model, scalarFields);
    }
    for (const [field, size] of Object.entries(arrayFields)) {
      macro.setGetArray(publicAPI, model, [field], size);
    }
    impl(publicAPI, model);
  }

  const newInstance = macro.newInstance(extend, name);

  return { newInstance, extend, schema };
}

function defineFilter(spec) {
  const { inputs = 1, outputs = 1 } = spec;
  return defineModule(spec, inputs, outputs);
}

function defineSource(spec) {
  const { outputs = 1 } = spec;
  return defineModule(spec, 0, outputs);
}

// ---------------------------------------------------------------------------
// exports
// ---------------------------------------------------------------------------

export { defaults, wrap, unwrap, create, pipeline, applyProps, wireChain, isVtkObject, defineFilter, defineSource, prop };
export default { defaults, wrap, unwrap, create, pipeline, applyProps, wireChain, isVtkObject, defineFilter, defineSource, prop };
