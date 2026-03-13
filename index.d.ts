/**
 * vtk-easy — Ergonomic veneer over vtk.js
 *
 * Usage:
 *   import ez from 'vtk-easy';
 *   ez.defaults({ RenderWindow: vtkFullScreenRenderWindow, Mapper: vtkMapper, Actor: vtkActor });
 *   const viewer = ez.createViewer({ background: [0, 0, 0] });
 *   const src = ez.create(vtkConeSource, { height: 1.5 });
 *   const { actor } = ez.pipeline({ source: src, viewer });
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

/** A wrapped vtk.js object with property-style access. */
type Wrapped<T extends VtkObject = VtkObject> = T & {
  /** Access any vtk getter as a property: obj.height → obj.getHeight() */
  [key: string]: any;
};

// ---------------------------------------------------------------------------
// defaults
// ---------------------------------------------------------------------------

interface DefaultsConfig {
  /** Default RenderWindow class for createViewer(). */
  RenderWindow?: VtkClass | null;
  /** Default Mapper class for pipeline(). */
  Mapper?: VtkClass | null;
  /** Default Actor class for pipeline(). */
  Actor?: VtkClass | null;
}

/** Configure default classes used by createViewer() and pipeline(). */
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
// pipeline
// ---------------------------------------------------------------------------

/** A pipeline stage config: either a vtk instance or { type, ...props }. */
type StageConfig = VtkObject | { type: VtkClass; [key: string]: any };

interface PipelineConfig {
  /** Source algorithm or config. */
  source?: StageConfig;
  /** Direct data input (instead of source). */
  data?: any;
  /** Filter stages between source and mapper. */
  filters?: StageConfig[];
  /** Mapper config — defaults to defaults().Mapper if no type given. */
  mapper?: StageConfig | Record<string, any>;
  /** Actor config — defaults to defaults().Actor if no type given. */
  actor?: StageConfig | { type?: VtkClass; property?: Record<string, any>; [key: string]: any };
  /** Renderer to add the actor to. */
  renderer?: VtkObject;
  /** Viewer to add the actor to (calls viewer.add). */
  viewer?: Viewer;
  /** If true, return raw vtk instances instead of wrapped. */
  raw?: boolean;
}

interface PipelineResult {
  actor: Wrapped;
  mapper: Wrapped;
  source?: Wrapped;
  filters?: Wrapped[];
}

/**
 * Create and wire a vtk.js pipeline declaratively.
 *
 *   const { actor } = pipeline({
 *     source: { type: vtkConeSource, height: 1.5 },
 *     actor: { property: { color: [1, 0, 0] } },
 *     viewer,
 *   });
 */
export function pipeline(config: PipelineConfig): PipelineResult;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Resolve a config to a vtk.js instance. */
export function resolve(config: StageConfig | null, FallbackType?: VtkClass): VtkObject | null;

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
  pipeline: typeof pipeline;
  resolve: typeof resolve;
  applyProps: typeof applyProps;
  wireChain: typeof wireChain;
  isVtkObject: typeof isVtkObject;
};

export default ez;
