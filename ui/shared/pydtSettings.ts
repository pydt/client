import { isEmpty } from "lodash";
import { CivGame, PlatformSaveLocation, GameStore, Game } from "pydt-shared";
import rpcChannels from "../rpcChannels";

export class PydtSettings {
  launchCiv = true;
  startOnBoot = false;
  numSaves = 100;
  gameStores = {};
  savePaths = {};
  autoDownload = false;

  static async getSettings(): Promise<PydtSettings> {
    const settings = await window.pydtApi.ipc.invoke(
      rpcChannels.STORAGE_GET,
      "settings"
    );

    const result = new PydtSettings();

    if (!isEmpty(settings)) {
      Object.assign(result, settings);
    }

    // Make sure numSaves is an int
    result.numSaves = parseInt(result.numSaves.toString(), 10);

    return result;
  }

  static saveSettings(settings: PydtSettings): Promise<void> {
    return window.pydtApi.ipc.invoke(rpcChannels.STORAGE_SET, 'settings', settings);
  }

  async getDefaultDataPath(civGame: CivGame, gameStore?: GameStore) {
    gameStore = gameStore || (await this.getGameStore(civGame));
    const location: PlatformSaveLocation =
      civGame.saveLocations[window.pydtApi.platform];
    return window.pydtApi.path.normalize(
      (await window.pydtApi.ipc.invoke(rpcChannels.GET_PATH, location.basePath)) +
        location.prefix +
        civGame.dataPaths[gameStore]
    );
  }

  async getDefaultSavePath(civGame: CivGame) {
    return window.pydtApi.path.normalize(
      (await this.getDefaultDataPath(civGame)) + civGame.savePath
    );
  }

  async getGameStore(civGame: CivGame): Promise<GameStore> {
    if (!this.gameStores[civGame.id]) {
      for (const gameStoreKey of Object.keys(GameStore)) {
        if (civGame.dataPaths[GameStore[gameStoreKey]]) {
          const dataPath = await this.getDefaultDataPath(
            civGame,
            GameStore[gameStoreKey]
          );
          if (window.pydtApi.fs.existsSync(dataPath)) {
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

  async getSavePath(civGame: CivGame, returnDefault = true): Promise<string> {
    if (this.savePaths[civGame.id]) {
      return this.savePaths[civGame.id];
    }

    if (returnDefault) {
      return (await this.getDefaultSavePath(civGame));
    }

    return "";
  }

  setSavePath(civGame: CivGame, savePath: string) {
    this.savePaths[civGame.id] = savePath;
  }
}
