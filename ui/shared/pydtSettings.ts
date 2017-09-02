import * as storage from 'electron-json-storage';
import * as _ from 'lodash';

export class PydtSettings {
  launchCiv = true;
  startOnBoot = false;

  static getSettings(): Promise<PydtSettings> {
    return new Promise((resolve, reject) => {
      storage.get('settings', (err, settings: PydtSettings) => {
        if (err) {
          return reject(err);
        }

        if (_.isEmpty(settings)) {
          settings = new PydtSettings();
        }

        resolve(settings);
      });
    });
  }

  static saveSettings(settings: PydtSettings): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      storage.set('settings', settings, err => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  }
}
