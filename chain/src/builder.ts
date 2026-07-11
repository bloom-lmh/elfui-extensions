// 链式 builder API
//
// 主路径：
//   const Counter = ElfUI.createComponent()
//     .name("elf-counter")
//     .props({ initial: { type: Number, default: 0 } })
//     .setup(({ initial }) => {
//       const count = useRef(initial);
//       return { count, inc: () => count.set(count.peek() + 1) };
//     })
//     .render((ctx) => { ... })
//     .style("button { color: red; }")
//     .register();
//
// 与旧版链式 API 兼容心智：
// - createComponent / .name / .props / .setup / .template / .style / .use /
//   .emits / .formControl / .register / .build / .toDefinition
// - .template 在 B3 codegen 完成后会自动调用 compiler 编译为 render；
//   当前阶段先暴露 .render（手写或编译产物）

import { defineCustomElement, ensureCustomElement } from "@elfui/runtime";
import type {
  ComponentDefinition,
  DirectiveDefinition,
  ElfElementConstructor,
  EmitOptions,
  PropOption,
  PropType,
  PropsOptions,
  RenderFn,
  SetupContext,
  SetupFn,
} from "@elfui/runtime";

// 模板编译器注入点：避免 runtime -> compiler 的循环依赖。
// @elfui/chain 导入 compiler 后调用 setTemplateCompiler 注入。
type TemplateCompileFn = (tpl: string) => RenderFn;
let injectedCompiler: TemplateCompileFn | null = null;

export const setTemplateCompiler = (fn: TemplateCompileFn): void => {
  injectedCompiler = fn;
};

let autoTagId = 0;
const nextAutoTag = (): string => `elf-anonymous-${++autoTagId}`;

/** 用作 builder.use() 接收的子组件输入 */
export type UsableComponent =
  | string
  | CustomElementConstructor
  | { __elfDefinition?: { tag?: string } };

export class ElementBuilder {
  private definition: ComponentDefinition;

  public constructor(definition?: Partial<ComponentDefinition>) {
    this.definition = {
      tag: definition?.tag ?? "",
      ...(definition ?? {}),
    } as ComponentDefinition;
  }

  /** 设置 tag 名（kebab-case，必须含连字符） */
  public name(tag: string): this {
    this.definition.tag = tag;
    return this;
  }

  /** props 选项 */
  public props(props: PropsOptions): this {
    this.definition.props = { ...(this.definition.props ?? {}), ...props };
    return this;
  }

  /** setup 函数 */
  public setup(fn: SetupFn): this {
    this.definition.setup = fn;
    return this;
  }

  /** 手写 render 函数（或编译产物） */
  public render(fn: RenderFn): this {
    this.definition.render = fn;
    return this;
  }

  /** 模板字符串：通过 setTemplateCompiler 注入的编译器编译为 render 函数 */
  public template(tpl: string): this {
    if (!injectedCompiler) {
      throw new Error(
        "[ElfUI] .template() 需要先注入编译器。请通过 @elfui/chain 使用，" +
          "或先调用 setTemplateCompiler(compileFn)。",
      );
    }
    this.definition.render = injectedCompiler(tpl);
    return this;
  }

  /** Shadow DOM 样式（CSS 字符串，可调用多次累加） */
  public style(css: string): this {
    this.definition.styles = [...(this.definition.styles ?? []), css];
    return this;
  }

  /** Shadow mode */
  public shadow(mode: "open" | "closed" | false): this {
    this.definition.shadow = mode;
    return this;
  }

  /** form 关联 */
  public formControl(enabled: boolean = true): this {
    this.definition.formControl = enabled;
    return this;
  }

  /** 事件白名单 */
  public emits(...events: string[]): this {
    this.definition.emits = [...(this.definition.emits ?? []), ...events];
    return this;
  }

  /** 事件派发选项 */
  public emitOptions(options: EmitOptions): this {
    this.definition.emitOptions = {
      ...(this.definition.emitOptions ?? {}),
      ...options,
    };
    return this;
  }

  /** 局部注册子组件（自动 customElements.define） */
  public use(component: UsableComponent, alias?: string): this;
  public use(components: UsableComponent[]): this;
  public use(components: Record<string, UsableComponent>): this;
  public use(
    input:
      | UsableComponent
      | UsableComponent[]
      | Record<string, UsableComponent>,
    alias?: string,
  ): this {
    if (Array.isArray(input)) {
      for (const c of input) this.useOne(c);
    } else if (
      typeof input === "object" &&
      input !== null &&
      !("__elfDefinition" in input || typeof input === "string")
    ) {
      for (const k of Object.keys(input as Record<string, UsableComponent>)) {
        this.useOne((input as Record<string, UsableComponent>)[k]!, k);
      }
    } else {
      this.useOne(input as UsableComponent, alias);
    }
    return this;
  }

