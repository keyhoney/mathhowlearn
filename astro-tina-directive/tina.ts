import type { ClientDirective } from 'astro';

const tinaClientDirective: ClientDirective = async (load) => {
  try {
    const isInIframe = window.self !== window.top;
    if (!isInIframe) return;

    const hydrate = await load();
    await hydrate();
  } catch (error) {
    console.error('Failed to hydrate Tina visual editing island.', error);
  }
};

export default tinaClientDirective;
