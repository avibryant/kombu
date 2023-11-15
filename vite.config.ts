import { defineConfig, PluginOption, UserConfig } from "vite"

function useShims(): PluginOption {
  const shims = {
    // Return stubs, rather than empty modules, to avoid errors from
    // `vite build`, e.g. '"writeFileSync" is not exported by "node:fs"'.
    "node:fs": "export function writeFileSync() {}",
    "node:process": "export const env = {}",
  }

  return {
    name: "use-shim",
    enforce: "pre",
    resolveId: (id) => (id in shims ? id : undefined),
    load: (id) => (id in shims ? shims[id] : undefined),
  }
}

export default defineConfig(({ mode }) => {
  const devConfig: UserConfig = {
    build: {
      rollupOptions: {
        external: ["node:fs", "node:process"],
      },
    },
  }

  const prodConfig: UserConfig = {
    plugins: [useShims()],
  }
  return mode === "production" ? prodConfig : devConfig
})
