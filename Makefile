as_files := $(wildcard assembly/*.ts)
scripts := $(wildcard scripts/*.ts)

.PHONY: bundle
bundle: prebuilt-wasm
	npx tsc
	npx vite build

.PHONY: prebuilt-wasm
prebuilt-wasm: build/release.wasm_sections.ts
	npx tsx scripts/as2ts.ts

.PHONY: bench
bench: prebuilt-wasm
	npx tsx scripts/bench.ts

build/release.wasm_sections.ts: build/release.wasm $(scripts)
	npx tsx scripts/bundlewasm.ts

build/release.wasm: $(as_files)
	# Note: -O0 because other opt levels eliminate the call_indirect instructions.
	npx asc assembly/asopt.ts --target release --runtime stub -O0
