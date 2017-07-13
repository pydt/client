import { Injectable } from '@angular/core';
import * as storage from 'electron-json-storage';
import { ApiUrlProvider, ApiCredentialsProvider, SteamProfile } from 'pydt-shared';

@Injectable()
export class WebApiCredentialsProvider implements ApiCredentialsProvider {
  store(token: string, profile: SteamProfile): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const config = {
        token: token,
        profile: profile
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

  getSteamProfile(): Promise<SteamProfile> {
    return this.getConfig().then(config => {
      return config.profile;
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

@Injectable()
export class WebApiUrlProvider implements ApiUrlProvider {
  url: string = PYDT_CONFIG.API_URL;
}
