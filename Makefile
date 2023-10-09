as_files := $(wildcard assembly/*.ts)

.PHONY: bundle
bundle: build/release.wasm
	npx tsc
	npx vite build

.PHONY: prebuilt-wasm
prebuilt-wasm: build/release.wasm

build/release.wasm: $(as_files)
	npx asc assembly/index.ts --target release --runtime stub -O0 --noExportMemory
	npx ts-node --esm scripts/bundlewasm.ts
