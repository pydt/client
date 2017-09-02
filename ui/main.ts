import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app.module';

// Make right-clicks show context menu (copy/paste/etc) on input fields
const inputMenu = require('electron-input-menu');
const context = require('electron-contextmenu-middleware');

context.use(inputMenu);
context.activate();

// depending on the env mode, enable prod mode or add debugging modules
if (PYDT_CONFIG.PROD) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule);
