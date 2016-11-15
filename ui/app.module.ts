import { NgModule, ApplicationRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpModule } from '@angular/http';
import { FormsModule }   from '@angular/forms';
import { routing } from './app.routing';
import { BusyModule } from 'angular2-busy';

import { AppComponent } from './app.component';
import { AuthComponent } from './auth/auth.component'
import { HomeComponent } from './home/home.component';
import { PlayTurnComponent } from './playTurn/playTurn.component';

import { ApiService, ProfileCacheService, API_URL_PROVIDER_TOKEN, API_CREDENTIALS_PROVIDER_TOKEN } from 'civx-angular2-shared';
import { WebApiUrlProvider, WebApiCredentialsProvider } from './shared/electronApiServiceImplementations';

@NgModule({
  imports: [
    BrowserModule,
    HttpModule,
    FormsModule,
    BusyModule,
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
    { provide: API_URL_PROVIDER_TOKEN, useClass: WebApiUrlProvider },
    { provide: API_CREDENTIALS_PROVIDER_TOKEN, useClass: WebApiCredentialsProvider },
    ProfileCacheService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {}
}
