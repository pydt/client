import * as storage from 'electron-json-storage';
import { isEmpty } from 'lodash';

export class PydtSettings {
  launchCiv = true;
  startOnBoot = false;
  numSaves = 100;

  static getSettings(): Promise<PydtSettings> {
    return new Promise((resolve, reject) => {
      storage.get('settings', (err, settings: PydtSettings) => {
        if (err) {
          return reject(err);
        }

        const result = new PydtSettings();

        if (!isEmpty(settings)) {
          Object.assign(result, settings);
        }

        // Make sure numSaves is an int
        result.numSaves = parseInt(result.numSaves.toString(), 10);

        resolve(result);
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
