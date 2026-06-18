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
  site: 'https://matteojacobs.github.io',
  base: '/integration-04',
});
import { defineConfig } from 'astro/config';