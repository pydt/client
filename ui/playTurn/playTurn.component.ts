import { HttpErrorResponse } from "@angular/common/http";
import { Component, HostListener, Input, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import * as pako from "pako";
import { Game, GameService, SteamProfileMap, CivGame } from "pydt-shared";
import { PydtSettingsFactory, PydtSettingsData } from "../shared/pydtSettings";
import { PlayTurnState } from "./playTurnState.service";
import { TurnCacheService, TurnDownloader } from "../shared/turnCacheService";
import { SafeMetadataLoader } from "../shared/safeMetadataLoader";
import { RPC_TO_MAIN } from "../rpcChannels";

@Component({
  selector: "pydt-home",
  templateUrl: "./playTurn.component.html",
  styleUrls: ["./playTurn.component.css"],
})
export class PlayTurnComponent implements OnInit, OnDestroy {
  @Input() game: Game;
  @Input() gamePlayerProfiles: SteamProfileMap;
  status = "Downloading Save File...";
  saveFileToUpload: string;
  abort: boolean;
  downloaded: boolean;
  curBytes: number;
  maxBytes: number;
  showGameInfo = false;
  settings: PydtSettingsData;
  games: CivGame[] = [];
  xhr: XMLHttpRequest;
  turnDownloader: TurnDownloader;
  private saveDir: string;
  private archiveDir: string;
  private saveFileToPlay: string;

  constructor(
    public readonly playTurnState: PlayTurnState,
    private readonly metadataLoader: SafeMetadataLoader,
    private readonly turnCacheService: TurnCacheService,
    private readonly gameService: GameService,
    private readonly pydtSettingsFactory: PydtSettingsFactory,
    private readonly router: Router,
    private readonly ngZone: NgZone,
  ) {}

  @HostListener("click", ["$event"])
  onMouseEnter(event: MouseEvent): boolean {
    const href = (event.srcElement as { href?: string }).href;

    if (href) {
      window.pydtApi.ipc.send(RPC_TO_MAIN.OPEN_URL, href);
    }

    event.preventDefault();
    return false;
  }

  get civGame(): CivGame {
    return this.games.find(x => x.id === this.playTurnState.game.gameType);
  }

  async ngOnInit(): Promise<void> {
    this.abort = false;
    this.settings = await this.pydtSettingsFactory.getSettings();

    const metadata = await this.metadataLoader.loadMetadata();

    if (!metadata) {
      return;
    }

    this.games = metadata.civGames;

    try {
      this.saveDir = this.settings.getSavePath(this.civGame);

      if (!window.pydtApi.fs.existsSync(this.saveDir)) {
        window.pydtApi.fs.mkdirp(this.saveDir);
      }

      this.archiveDir = window.pydtApi.path.join(this.saveDir, "pydt-archive");

      if (!window.pydtApi.fs.existsSync(this.archiveDir)) {
        window.pydtApi.fs.mkdirp(this.archiveDir);
      }

      this.saveFileToPlay = window.pydtApi.path.join(
        this.saveDir,
        `(PYDT) Play This One!.${this.civGame.saveExtension}`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      this.showGameInfo = false;
      this.abort = true;
      this.status =
        "Unable to locate/create save file directory.  " +
        'Are you using OneDrive and have the "Files On-Demand" option enabled?  ' +
        "The PYDT client will not work in this mode. :(";
      throw err;
    }

    this.turnDownloader = this.turnCacheService.get(this.playTurnState.game.gameId);

    this.turnDownloader.startDownload();

    if (this.turnDownloader.data$.value) {
      this.status = "Turn already downloaded, moving to save location...";
    }

    this.turnDownloader.error$.subscribe(err => {
      if (err) {
        this.turnDownloader = null;
        this.status = err;
        this.showGameInfo = false;
        this.abort = true;
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.turnDownloader?.data$.subscribe(async data => {
      if (data) {
        setTimeout(() => {
          this.turnDownloader = null;
        }, 500);

        try {
          window.pydtApi.fs.writeFileSync(this.saveFileToPlay, data);

          await new Promise(sleepResolve => setTimeout(sleepResolve, 500));

          const url = this.civGame.runUrls[this.settings.getGameStore(this.civGame)];

          await this.ngZone.run(async () => {
            if (this.settings.launchCiv) {
              window.pydtApi.ipc.send(RPC_TO_MAIN.OPEN_URL, url);
            }

            await this.watchForSave();
          });
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.status = err;
          this.showGameInfo = false;
          this.abort = true;
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }

    if (this.turnDownloader) {
      this.turnDownloader.abort();
      this.turnDownloader = null;
    }
  }

  public watchForSave(): Promise<void> {
    this.curBytes = this.maxBytes = null;
    this.status = "Downloaded file!<br />Play Your Damn Turn!";
    this.saveFileToUpload = null;
    this.abort = false;
    this.downloaded = true;

    return new Promise(resolve => setTimeout(resolve, 5000)).then(async () => {
      const path = await window.pydtApi.startChokidar({
        path: this.saveDir,
        awaitWriteFinish: this.playTurnState.game.gameType !== "CIV6",
      });

      this.ngZone.run(() => {
        this.status = `Detected new save: ${window.pydtApi.path
          .basename(path)
          .replace(`.${this.civGame.saveExtension}`, "")}.  Submit turn?`;
        this.downloaded = false;
        this.showGameInfo = false;
        this.saveFileToUpload = path;
      });
    });
  }

  async submitFile(): Promise<void> {
    const fileBeingUploaded = this.saveFileToUpload;

    this.status = "Uploading...";
    this.abort = false;
    this.saveFileToUpload = null;

    const fileData = pako.gzip(window.pydtApi.fs.readFileSync(fileBeingUploaded));
    const moveTo = window.pydtApi.path.join(
      this.archiveDir,
      `${this.playTurnState.game.gameId.slice(0, 8)}_${window.pydtApi.path.basename(fileBeingUploaded)}`,
    );

    try {
      const startResp = await this.gameService.startSubmit(this.playTurnState.game.gameId).toPromise();

      await new Promise((resolve, reject) => {
        this.xhr = new XMLHttpRequest();
        this.xhr.open("PUT", startResp.putUrl, true);

        this.xhr.upload.onprogress = e => {
          this.ngZone.run(() => {
            if (e.lengthComputable) {
              this.curBytes = Math.round(e.loaded / 1024);
              this.maxBytes = Math.round(e.total / 1024);
            }
          });
        };

        this.xhr.onload = () => {
          if (this.xhr.status === 200) {
            resolve(null);
          } else {
            reject(this.xhr.status);
          }

          this.xhr = null;
        };

        this.xhr.onerror = () => {
          reject(this.xhr.status);
          this.xhr = null;
        };

        this.xhr.setRequestHeader("Content-Type", "application/octet-stream");
        this.xhr.send(fileData);
      });

      await this.gameService.finishSubmit(this.playTurnState.game.gameId).toPromise();
      window.pydtApi.fs.renameSync(fileBeingUploaded, moveTo);
    } catch (err) {
      this.status = "There was an error submitting your turn.  Please try again.";

      if (err instanceof HttpErrorResponse) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        this.status = err.error.errorMessage;
      }

      this.curBytes = this.maxBytes = null;
      this.saveFileToUpload = fileBeingUploaded;
      this.abort = true;
      this.showGameInfo = false;
      return;
    }

    // If we've got too many archived files, delete some...
    const files: string[] = window.pydtApi.fs
      .readdirSync(this.archiveDir)
      .flatMap(x => {
        const file = window.pydtApi.path.join(this.archiveDir, x);
        const stat = window.pydtApi.fs.statSync(file);

        if (stat.isDirectory) {
          // Ignore directories
          return [];
        }

        return [
          {
            file,
            time: window.pydtApi.fs.statSync(file).ctime.getTime(),
          },
        ];
      })
      .sort((a, b) => a.time - b.time)
      .map(x => x.file);

    while (files.length > this.settings.numSaves) {
      window.pydtApi.fs.unlinkSync(files.shift());
    }

    this.goHome();
  }

  goHome(): void {
    this.ngZone.run(() => {
      void this.router.navigate(["/"]);
    });
  }

  openGameOnWeb(): void {
    window.pydtApi.ipc.send(
      RPC_TO_MAIN.OPEN_URL,
      `https://playyourdamnturn.com/game/${this.playTurnState.game.gameId}`,
    );
  }
}
