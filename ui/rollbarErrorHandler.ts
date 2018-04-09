import * as Rollbar from 'rollbar';
import { Injectable, Inject, InjectionToken, ErrorHandler } from '@angular/core';

export const RollbarService = new InjectionToken<Rollbar>('rollbar');

@Injectable()
export class RollbarErrorHandler implements ErrorHandler {
    constructor(@Inject(RollbarService) private rollbar: Rollbar) {
        if (PYDT_CONFIG.PROD) {
            require('electron').ipcRenderer.send('init-rollbar');
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
        enabled: !!PYDT_CONFIG.PROD,
        payload: {
            environment: 'prod'
        }
    });
}
