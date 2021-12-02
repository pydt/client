import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ProgressbarModule } from 'ngx-bootstrap/progressbar';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { MarkdownModule, MarkedOptions } from 'ngx-markdown';
import { ApiModule, BusyService, Configuration, MetadataCacheService, ProfileCacheService, PydtSharedModule } from 'pydt-shared';
import { AppComponent } from './app.component';
import { routing } from './app.routing';
import { AuthComponent } from './auth/auth.component';
import { GameComponent } from './home/game.component';
import { GamePlayersComponent } from './home/gamePlayers.component';
import { HomeComponent } from './home/home.component';
import { PlayTurnComponent } from './playTurn/playTurn.component';
import { PlayTurnState } from './playTurn/playTurnState.service';
import { RollbarErrorHandler, rollbarFactory, RollbarService } from './rollbarErrorHandler';
import { AuthService } from './shared/authService';
import { TurnCacheService } from './shared/turnCacheService';
import { PydtSettingsFactory } from './shared/pydtSettings';
import { environment } from './environments/environment';

export function configFactory() {
  return new Configuration({
    apiKeys: {},
    basePath: environment.apiUrl
  });
}

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ApiModule.forRoot(configFactory),
    FormsModule,
    ModalModule.forRoot(),
    ProgressbarModule.forRoot(),
    TooltipModule.forRoot(),
    TabsModule.forRoot(),
    PydtSharedModule,
    routing,
    MarkdownModule.forRoot({
      markedOptions: {
        provide: MarkedOptions,
        useValue: {
          breaks: true
        }
      }
    })
  ],
  declarations: [
    AppComponent,
    AuthComponent,
    HomeComponent,
    GameComponent,
    PlayTurnComponent,
    GamePlayersComponent
  ],
  providers: [
    ProfileCacheService,
    TurnCacheService,
    PydtSettingsFactory,
    { provide: ErrorHandler, useClass: RollbarErrorHandler },
    { provide: RollbarService, useFactory: rollbarFactory },
    AuthService,
    { provide: HTTP_INTERCEPTORS, useExisting: BusyService, multi: true },
    { provide: HTTP_INTERCEPTORS, useExisting: MetadataCacheService, multi: true },
    PlayTurnState
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
