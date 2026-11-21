import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withXhr } from "@angular/common/http";
import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideZoneChangeDetection } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ModalModule } from "ngx-bootstrap/modal";
import { ProgressbarModule } from "ngx-bootstrap/progressbar";
import { TabsModule } from "ngx-bootstrap/tabs";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { MARKED_OPTIONS, MarkdownModule } from "ngx-markdown";
import { ApiModule, BusyService, Configuration, DateInterceptor, MetadataCacheService } from "pydt-shared";
import { routing } from "./app.routing";
import { environment } from "./environments/environment";
import { PlayTurnState } from "./playTurn/playTurnState.service";
import { RollbarErrorHandler, rollbarFactory, RollbarService } from "./rollbarErrorHandler";
import { AuthService } from "./shared/authService";
import { PydtSettingsFactory } from "./shared/pydtSettings";
import { SafeMetadataLoader } from "./shared/safeMetadataLoader";
import { TurnCacheService } from "./shared/turnCacheService";

export const configFactory = (): Configuration =>
  new Configuration({
    apiKeys: {},
    basePath: environment.apiUrl,
  });

export const appConfig: ApplicationConfig = {
  providers: [
    // The app still relies on zone.js; without this, bootstrapApplication runs zoneless.
    provideZoneChangeDetection(),
    importProvidersFrom(
      BrowserAnimationsModule,
      ApiModule.forRoot(configFactory),
      ModalModule,
      ProgressbarModule,
      TooltipModule,
      TabsModule,
      routing,
      MarkdownModule.forRoot({
        markedOptions: {
          provide: MARKED_OPTIONS,
          useValue: {
            breaks: true,
          },
        },
      }),
    ),
    TurnCacheService,
    PydtSettingsFactory,
    SafeMetadataLoader,
    { provide: ErrorHandler, useClass: RollbarErrorHandler },
    { provide: RollbarService, useFactory: rollbarFactory },
    AuthService,
    { provide: HTTP_INTERCEPTORS, useExisting: BusyService, multi: true },
    { provide: HTTP_INTERCEPTORS, useExisting: DateInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useExisting: MetadataCacheService, multi: true },
    PlayTurnState,
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
  ],
};
