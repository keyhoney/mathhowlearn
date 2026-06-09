import type { AstroIntegration } from 'astro';

const tinaDirective = (): AstroIntegration => ({
  name: 'client:tina',
  hooks: {
    'astro:config:setup': ({ addClientDirective }) => {
      addClientDirective({
        name: 'tina',
        entrypoint: './astro-tina-directive/tina.ts',
      });
    },
  },
});

export default tinaDirective;
