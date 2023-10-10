as_files := $(wildcard assembly/*.ts)
scripts := $(wildcard scripts/*.ts)

.PHONY: bundle
bundle: prebuilt-wasm
	npx tsc
	npx vite build

.PHONY: prebuilt-wasm
prebuilt-wasm: build/release.wasm_sections.ts

build/release.wasm_sections.ts: build/release.wasm $(scripts)
	npx ts-node --esm scripts/bundlewasm.ts

build/release.wasm: $(as_files)
	npx asc assembly/index.ts --target release --runtime stub -O0 --noExportMemory
