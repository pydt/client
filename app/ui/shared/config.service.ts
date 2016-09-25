import { Injectable } from '@angular/core';
import * as storage from 'electron-json-storage';

import { Config } from './config';

@Injectable()
export class ConfigService {

  constructor() {}

  getConfig(): Promise<Config> {
    return new Promise((resolve, reject) => {
      storage.get('configData', (err, config) => {
        if (err) {
          reject(err);
        }

        resolve(config);
      });
    });
  }

  saveConfig(config: Config): Promise<void> {
    return new Promise((resolve, reject) => {
      storage.set('configData', config, err => {
        if (err) {
          reject(err);
        }

        resolve();
      });
    });
  }
}
