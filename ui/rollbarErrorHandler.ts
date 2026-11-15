import Rollbar from "rollbar";
import { Injectable, InjectionToken, ErrorHandler, inject } from "@angular/core";
import { RPC_INVOKE, RPC_TO_RENDERER } from "./rpcChannels";
import { environment } from "./environments/environment";
import { ROLLBAR_CONFIG, RollbarSettings, createOncePerRunFilter, rewriteFramePaths } from "./rollbarConfig";

export const RollbarService = new InjectionToken<Rollbar>("rollbar");

@Injectable()
export class RollbarErrorHandler implements ErrorHandler {
  private rollbar = inject<Rollbar>(RollbarService);

  constructor() {
    if (environment.production) {
      // The main process owns the remote switch (see app/src/rollbar.js): take its
      // current settings now, then follow its hourly updates.
      const apply = (settings: RollbarSettings) => {
        this.rollbar.configure({ enabled: !!settings?.enabled, ignoredMessages: settings?.ignoredMessages });
      };

      window.pydtApi.ipc
        .invoke<RollbarSettings>(RPC_INVOKE.GET_ROLLBAR_SETTINGS)
        .then(apply)
        .catch(() => undefined);
      window.pydtApi.ipc.receive<RollbarSettings>(RPC_TO_RENDERER.ROLLBAR_SETTINGS, apply);

      // Run pydtRollbarTest() in the devtools console to check reporting end to end.
      (globalThis as unknown as Record<string, unknown>).pydtRollbarTest = (): void => {
        setTimeout(() => {
          throw new Error(`Rollbar test error (client ${environment.version})`);
        });
      };
    }
  }

  handleError(err: Error & { originalError: Error }): void {
    this.rollbar.error(err.originalError || err);
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

// Starts disabled: nothing is sent until the main process says the remote switch
// is on for this version.
export const rollbarFactory = (): Rollbar =>
  new Rollbar({
    ...ROLLBAR_CONFIG,
    enabled: false,
    checkIgnore: createOncePerRunFilter(),
    transform: rewriteFramePaths,
    payload: {
      client: {
        javascript: {
          // eslint-disable-next-line camelcase
          source_map_enabled: true,
          // eslint-disable-next-line camelcase
          code_version: `${environment.version}-${environment.platform}`,
          // eslint-disable-next-line camelcase
          guess_uncaught_frames: true,
        },
      },
    },
  });
