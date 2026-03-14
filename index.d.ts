/**
 * vtk-easy — Ergonomic veneer over vtk.js
 *
 * Usage:
 *   import ez from 'vtk-easy';
 *   const view = ez.create(vtkFullScreenRenderWindow, { background: [0, 0, 0] });
 *   const cone = ez.create(vtkConeSource, { height: 1.5 });
 *   const actor = cone.actor();
 *   view.add(actor);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Any vtk.js object — has isA(), getClassName(), etc. */
interface VtkObject {
  isA(className: string): boolean;
  getClassName(depth?: number): string;
  [key: string]: any;
}

/** A vtk.js class with a newInstance factory. */
interface VtkClass<T extends VtkObject = VtkObject> {
  newInstance(initialValues?: Record<string, any>): T;
}

/** Options for view.show(). */
interface ShowOptions {
  /** Whether to reset the camera after adding actors. Default: true. */
  resetCamera?: boolean;
  /** Whether to render after adding actors. Default: true. */
  render?: boolean;
}

/** A wrapped vtk.js object with property-style access. */
export type Wrapped<T extends VtkObject = VtkObject> = T & {
  /** Access any vtk getter as a property: obj.height → obj.getHeight() */
  [key: string]: any;

  /**
   * Pipe this object's output into a downstream filter or algorithm.
   *
   *   source.pipe(vtkFilter, { prop: val })  // class + props
   *   source.pipe(existingFilter)             // instance
   *   data.pipe(vtkMapper)                    // data → setInputData
   *
   * Returns the wrapped downstream object for chaining.
   */
  pipe<U extends VtkObject>(
    typeOrInstance: VtkClass<U> | U | Wrapped<U>,
    props?: Record<string, any>,
  ): Wrapped<U>;

  /**
   * Create and wire a mapper. Uses the default Mapper class if none specified.
   * Tags the result so that .actor() knows to use it directly.
   */
  mapper(type?: VtkClass, props?: Record<string, any>): Wrapped;

  /**
   * Terminal: create an actor wired to a mapper.
   * If called after .mapper(), uses that mapper; otherwise auto-creates one.
   *
   *   source.actor()                          — default mapper + actor
   *   source.actor({ property: { color } })   — default mapper + actor with props
   *   source.actor(vtkImageSlice, props?)      — default mapper + explicit actor type
   *   source.mapper().actor()                  — explicit mapper, default actor
   */
  actor(typeOrProps?: VtkClass | Record<string, any>, props?: Record<string, any>): Wrapped;

  /**
   * Add actors to the renderer, reset camera, and render (synthetic on view-like objects).
   * Last argument may be options: { resetCamera?: boolean, render?: boolean }.
   * Returns the wrapped view for chaining.
   *
   *   view.show(actor1, actor2)
   *   view.show(actor, { resetCamera: false })
   */
  show(...actorsAndOptions: (VtkObject | Wrapped | ShowOptions)[]): Wrapped<T>;
};

// ---------------------------------------------------------------------------
// defaults
// ---------------------------------------------------------------------------

interface DefaultsConfig {
  /** Default RenderWindow class for createViewer(). */
  RenderWindow?: VtkClass | null;
  /** Default Mapper class for .mapper() / .actor(). */
  Mapper?: VtkClass | null;
  /** Default Actor class for .actor(). */
  Actor?: VtkClass | null;
}

/** Configure default Mapper/Actor classes used by .mapper() and .actor(). */
export function defaults(config: DefaultsConfig): void;

// ---------------------------------------------------------------------------
// wrap / unwrap / create
// ---------------------------------------------------------------------------

/**
 * Wrap a vtk.js instance with a Proxy for property-style access.
 *
 *   const cone = wrap(vtkConeSource.newInstance());
 *   cone.height = 2.0;   // calls setHeight(2.0)
 *   cone.height;          // calls getHeight()
 */
export function wrap<T extends VtkObject>(instance: T): Wrapped<T>;

/** Get the raw vtk.js instance from a wrapped object (or return as-is). */
export function unwrap<T extends VtkObject>(obj: Wrapped<T> | T): T;

/**
 * Create a vtk.js instance and wrap it.
 *
 *   const cone = create(vtkConeSource, { height: 1.5, resolution: 60 });
 *   cone.height = 2.0;  // already wrapped
 */
export function create<T extends VtkObject>(
  Type: VtkClass<T>,
  props?: Record<string, any>,
): Wrapped<T>;

