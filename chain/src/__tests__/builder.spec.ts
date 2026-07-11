// C5 链式 builder 验收测试

import { afterEach, describe, expect, it } from "vitest";

import { useRef } from "@elfui/reactivity";

import { createComponent } from "../builder";

let tagCounter = 0;
const nextTag = (): string => `elf-builder-${++tagCounter}`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createComponent 基础链式调用", () => {
  it("name + setup + render", () => {
    const tag = nextTag();
    createComponent()
      .name(tag)
      .setup(() => ({ msg: "hello" }))
      .render((ctx) => {
        const p = document.createElement("p");
        p.textContent = String(ctx.state.msg);
        return p;
      })
      .register();
    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(el.shadowRoot?.querySelector("p")?.textContent).toBe("hello");
  });

  it("props 合并多次调用", () => {
    const tag = nextTag();
    const builder = createComponent()
      .name(tag)
      .props({ a: { type: Number, default: 1 } })
      .props({ b: { type: String, default: "x" } });
    const def = builder.toDefinition();
    expect(def.props).toEqual({
      a: { type: Number, default: 1 },
      b: { type: String, default: "x" }
    });
  });

  it("style 多次调用累加", () => {
    const tag = nextTag();
    const builder = createComponent()
      .name(tag)
      .style("p { color: red; }")
      .style("p { font-size: 14px; }");
    const def = builder.toDefinition();
    expect(def.styles).toEqual(["p { color: red; }", "p { font-size: 14px; }"]);
  });

  it("emits 累加", () => {
    const builder = createComponent().emits("click").emits("change", "submit");
    expect(builder.toDefinition().emits).toEqual(["click", "change", "submit"]);
  });

  it("shadow 模式控制", () => {
    const tag = nextTag();
    createComponent()
      .name(tag)
      .shadow(false)
      .render(() => {
        const p = document.createElement("p");
        p.textContent = "no-shadow";
        return p;
      })
      .register();
    const el = document.createElement(tag);
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector("p")?.textContent).toBe("no-shadow");
  });

  it("formControl 设置", () => {
    const builder = createComponent().formControl();
    expect(builder.toDefinition().formControl).toBe(true);
  });

  it("hasName 判定", () => {
    const empty = createComponent();
    expect(empty.hasName()).toBe(false);
    empty.name("foo-bar");
    expect(empty.hasName()).toBe(true);
  });
});

describe("build / register", () => {
  it("build 返回构造器", () => {
    const tag = nextTag();
    const Ctor = createComponent()
      .name(tag)
      .render(() => document.createElement("div"))
      .build();
    expect(typeof Ctor).toBe("function");
    expect(customElements.get(tag)).toBeUndefined();
  });

  it("未指定 tag 时 build 自动生成", () => {
    const Ctor = createComponent()
      .render(() => document.createElement("div"))
      .build();
    expect(typeof Ctor).toBe("function");
  });

  it("register(tag) 覆盖原 tag", () => {
    const tag = nextTag();
    const Ctor = createComponent()
      .name("will-be-overridden")
      .render(() => document.createElement("div"))
      .register(tag);
    expect(typeof Ctor).toBe("function");
    expect(customElements.get(tag)).toBe(Ctor);
  });
});

describe(".template() 未注入编译器", () => {
  it("调用打错误提示", () => {
    expect(() => {
      createComponent().name(nextTag()).template("<div>x</div>");
    }).toThrow(/需要先注入编译器/);
  });
});

describe("toDefinition", () => {
  it("返回 definition 副本（不共享 props 引用）", () => {
    const builder = createComponent()
      .name("a-b")
      .props({ x: { type: Number, default: 0 } });
    const d1 = builder.toDefinition();
    const d2 = builder.toDefinition();
    expect(d1).not.toBe(d2);
    expect(d1.props).not.toBe(d2.props);
  });
});

describe("端到端最小例子", () => {
  it("setup + props + render 正常工作", () => {
    const tag = nextTag();
    createComponent()
      .name(tag)
      .props({ initial: { type: Number, default: 0 } })
      .setup(({ initial }) => {
        const count = useRef(initial as number);
        return { count };
      })
      .render((ctx) => {
        const span = document.createElement("span");
        span.textContent = String(ctx.state.count);
        return span;
      })
      .register();
    const el = document.createElement(tag);
    el.setAttribute("initial", "5");
    document.body.appendChild(el);
    expect(el.shadowRoot?.querySelector("span")?.textContent).toBe("5");
  });
});
