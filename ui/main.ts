import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app.module';

// depending on the env mode, enable prod mode or add debugging modules
if (PYDT_CONFIG.PROD) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule);
