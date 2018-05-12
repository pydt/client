import * as storage from 'electron-json-storage';
import * as _ from 'lodash';

export class DiscourseInfo {
  [gameId: string]: number;

  static getDiscourseInfo(): Promise<DiscourseInfo> {
    return new Promise((resolve, reject) => {
      storage.get('discourseInfo', (err, di: DiscourseInfo) => {
        if (err) {
          return reject(err);
        }

        const result = new DiscourseInfo();

        if (!_.isEmpty(di)) {
          _.assign(result, di);
        }

        resolve(result);
      });
    });
  }

  static saveDiscourseInfo(di: DiscourseInfo): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      storage.set('discourseInfo', di, err => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  }
}
