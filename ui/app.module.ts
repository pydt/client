import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpModule, XHRBackend, RequestOptions, Http } from '@angular/http';
import { FormsModule } from '@angular/forms';
import { routing } from './app.routing';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ProgressbarModule } from 'ngx-bootstrap/progressbar';
import { TooltipModule } from 'ngx-bootstrap/tooltip';

import { AppComponent } from './app.component';
import { AuthComponent } from './auth/auth.component';
import { HomeComponent } from './home/home.component';
import { GameComponent } from './home/game.component';
import { GamePlayerComponent } from './home/player.component';
import { PlayTurnComponent } from './playTurn/playTurn.component';
import { PlayTurnState } from './playTurn/playTurnState.service';

import { BusyService, BusyComponent, ProfileCacheService } from 'pydt-shared';
import { DefaultApi } from './swagger/api/index';
import { PydtHttp } from './shared/pydtHttp';
import { AuthService } from './shared/authService';

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpModule,
    FormsModule,
    ModalModule.forRoot(),
    ProgressbarModule.forRoot(),
    TooltipModule.forRoot(),
    routing
  ],
  declarations: [
    AppComponent,
    AuthComponent,
    HomeComponent,
    GameComponent,
    GamePlayerComponent,
    PlayTurnComponent,
    BusyComponent
  ],
  providers: [
    AuthService,
    ProfileCacheService,
    PlayTurnState,
    BusyService,
    {
      provide: Http,
      useFactory: (backend: XHRBackend, options: RequestOptions, busy: BusyService, auth: AuthService) => {
        return new PydtHttp(backend, options, busy, auth);
      },
      deps: [XHRBackend, RequestOptions, BusyService]
    },
    DefaultApi
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
