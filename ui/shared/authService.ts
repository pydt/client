import { Injectable } from '@angular/core';
import { Configuration } from '../swagger/api';
import * as storage from 'electron-json-storage';

@Injectable()
export class AuthService {
  constructor(private apiConfig: Configuration) {
  }

  async isAuthenticated() {
    await this.setApiConfig();
    return !!this.apiConfig.apiKeys.Authorization;
  }

  storeToken(token: string): Promise<void> {
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
    }).then(() => {
      return this.setApiConfig();
    });
  }

  private setApiConfig() {
    return this.getConfig().then(config => {
      this.apiConfig.apiKeys = { Authorization: config ? config.token : null };
    });
  }

  private getConfig(): Promise<any> {
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
