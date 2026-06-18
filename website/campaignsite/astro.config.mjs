// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  image: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lragbxqhqdxmejklvypd.supabase.co",
        pathname: "/storage/v1/object/public/submissions/**",
      },
    ],
  },
  site: 'https://matteojacobs.github.io/integration-04/',
  base: '/',
});
import { defineConfig } from 'astro/config';