import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: 'https://lmsbernad-blip.github.io',
  base: '/lorenzo-bernad-portfolio/',
  integrations: [tailwind()]
});