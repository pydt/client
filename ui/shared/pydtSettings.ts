import { Injectable } from "@angular/core";
import { CivGame, PlatformSaveLocation, GameStore, MetadataCacheService, BasePath } from "pydt-shared";
import { RPC_INVOKE } from "../rpcChannels";
import { isEmpty, merge, omit } from "lodash";

const FIELDS_NOT_TO_PERSIST = ["basePaths"];

export class PydtSettingsData {
  launchCiv = true;
  startOnBoot = false;
  numSaves = 100;
  gameStores: {[index: string]: GameStore} = {};
  savePaths: {[index: string]: string} = {};
  autoDownload = false;

  constructor(civGames: CivGame[], prevData: PydtSettingsData, private basePaths: { [index: string]: string }) {
    if (!isEmpty(prevData)) {
      merge(this, omit(prevData, FIELDS_NOT_TO_PERSIST));

      // Make sure numSaves is an int
      this.numSaves = parseInt(this.numSaves.toString(), 10);
    }

    for (const civGame of civGames) {
      for (const gameStoreKey of Object.keys(GameStore)) {
        if (!this.gameStores[civGame.id] && civGame.dataPaths[GameStore[gameStoreKey] as GameStore]) {
          const dataPath = this.getDefaultDataPath(
            civGame,
            GameStore[gameStoreKey] as GameStore,
          );

          if (window.pydtApi.fs.existsSync(dataPath)) {
            this.gameStores[civGame.id] = GameStore[gameStoreKey] as GameStore;
            break;
          }
        }
      }

      // Ensure gamestore settings are valid
      if (!civGame.dataPaths[this.gameStores[civGame.id]]) {
        // If invalid, find first valid option
        for (const gs of Object.values(GameStore)) {
          const dp = civGame.dataPaths[gs];

          if (dp) {
            this.gameStores[civGame.id] = gs;
            break;
          }
        }
      }
    }
  }

  async save(): Promise<void> {
    await window.pydtApi.ipc.invoke(RPC_INVOKE.STORAGE_SET, "settings", omit(this, FIELDS_NOT_TO_PERSIST));
  }

  getDefaultDataPath(civGame: CivGame, gameStore?: GameStore): string {
    const location: PlatformSaveLocation =
      civGame.saveLocations[window.pydtApi.platform];

    return window.pydtApi.path.normalize(
      window.pydtApi.path.join(
        this.basePaths[location.basePath],
        location.prefix,
        civGame.dataPaths[gameStore || this.getGameStore(civGame)],
      ),
    );
  }

  getDefaultSavePath(civGame: CivGame): string {
    return window.pydtApi.path.normalize(
      window.pydtApi.path.join(
        this.getDefaultDataPath(civGame),
        civGame.savePath,
      ),
    );
  }

  getGameStore(civGame: CivGame): GameStore {
    return this.gameStores[civGame.id];
  }

  setGameStore(civGame: CivGame, gameStore: GameStore): void {
    this.gameStores[civGame.id] = gameStore;
  }

  getSavePath(civGame: CivGame, returnDefault = true): string {
    if (this.savePaths[civGame.id]) {
      return this.savePaths[civGame.id];
    }

    if (returnDefault) {
      return this.getDefaultSavePath(civGame);
    }

    return "";
  }

  setSavePath(civGame: CivGame, savePath: string): void {
    this.savePaths[civGame.id] = savePath;
  }
}

@Injectable()
export class PydtSettingsFactory {
  constructor(private readonly metadataCache: MetadataCacheService) { }

  async getSettings(): Promise<PydtSettingsData> {
    const settings = await window.pydtApi.ipc.invoke<PydtSettingsData>(
      RPC_INVOKE.STORAGE_GET,
      "settings",
    );

    const metadata = await this.metadataCache.getCivGameMetadata();

    const basePaths = {};

    // Get all basepaths so we don't need async in PydtSettingsData
    for (const basePath of Object.values(BasePath)) {
      basePaths[basePath] = await window.pydtApi.ipc.invoke(RPC_INVOKE.GET_PATH, basePath);
    }

    return new PydtSettingsData(metadata.civGames, settings, basePaths);
  }
}
