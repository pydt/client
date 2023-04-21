import { Injectable } from "@angular/core";
import { CivGame, PlatformSaveLocation, GameStore, BasePath, Platform } from "pydt-shared";
import { RPC_INVOKE } from "../rpcChannels";
import { isEmpty, merge, omit } from "lodash-es";
import { SafeMetadataLoader } from "./safeMetadataLoader";
import { STORAGE_CONFIG } from "../storageConfig";

const FIELDS_NOT_TO_PERSIST = ["basePaths"];

export class PydtSettingsData {
  launchCiv = true;
  startOnBoot = false;
  startHidden = false;
  numSaves = 100;
  gameStores: { [index: string]: GameStore } = {};
  savePaths: { [index: string]: string } = {};
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
          const dataPath = this.getDefaultDataPath(civGame, GameStore[gameStoreKey] as GameStore);

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
    await window.pydtApi.ipc.invoke(RPC_INVOKE.STORAGE_SET, STORAGE_CONFIG.SETTINGS, omit(this, FIELDS_NOT_TO_PERSIST));
  }

  getDefaultDataPath(civGame: CivGame, gameStore?: GameStore): string {
    const location: PlatformSaveLocation = civGame.saveLocations[window.pydtApi.platform];

    let result = window.pydtApi.path.normalize(
      window.pydtApi.path.join(
        this.basePaths[location.basePath],
        location.prefix,
        civGame.dataPaths[gameStore || this.getGameStore(civGame)],
      ),
    );

    if (window.pydtApi.platform === Platform.Linux) {
      // User could be running proton on linux, see if proton path exists
      const protonLocation: PlatformSaveLocation = civGame.saveLocations[Platform.LinuxProton];

      if (protonLocation) {
        const protonPath = window.pydtApi.path.normalize(
          window.pydtApi.path.join(
            this.basePaths[protonLocation.basePath],
            protonLocation.prefix,
            civGame.dataPaths[gameStore || this.getGameStore(civGame)],
          ),
        );

        if (window.pydtApi.fs.existsSync(protonPath)) {
          result = protonPath;
        }
      }
    }

    return result;
  }

  getDefaultSavePath(civGame: CivGame): string {
    return window.pydtApi.path.normalize(window.pydtApi.path.join(this.getDefaultDataPath(civGame), civGame.savePath));
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
  constructor(private readonly metadataLoader: SafeMetadataLoader) {}

  async getSettings(): Promise<PydtSettingsData> {
    const settings = await window.pydtApi.ipc.invoke<PydtSettingsData>(RPC_INVOKE.STORAGE_GET, STORAGE_CONFIG.SETTINGS);

    const metadata = await this.metadataLoader.loadMetadata();

    const basePaths = {};

    // Get all basepaths so we don't need async in PydtSettingsData
    for (const basePath of Object.values(BasePath)) {
      basePaths[basePath] = await window.pydtApi.ipc.invoke(RPC_INVOKE.GET_PATH, basePath);
    }

    return new PydtSettingsData(metadata?.civGames || [], settings, basePaths);
  }
}
