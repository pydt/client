import { Injectable } from '@angular/core';
import * as storage from 'electron-json-storage';

@Injectable()
export class ConfigService {
  private token: String;

  constructor() {}

  getToken() {
    return this.getConfigData().then((data: any) => {
      return data.token;
    });
  }

  setToken() {
    return this.getConfigData().then(data => {
      return
    });
  }

  private getConfigData() {
    return new Promise((resolve, reject) => {
      storage.get('configData', (err, data) => {
        if (err) {
          reject(err);
        }

        resolve(data);
      });
    });
  }

  private saveConfigData(data) {
    return new Promise((resolve, reject) => {
      storage.set('configData', data, err => {
        if (err) {
          reject(err);
        }

        resolve();
      });
    });
  }
}
