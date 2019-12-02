import * as storage from 'electron-json-storage';
import { isEmpty } from 'lodash';
import { User, Game } from 'pydt-shared';

export class DiscourseInfo {
  [gameId: string]: number;

  static getDiscourseInfo(): Promise<DiscourseInfo> {
    return new Promise((resolve, reject) => {
      storage.get('discourseInfo', (err, di: DiscourseInfo) => {
        if (err) {
          return reject(err);
        }

        const result = new DiscourseInfo();

        if (!isEmpty(di)) {
          Object.assign(result, di);
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

  static isNewSmackTalkPost(game: Game, user: User, readPostNumber: number) {
    if (!game.latestDiscoursePostNumber || game.latestDiscoursePostNumber <= readPostNumber) {
      return false;
    }

    if (game.latestDiscoursePostUser === 'system' || game.latestDiscoursePostUser === (user.forumUsername || user.displayName)) {
      return false;
    }

    return true;
  }
}
