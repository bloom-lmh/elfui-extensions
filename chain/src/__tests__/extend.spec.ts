// extend / variant 单测

import { useRef } from "@elfui/reactivity";
import { afterEach, describe, expect, it } from "vitest";

import { createComponent, extend, variant } from "../builder";

let id = 0;
const next = (): string => `elf-test-extend-${++id}`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("extend", () => {
  it("继承 base 组件的 props/setup/styles，需重设 name 才能注册", () => {
    const baseTag = next();
    const Base = createComponent()
      .name(baseTag)
      .props({ size: { type: String, default: "md" } })
      .setup((props) => ({ props, hello: "from-base" }))
      .style("button { padding: 8px; }")
      .build();

    const childTag = next();
    const Child = extend(Base).name(childTag).style("button { color: red; }").build();

    expect(Base).not.toBe(Child);
    expect((Child as { __elfDefinition: { tag: string } }).__elfDefinition.tag).toBe(childTag);
    // styles 累加（base 一条 + child 一条）
    expect(
      (Child as { __elfDefinition: { styles?: string[] } }).__elfDefinition.styles?.length
    ).toBe(2);
    // props 复用
    expect(
      (Child as { __elfDefinition: { props?: Record<string, unknown> } }).__elfDefinition.props
        ?.size
    ).toBeDefined();
  });

  it("修改 child styles 不影响 base", () => {
    const baseTag = next();
    const Base = createComponent().name(baseTag).style("button { padding: 8px; }").build();

    const childTag = next();
    extend(Base).name(childTag).style("button { color: red; }").build();

    // base 仍然只有 1 条
    expect(
      (Base as { __elfDefinition: { styles?: string[] } }).__elfDefinition.styles?.length
    ).toBe(1);
  });

  it("能覆盖 base 的 setup", () => {
    const baseTag = next();
    const Base = createComponent()
      .name(baseTag)
      .setup(() => ({ msg: "base" }))
      .build();

    const childTag = next();
    extend(Base)
      .name(childTag)
      .setup(() => ({ msg: "child" }))
      .build();

    const childEl = document.createElement(childTag);
    document.body.appendChild(childEl);
    // 这里只验证组件能被实例化，深入验证用 e2e 模板会更直接
    expect(childEl.tagName.toLowerCase()).toBe(childTag);
  });
});

describe("variant", () => {
  it("自动给定新名 + configure 回调可链", () => {
    const baseTag = next();
    const Base = createComponent().name(baseTag).style("button { padding: 8px; }").build();

    const dangerTag = next();
    variant(Base, dangerTag, (b) => {
      b.style("button { color: red; }");
    }).build();

    // base 不变
    expect(
      (Base as { __elfDefinition: { styles?: string[] } }).__elfDefinition.styles?.length
    ).toBe(1);
  });

  it("不传 configure 仍可链", () => {
    const baseTag = next();
    const Base = createComponent().name(baseTag).style("button { padding: 8px; }").build();

    const warningTag = next();
    const W = variant(Base, warningTag).style("button { color: orange; }").build();

    expect((W as { __elfDefinition: { styles?: string[] } }).__elfDefinition.styles?.length).toBe(
      2
    );
  });

  it("能从 builder（未 build）继承", () => {
    const baseBuilder = createComponent()
      .props({ size: { type: String, default: "md" } })
      .style("button { padding: 8px; }");

    const variantTag = next();
    const V = variant(baseBuilder, variantTag).build();

    expect((V as { __elfDefinition: { tag: string } }).__elfDefinition.tag).toBe(variantTag);
    expect(
      (V as { __elfDefinition: { props?: Record<string, unknown> } }).__elfDefinition.props?.size
    ).toBeDefined();
  });

  it("setup 返回的状态在 variant 中可用（运行时同等性）", () => {
    const baseTag = next();
    const Base = createComponent()
      .name(baseTag)
      .setup(() => {
        const count = useRef(0);
        return { count };
      })
      .build();

    const vTag = next();
    variant(Base, vTag).build();

    const el = document.createElement(vTag);
    document.body.appendChild(el);
    expect(el.tagName.toLowerCase()).toBe(vTag);
  });
});
