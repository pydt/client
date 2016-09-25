import { NgModule, ApplicationRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpModule } from '@angular/http';
import { FormsModule }   from '@angular/forms';
import { routing } from './app.routing';

import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { AuthComponent } from './auth/auth.component'

import { ApiService } from './shared/api.service.ts';
import { ConfigService } from './shared/config.service.ts';

@NgModule({
  imports: [
    BrowserModule,
    HttpModule,
    FormsModule,
    routing
  ],
  declarations: [
    AppComponent,
    HomeComponent,
    AuthComponent
  ],
  providers: [
    ApiService,
    ConfigService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor() {}
}
