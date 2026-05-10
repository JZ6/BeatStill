import { defineConfig } from "vite";

export default defineConfig({
  base: "/BeatStill/",
  server: { port: 3000 },
  build: { target: "ES2020" },
});