// ---------------------------------------------------------------------------
// createViewer
// ---------------------------------------------------------------------------

interface ViewerOptions {
  /** RenderWindow class (overrides default). */
  RenderWindow?: VtkClass;
  /** DOM container element (for GenericRenderWindow). */
  container?: HTMLElement;
  /** Background color [r, g, b], default [0.1, 0.1, 0.1]. */
  background?: [number, number, number];
  [key: string]: any;
}

interface Viewer {
  helper: VtkObject;
  renderer: VtkObject;
  renderWindow: VtkObject;
  interactor: VtkObject;
  /** Add props to the renderer, reset camera, and render. */
  add(...props: (VtkObject | Wrapped)[]): void;
  /** Remove props from the renderer and render. */
  remove(...props: (VtkObject | Wrapped)[]): void;
  /** Re-render. */
  render(): void;
  /** Reset camera and render. */
  resetCamera(): void;
  /** Resize to fit container. */
  resize(): void;
}

/**
 * Create a viewer (renderer + render window + interactor).
 *
 *   const viewer = createViewer({ background: [0, 0, 0] });
 *   viewer.add(actor);
 */
export function createViewer(options?: ViewerOptions): Viewer;

// ---------------------------------------------------------------------------
// pipe — deferred pipeline template
// ---------------------------------------------------------------------------

/** A reusable pipeline template. Callable with a source to produce wired output. */
interface PipeTemplate {
  /** Append a filter stage to the template (classes only, not instances). */
  pipe(type: VtkClass, props?: Record<string, any>): PipeTemplate;
  /** Set the mapper for the template (classes only). */
  mapper(type?: VtkClass, props?: Record<string, any>): PipeTemplate;
  /** Set the actor for the template — makes the template terminal. */
  actor(typeOrProps?: VtkClass | Record<string, any>, props?: Record<string, any>): PipeTemplate;
  /** Apply the template to a source — creates fresh instances and wires via .pipe(). */
  (source: VtkClass | VtkObject | Wrapped | any, props?: Record<string, any>): Wrapped;
}

/**
 * Create a deferred pipeline template. Only accepts classes (not instances).
 *
 *   const enhance = ez.pipe(vtkNormals).pipe(vtkCellCenters);
 *   enhance(cone)       // fresh instances, wired
 *   enhance(cylinder)   // reusable
 */
export function pipe(type: VtkClass, props?: Record<string, any>): PipeTemplate;

// ---------------------------------------------------------------------------
// merge — multi-input wiring
// ---------------------------------------------------------------------------

type MergeSource = VtkObject | Wrapped;

/** Port map: port number → source or array of sources. */
type MergePortMap = Record<number, MergeSource | MergeSource[]>;

interface MergeResult {
  /** Wire all merged inputs into a downstream filter/mapper. */
  pipe<U extends VtkObject>(
    typeOrInstance: VtkClass<U> | U | Wrapped<U>,
    props?: Record<string, any>,
  ): Wrapped<U>;
}

/**
 * Wire multiple sources into a multi-input filter or mapper.
 *
 * Array form — addInputConnection (all on port 0):
 *   ez.merge([source1, source2]).pipe(vtkAppendPolyData)
 *
 * Object form — setInputConnection per port:
 *   ez.merge({ 0: mainSource, 1: glyphSource }).pipe(vtkGlyph3DMapper)
 *
 * Mixed — array value means addInputConnection on that port:
 *   ez.merge({ 0: [src1, src2], 1: glyph }).pipe(vtkGlyph3DMapper)
 */
export function merge(spec: MergeSource[] | MergePortMap): MergeResult;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Apply a { propName: value } map to a vtk.js instance via setXxx() calls. */
export function applyProps(target: VtkObject, props: Record<string, any>): void;

/** Wire a chain of vtk algorithms via setInputConnection / getOutputPort. */
export function wireChain(chain: VtkObject[]): void;

/** Check if an object is a vtk.js instance (has isA method). */
export function isVtkObject(obj: any): obj is VtkObject;

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

declare const ez: {
  defaults: typeof defaults;
  wrap: typeof wrap;
  unwrap: typeof unwrap;
  create: typeof create;
  createViewer: typeof createViewer;
  pipe: typeof pipe;
  merge: typeof merge;
  applyProps: typeof applyProps;
  wireChain: typeof wireChain;
  isVtkObject: typeof isVtkObject;
};

export default ez;
