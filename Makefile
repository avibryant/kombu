as_files := $(wildcard assembly/*.ts)
scripts := $(wildcard scripts/*.ts)
bundles := dist/kombu.js
ts_sources := $(shell find src -name '*.ts')
prebuilt_wasm_output := build/release.wasm_sections.ts

.PHONY: all
all: $(bundles) dist/kombu.d.ts

.PHONY: bench
bench: $(prebuilt_wasm_output)
	npx tsx scripts/bench.ts

.PHONY: prebuilt-wasm
prebuilt-wasm: $(prebuilt_wasm_output)

$(bundles): $(prebuilt_wasm_output) $(ts_sources)
	npx tsc
	npx vite build

dist/kombu.d.ts:
	npx dts-bundle-generator ./src/core/api.ts -o dist/kombu.d.ts

build/release.wasm_sections.ts: $(scripts) build/release.wasm
	npx tsx scripts/as2ts.ts
	npx tsx scripts/bundlewasm.ts

build/release.wasm: $(as_files)
	# Note: -O0 because other opt levels eliminate the call_indirect instructions.
	npx asc assembly/asopt.ts --target release --runtime stub -O0