  private useOne(component: UsableComponent, alias?: string): void {
    let tag: string | undefined;
    let ctor: CustomElementConstructor | undefined;
    if (typeof component === "string") {
      tag = component;
    } else if (typeof component === "function") {
      ctor = component;
      const def = (
        component as unknown as { __elfDefinition?: { tag?: string } }
      ).__elfDefinition;
      tag = def?.tag;
    }
    if (alias) {
      this.definition.components = {
        ...(this.definition.components ?? {}),
        [alias]: ctor ?? tag ?? "",
      };
    } else if (tag) {
      this.definition.components = {
        ...(this.definition.components ?? {}),
        [tag]: ctor ?? tag,
      };
    }
  }

  /** 局部自定义指令 */
  public directive(name: string, def: DirectiveDefinition): this {
    this.definition.directives = {
      ...(this.definition.directives ?? {}),
      [name]: def as unknown,
    };
    return this;
  }

  /** 是否已显式设置 tag */
  public hasName(): boolean {
    return !!this.definition.tag;
  }

  /** 拿到当前 definition 的副本 */
  public toDefinition(): ComponentDefinition {
    return { ...this.definition, props: { ...(this.definition.props ?? {}) } };
  }

  /** 构建为 CustomElementConstructor。如未指定 tag 自动生成 */
  public build(): ElfElementConstructor {
    if (!this.definition.tag) {
      this.definition.tag = nextAutoTag();
    }
    return defineCustomElement(this.definition, { register: false });
  }

  /** build 并注册（默认使用已设置的 tag；可显式覆盖） */
  public register(tag?: string): ElfElementConstructor {
    if (tag) this.definition.tag = tag;
    const ctor = this.build();
    ensureCustomElement(ctor);
    return ctor;
  }
}

/** 创建一个新的链式 builder */
export const createComponent = (): ElementBuilder => new ElementBuilder();

/** 可被 extend / variant 接收的"组件来源"：
 *  - `ElementBuilder` 实例（含 toDefinition）
 *  - 已 build/register 的 `ElfElementConstructor`（构造函数挂了 __elfDefinition）
 *  - 直接传入 `ComponentDefinition` 对象
 */
export type ExtendableComponent =
  | ElementBuilder
  | { __elfDefinition?: ComponentDefinition }
  | ComponentDefinition;

/** 把任意来源解析为 ComponentDefinition（不可变副本） */
const resolveComponentDefinition = (
  input: ExtendableComponent,
): ComponentDefinition => {
  if (input instanceof ElementBuilder) return input.toDefinition();
  const ref = (input as { __elfDefinition?: ComponentDefinition })
    .__elfDefinition;
  if (ref) return cloneDefinition(ref);
  // 直接是 ComponentDefinition 对象
  return cloneDefinition(input as ComponentDefinition);
};

/** 浅拷贝 + 子集合分别拷贝，避免 extend 时共享引用导致父子互相影响 */
const cloneDefinition = (def: ComponentDefinition): ComponentDefinition => {
  const cloned: ComponentDefinition = {
    ...def,
    props: { ...(def.props ?? {}) },
  };
  if (def.emits) cloned.emits = [...def.emits];
  if (def.emitOptions) cloned.emitOptions = { ...def.emitOptions };
  if (def.styles) cloned.styles = [...def.styles];
  return cloned;
};

/** 基于已有组件创建一个新 builder（继承 props / setup / render / styles / emits 等）
 *
 *  典型用法：在 base 组件上扩展自己的 setup / template / style：
 *
 *    const PrimaryBtn = extend(BaseButton)
 *      .name("primary-btn")
 *      .style(`button { color: var(--elf-color-primary); }`)
 *      .register();
 *
 *  注意：返回的 builder 不带原始 tag/name；必须重新 .name(...) 才能 register。
 */
export const extend = (component: ExtendableComponent): ElementBuilder => {
  const def = resolveComponentDefinition(component);
  // 清掉 tag — variant / extend 必须重新 .name()
  def.tag = "";
  return new ElementBuilder(def);
};

/** variant — extend + 立即给定新名 + 可选的二次配置回调。
 *
 *    variant(BaseButton, "danger-btn", (b) => {
 *      b.style(`button { color: var(--elf-color-error); }`);
 *    }).register();
 *
 *    // 也可省 configure，保留 builder 链式继续：
 *    variant(BaseButton, "warning-btn")
 *      .style(`button { color: var(--elf-color-warning); }`)
 *      .register();
 */
export type VariantConfigurator = (builder: ElementBuilder) => void;

export const variant = (
  component: ExtendableComponent,
  name: string,
  configure?: VariantConfigurator,
): ElementBuilder => {
  const builder = extend(component).name(name);
  configure?.(builder);
  return builder;
};

/** 对象式入口：避免链式调用，把所有配置一次传入。
 *
 *  与 createComponent 等价：内部把 options 喂给 builder。
 *
 *  ```ts
 *  defineComponent({
 *    name: "elf-counter",
 *    props: { initial: { type: Number, default: 0 } },
 *    emits: ["change"],
 *    setup(props, ctx) {
 *      const count = useRef(props.initial);
 *      const inc = () => count.set(count.value + 1);
 *      return { count, inc };
 *    },
 *    template: `<button @click="inc">{{ count }}</button>`,
 *    styles: [`button { color: red }`]
 *  });
 *  ```
 */
