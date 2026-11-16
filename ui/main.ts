import { provideZoneChangeDetection } from "@angular/core";
import { platformBrowser } from "@angular/platform-browser";
import { AppModule } from "./app.module";

void platformBrowser().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()] });
