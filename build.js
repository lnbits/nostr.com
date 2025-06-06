import esbuild from "esbuild"
import postcss from "@deanc/esbuild-plugin-postcss"
import tailwind from "@tailwindcss/postcss"
import { solidPlugin as solid } from "esbuild-plugin-solid"

esbuild
  .build({
    entryPoints: ["./main.tsx"],
    bundle: true,
    outdir: "./dist",
    plugins: [
      solid(),
      postcss({
        plugins: [tailwind]
      })
    ],
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development")
    },
    conditions: [process.env.NODE_ENV || "development"],
    minify: process.env.NODE_ENV === "production",
    sourcemap: "linked",
    format: "esm"
  })
  .catch(e => console.error(e.message))