type InferPropConstructorValue<T> = T extends StringConstructor
  ? string
  : T extends NumberConstructor
    ? number
    : T extends BooleanConstructor
      ? boolean
      : T extends ArrayConstructor
        ? unknown[]
        : T extends ObjectConstructor
          ? Record<string, unknown>
          : T extends FunctionConstructor
            ? (...args: unknown[]) => unknown
            : T extends new (...args: unknown[]) => infer R
              ? R
              : unknown;

type InferDefaultValue<T> = T extends (...args: unknown[]) => infer R ? R : T;

type InferPropValue<T> = T extends { type: infer C }
  ? [NonNullable<C>] extends [never]
    ? T extends { default: infer D }
      ? InferDefaultValue<D>
      : unknown
    : InferPropConstructorValue<NonNullable<C>>
  : T extends PropOption<infer V>
    ? unknown extends V
      ? T extends { default: infer D }
        ? InferDefaultValue<D>
        : unknown
      : V
    : T extends
          | StringConstructor
          | NumberConstructor
          | BooleanConstructor
          | ArrayConstructor
          | ObjectConstructor
          | FunctionConstructor
      ? InferPropConstructorValue<T>
      : T extends PropType<infer V>
        ? V
        : InferDefaultValue<T>;

export type InferPropsOptions<T extends Record<string, unknown>> = {
  [K in keyof T]: InferPropValue<T[K]>;
};

export type EmitMap = Record<string, unknown[]>;
export type SlotsMap = object;

export interface TypedSetupContext<
  Emits extends EmitMap = EmitMap,
  Slots extends SlotsMap = SlotsMap,
> extends Omit<SetupContext, "emit"> {
  emit: <K extends keyof Emits & string>(event: K, ...args: Emits[K]) => void;
  /** 仅类型层：运行时仍通过 useScopedSlot(name) 取渲染函数。 */
  readonly slots?: Slots;
}

export type TypedSetup<
  Props extends object = Record<string, unknown>,
  Emits extends EmitMap = EmitMap,
  Slots extends SlotsMap = SlotsMap,
> = (
  props: Readonly<Props>,
  ctx: TypedSetupContext<Emits, Slots>,
) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

export interface DefineComponentOptions<
  Props extends object = Record<string, unknown>,
  Emits extends EmitMap = EmitMap,
  Slots extends SlotsMap = SlotsMap,
> {
  /** 组件标签名；推荐使用 name，tag 作为 Web Components 语义别名保留。 */
  name?: string;
  tag?: string;
  props?: PropsOptions;
  emits?: ReadonlyArray<keyof Emits & string>;
  emitOptions?: EmitOptions;
  setup?: TypedSetup<Props, Emits, Slots>;
  /** 渲染函数（手写或编译产物）— 与 template 二选一 */
  render?: RenderFn;
  /** 模板字符串 — 与 render 二选一 */
  template?: string;
  styles?: string[];
  shadow?: "open" | "closed" | false;
  formControl?: ComponentDefinition["formControl"];
  components?: ComponentDefinition["components"];
  directives?: ComponentDefinition["directives"];
  /** 默认 true：定义即注册到 customElements；传 false 仅返回构造器 */
  register?: boolean;
}

export function defineComponent<
  const Options extends Record<string, unknown>,
  Emits extends EmitMap = EmitMap,
  Slots extends SlotsMap = SlotsMap,
>(
  options: Omit<
    DefineComponentOptions<InferPropsOptions<Options>, Emits, Slots>,
    "props"
  > & {
    props: Options;
  },
): ElfElementConstructor<InferPropsOptions<Options>, Emits, Slots>;
export function defineComponent<
  Props extends object = Record<string, unknown>,
  Emits extends EmitMap = EmitMap,
  Slots extends SlotsMap = SlotsMap,
>(
  options: DefineComponentOptions<Props, Emits, Slots>,
): ElfElementConstructor<Props, Emits, Slots>;
export function defineComponent(
  options: DefineComponentOptions<Record<string, unknown>, EmitMap, SlotsMap>,
): ElfElementConstructor {
  const b = new ElementBuilder();
  const tag = options.name ?? options.tag;
  if (tag) b.name(tag);
  if (options.props) b.props(options.props);
  if (options.emits) b.emits(...options.emits);
  if (options.emitOptions) b.emitOptions(options.emitOptions);
  if (options.setup) b.setup(options.setup as SetupFn);
  if (options.template) b.template(options.template);
  if (options.render) b.render(options.render);
  if (options.styles) for (const s of options.styles) b.style(s);
  if (options.shadow !== undefined) b.shadow(options.shadow);
  if (options.formControl !== undefined) {
    if (typeof options.formControl === "boolean")
      b.formControl(options.formControl);
    else
      (
        b as unknown as { definition: ComponentDefinition }
      ).definition.formControl = options.formControl;
  }
  if (options.components) {
    for (const k of Object.keys(options.components)) {
      const v = options.components[k];
      if (v) b.use(v as UsableComponent, k);
    }
  }
  if (options.directives) {
    for (const k of Object.keys(options.directives)) {
      b.directive(k, options.directives[k] as DirectiveDefinition);
    }
  }
  return options.register === false ? b.build() : b.register();
}
