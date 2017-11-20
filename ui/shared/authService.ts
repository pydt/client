import { Injectable } from '@angular/core';
import * as storage from 'electron-json-storage';

@Injectable()
export class AuthService {
  store(token: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const config = {
        token: token
      };

      storage.set('configData', config, err => {
        if (err) {
          reject(err);
        }

        resolve();
      });
    });
  }

  getToken(): Promise<string> {
    return this.getConfig().then(config => {
      return config.token;
    });
  }

  getConfig(): Promise<any> {
    return new Promise((resolve, reject) => {
      storage.get('configData', (err, config) => {
        if (err) {
          reject(err);
        }

        resolve(config);
      });
    });
  }
}
