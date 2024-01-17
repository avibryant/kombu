import { resolve } from "path"
import { defineConfig, PluginOption, UserConfig } from "vite"

function useShims(): PluginOption {
  const shims = {
    // Return stubs, rather than empty modules, to avoid errors from
    // `vite build`, e.g. '"writeFileSync" is not exported by "node:fs"'.
    "node:fs": "export function writeFileSync() {}",
  }

  return {
    name: "use-shim",
    enforce: "pre",
    resolveId: (id) => (id in shims ? id : undefined),
    load: (id) => (id in shims ? shims[id] : undefined),
  }
}

export default defineConfig(({ mode }) => {
  // The dev config is used for testing the full app.
  const devConfig: UserConfig = {
    build: {
      rollupOptions: {
        external: ["node:fs", "node:process"],
      },
    },
    define: {
      "process.env.KOMBU_DEBUG": JSON.stringify(process.env.KOMBU_DEBUG),
    },
  }

  // The prod config just builds the library.
  const prodConfig: UserConfig = {
    build: {
      lib: {
        entry: resolve(__dirname, "src/core/api.ts"),
        name: "kombu",
      },
    },
    plugins: [useShims()],
    define: {
      "process.env.KOMBU_DEBUG": JSON.stringify(""),
    },
  }
  return mode === "production" ? prodConfig : devConfig
})
