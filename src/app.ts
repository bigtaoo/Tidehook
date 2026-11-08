// Boots the game on a platform: language, renderer, and the grey-box scene laid out for the
// screen's orientation. M1 adds the simulation and its fixed-step loop (view/fixedStep.ts).

import { Application, Container } from 'pixi.js';
import { urlSwitches } from './game/switches';
import { detectLocale, loadLocale, setLocale } from './i18n';
import type { Platform } from './platform/types';
import { drawGreybox } from './view/greybox';
import { SEA } from './view/kit/palette';
import { fitDesign } from './view/viewport';
import { waitForSize } from './view/waitForSize';

/** The player's language pick, in the platform's storage. */
export const LANG_KEY = 'tidehook.lang';

export async function boot(platform: Platform): Promise<Application> {
  const params = urlSwitches(location.search);
  const want = detectLocale([params.get('lang'), platform.storage.getItem(LANG_KEY), ...platform.languages()]);
  const table = loadLocale(want);
  await waitForSize(window);

  const app = new Application();
  const resolution = Math.min(window.devicePixelRatio || 1, 2);
  await app.init({
    background: SEA.deep,
    resizeTo: platform.mount ?? window,
    resolution,
    autoDensity: true,
    antialias: resolution < 2,
    preference: 'webgl',
  });
  (platform.mount ?? document.body).appendChild(app.canvas);
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  if (await table) setLocale(want);

  let scene: Container | null = null;
  const layout = () => {
    const fit = fitDesign(app.screen.width, app.screen.height);
    scene?.destroy({ children: true });
    scene = drawGreybox(fit);
    scene.scale.set(fit.scale);
    scene.position.set(fit.x, fit.y);
    app.stage.addChild(scene);
  };
  layout();
  app.renderer.on('resize', layout);

  if (import.meta.env.DEV) Object.assign(window, { __th: { app, build: __TH_BUILD__ } });
  platform.loaded();
  return app;
}
