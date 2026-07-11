# @elfui/chain

Chain-style component extension package for ElfUI.

```bash
pnpm add @elfui/chain
```

```ts
import { ElfUI } from "@elfui/chain";

const Counter = ElfUI.createComponent()
  .name("elf-counter")
  .template(`<button>count</button>`)
  .build();
```
