import * as app from 'electron';
import * as storage from 'electron-json-storage';
import * as path from 'path';
import * as fs from 'fs';
import { isEmpty } from 'lodash';
import { CivGame, PlatformSaveLocation, GameStore, Game } from 'pydt-shared';

export class PydtSettings {
  launchCiv = true;
  startOnBoot = false;
  numSaves = 100;
  gameStores = {};
  savePaths = {};
  autoDownload = false;

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

  getDefaultDataPath(civGame: CivGame, gameStore?: GameStore) {
    gameStore = gameStore || this.getGameStore(civGame);
    const location: PlatformSaveLocation = civGame.saveLocations[process.platform];
    return path.normalize(app.remote.app.getPath(location.basePath) + location.prefix + civGame.dataPaths[gameStore]);
  }

  getDefaultSavePath(civGame: CivGame) {
    return path.normalize(this.getDefaultDataPath(civGame) + civGame.savePath);
  }

  getGameStore(civGame: CivGame): GameStore {
    if (!this.gameStores[civGame.id]) {
      for (const gameStoreKey of Object.keys(GameStore)) {
        if (civGame.dataPaths[GameStore[gameStoreKey]]) {
          const dataPath = this.getDefaultDataPath(civGame, GameStore[gameStoreKey]);
          if (fs.existsSync(dataPath)) {
            this.gameStores[civGame.id] = GameStore[gameStoreKey];
            break;
          }
        }
      }

      if (!this.gameStores[civGame.id]) {
        this.gameStores[civGame.id] = GameStore.Steam;
      }
    }

    return this.gameStores[civGame.id];
  }

  setGameStore(civGame: CivGame, gameStore: GameStore) {
    this.gameStores[civGame.id] = gameStore;
  }

  getSavePath(civGame: CivGame, returnDefault = true): string {
    if (this.savePaths[civGame.id]) {
      return this.savePaths[civGame.id];
    }

    if (returnDefault) {
      return this.getDefaultSavePath(civGame);
    }

    return '';
  }

  setSavePath(civGame: CivGame, savePath: string) {
    this.savePaths[civGame.id] = savePath;
  }
}
