// C5.7 builder.use 验收测试

import { afterEach, describe, expect, it } from "vitest";

import { resolveComponentTag } from "@elfui/runtime";

import { createComponent } from "../builder";

let tagCounter = 0;
const nextTag = (): string => `elf-use-${++tagCounter}`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("C5.7 builder.use", () => {
  it("use(string) 用标签名注册", () => {
    const builder = createComponent().name(nextTag()).use("p");
    const def = builder.toDefinition();
    expect(def.components).toBeDefined();
    expect(def.components?.["p"]).toBe("p");
  });

  it("use(ctor)：自动从 __elfDefinition.tag 取名", () => {
    const childTag = nextTag();
    const Child = createComponent()
      .name(childTag)
      .render(() => document.createElement("span"))
      .build();
    const builder = createComponent().name(nextTag()).use(Child);
    const def = builder.toDefinition();
    expect(def.components?.[childTag]).toBe(Child);
  });

  it("use(ctor, alias)：自定义别名", () => {
    const Child = createComponent()
      .name(nextTag())
      .render(() => document.createElement("span"))
      .build();
    const builder = createComponent().name(nextTag()).use(Child, "MyChild");
    expect(builder.toDefinition().components?.["MyChild"]).toBe(Child);
  });

  it("use([...])：数组形式", () => {
    const A = createComponent()
      .name(nextTag())
      .render(() => document.createElement("a"))
      .build();
    const B = createComponent()
      .name(nextTag())
      .render(() => document.createElement("b"))
      .build();
    const builder = createComponent().name(nextTag()).use([A, B]);
    const def = builder.toDefinition();
    expect(Object.keys(def.components ?? {}).length).toBe(2);
  });

  it("use({ Alias: Ctor })：对象形式", () => {
    const A = createComponent()
      .name(nextTag())
      .render(() => document.createElement("a"))
      .build();
    const B = createComponent()
      .name(nextTag())
      .render(() => document.createElement("b"))
      .build();
    const builder = createComponent().name(nextTag()).use({ AAA: A, BBB: B });
    const def = builder.toDefinition();
    expect(def.components?.["AAA"]).toBe(A);
    expect(def.components?.["BBB"]).toBe(B);
  });

  it("resolveComponentTag 兼容 PascalCase、kebab-case 和真实 tag", () => {
    const Child = createComponent()
      .name(nextTag())
      .render(() => document.createElement("span"))
      .build();
    const components = { TypedChild: Child };
    expect(resolveComponentTag("TypedChild", components)).toBe(Child.__elfDefinition.tag);
    expect(resolveComponentTag("typed-child", components)).toBe(Child.__elfDefinition.tag);
    expect(resolveComponentTag(Child.__elfDefinition.tag, components)).toBe(
      Child.__elfDefinition.tag
    );
  });

  it("多次 use 累加", () => {
    const A = createComponent()
      .name(nextTag())
      .render(() => document.createElement("div"))
      .build();
    const B = createComponent()
      .name(nextTag())
      .render(() => document.createElement("div"))
      .build();
    const builder = createComponent().name(nextTag()).use(A).use(B);
    expect(Object.keys(builder.toDefinition().components ?? {}).length).toBe(2);
  });
});

describe("C5.7 builder.directive", () => {
  it("注册局部指令", () => {
    const def = { mounted: () => {} };
    const builder = createComponent().name(nextTag()).directive("foo", def);
    expect(builder.toDefinition().directives?.["foo"]).toBe(def);
  });

  it("多次 directive 累加", () => {
    const a = { mounted: () => {} };
    const b = { mounted: () => {} };
    const builder = createComponent().name(nextTag()).directive("a", a).directive("b", b);
    const ds = builder.toDefinition().directives ?? {};
    expect(Object.keys(ds).length).toBe(2);
  });
});
