import { Injectable } from '@angular/core';
import * as storage from 'electron-json-storage';
import { Configuration, User, UserService } from 'pydt-shared';

@Injectable()
export class AuthService {
  private user: User;

  constructor(
    private readonly apiConfig: Configuration,
    private readonly userService: UserService
  ) {
  }

  async isAuthenticated() {
    await this.setApiConfig();
    return !!this.apiConfig.apiKeys.Authorization;
  }

  async getUser(force: boolean) {
    if (!this.user || force) {
      try {
        this.user = await this.userService.getCurrent().toPromise();
      } catch {
        /* Ignore error, we'll try again later... */
      }
    }

    return this.user;
  }

  storeToken(token: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const config = {
        token: token
      };

      if (!token) {
        this.user = null;
      }

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
