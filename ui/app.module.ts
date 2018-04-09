import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpModule, XHRBackend, RequestOptions, Http } from '@angular/http';
import { FormsModule } from '@angular/forms';
import { routing } from './app.routing';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ProgressbarModule } from 'ngx-bootstrap/progressbar';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { CustomFormsModule } from 'ng2-validation';

import { AppComponent } from './app.component';
import { AuthComponent } from './auth/auth.component';
import { HomeComponent } from './home/home.component';
import { GameComponent } from './home/game.component';
import { GamePlayerComponent } from './home/player.component';
import { PlayTurnComponent } from './playTurn/playTurn.component';
import { PlayTurnState } from './playTurn/playTurnState.service';

import { BusyService, BusyComponent, ProfileCacheService } from 'pydt-shared';
import { ApiModule, DefaultService, Configuration } from './swagger/api';
import { PydtHttp } from './shared/pydtHttp';
import { AuthService } from './shared/authService';
import { RollbarErrorHandler, RollbarService, rollbarFactory } from './rollbarErrorHandler';

@NgModule({
  imports: [
    ApiModule,
    BrowserModule,
    BrowserAnimationsModule,
    CustomFormsModule,
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
    { provide: ErrorHandler, useClass: RollbarErrorHandler },
    { provide: RollbarService, useFactory: rollbarFactory },
    AuthService,
    {
      provide: Configuration,
      useValue: new Configuration({
        basePath: PYDT_CONFIG.API_URL
      })
    },
    {
      provide: ProfileCacheService,
      useFactory: (api: DefaultService) => {
        return new ProfileCacheService(api);
      },
      deps: [DefaultService]
    },
    PlayTurnState,
    BusyService,
    {
      provide: Http,
      useFactory: (backend: XHRBackend, options: RequestOptions, busy: BusyService) => {
        return new PydtHttp(backend, options, busy);
      },
      deps: [XHRBackend, RequestOptions, BusyService]
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
