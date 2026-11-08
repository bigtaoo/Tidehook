import { boot } from './app';
import { t } from './i18n';
import { WebPlatform } from './platform/web';

boot(new WebPlatform()).catch((err) => {
  console.error(err);
  document.body.style.color = '#fff1d6';
  document.body.textContent = t('boot.failed', { error: String(err) });
});
