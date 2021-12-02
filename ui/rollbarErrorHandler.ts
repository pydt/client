import * as Rollbar from 'rollbar';
import { Injectable, Inject, InjectionToken, ErrorHandler } from '@angular/core';
import rpcChannels from './rpcChannels';
import { environment } from './environments/environment';

export const RollbarService = new InjectionToken<Rollbar>('rollbar');

@Injectable()
export class RollbarErrorHandler implements ErrorHandler {
    constructor(@Inject(RollbarService) private rollbar: Rollbar) {
        if (environment.production) {
            window.pydtApi.ipc.send(rpcChannels.INIT_ROLLBAR, null);
        }
    }

    handleError(err: any): void {
        this.rollbar.error(err.originalError || err);
        console.error(err);
    }
}

export function rollbarFactory() {
    return new Rollbar({
        accessToken: '67488d20e1444df7ab91d279659d519a',
        captureUncaught: true,
        captureUnhandledRejections: true,
        enabled: !!environment.production,
        payload: {
            environment: 'prod'
        }
    });
}
