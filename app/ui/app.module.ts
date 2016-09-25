import { NgModule, ApplicationRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpModule } from '@angular/http';
import { FormsModule }   from '@angular/forms';
import { routing } from './app.routing';

import { AppComponent } from './app.component';
import { AuthComponent } from './auth/auth.component'
import { HomeComponent } from './home/home.component';
import { PlayTurnComponent } from './playTurn/playTurn.component';

import { ApiService } from './shared/api.service.ts';
import { ConfigService } from './shared/config.service.ts';
import { ProfileCacheService } from './shared/profileCache.service';

@NgModule({
  imports: [
    BrowserModule,
    HttpModule,
    FormsModule,
    routing
  ],
  declarations: [
    AppComponent,
    AuthComponent,
    HomeComponent,
    PlayTurnComponent
  ],
  providers: [
    ApiService,
    ConfigService,
    ProfileCacheService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {}
}
