import * as Rollbar from "rollbar";
import { Injectable, Inject, InjectionToken, ErrorHandler } from "@angular/core";
import { RPC_TO_MAIN } from "./rpcChannels";
import { environment } from "./environments/environment";
import { ROLLBAR_CONFIG } from "./rollbarConfig";

export const RollbarService = new InjectionToken<Rollbar>("rollbar");

@Injectable()
export class RollbarErrorHandler implements ErrorHandler {
  constructor(@Inject(RollbarService) private rollbar: Rollbar) {
    if (environment.production) {
      window.pydtApi.ipc.send(RPC_TO_MAIN.INIT_ROLLBAR, null);
    }
  }

  handleError(err: Error & { originalError: Error }): void {
    this.rollbar.error(err.originalError || err);
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

export const rollbarFactory = (): Rollbar =>
  new Rollbar({
    ...ROLLBAR_CONFIG,
    enabled: !!environment.production,
  });
