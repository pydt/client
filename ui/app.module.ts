import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CustomFormsModule } from 'ng2-validation';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ProgressbarModule } from 'ngx-bootstrap/progressbar';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { ApiModule, Configuration, PydtSharedModule, ProfileCacheService } from 'pydt-shared';
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
import { PydtHttpInterceptor } from './shared/pydtHttpInterceptor';
import { MarkdownModule, MarkedOptions, MarkedRenderer } from 'ngx-markdown';

export function configFactory() {
  return new Configuration({
    apiKeys: {},
    basePath: PYDT_CONFIG.API_URL
  });
}

export function markedOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();
  const linkRenderer = renderer.link;

  renderer.link = (href, title, text) => {
    const html = linkRenderer.call(renderer, href, title, text);
    return html.replace('href=', 'href="javascript:void(0);" (click)="openMarkdownLink()" hrefx=');
  };

  return {
    renderer,
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
  };
}

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CustomFormsModule,
    ApiModule.forRoot(configFactory),
    FormsModule,
    ModalModule.forRoot(),
    ProgressbarModule.forRoot(),
    TooltipModule.forRoot(),
    PydtSharedModule,
    routing,
    MarkdownModule.forRoot({
      markedOptions: {
        provide: MarkedOptions,
        useFactory: markedOptionsFactory,
      },
    }),

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
    { provide: ErrorHandler, useClass: RollbarErrorHandler },
    { provide: RollbarService, useFactory: rollbarFactory },
    AuthService,
    { provide: HTTP_INTERCEPTORS, useClass: PydtHttpInterceptor, multi: true },
    PlayTurnState
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
