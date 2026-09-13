import { Component, NgZone, OnInit, ViewChild, TemplateRef, inject } from "@angular/core";
import { BsModalRef, BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { CivGame, GameStore } from "pydt-shared";
import { CIV6_GAME_ID, isCiv6HotSeatAutoStartBeta, PydtSettingsData, PydtSettingsFactory } from "./shared/pydtSettings";
import { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } from "./rpcChannels";
import { setTheme } from "ngx-bootstrap/utils";
import { SafeMetadataLoader } from "./shared/safeMetadataLoader";
import { AuthService } from "./shared/authService";
import { UpdateService } from "./shared/updateService";
import { Router } from "@angular/router";

@Component({
  selector: "pydt-app",
  templateUrl: "./app.component.html",
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
})
export class AppComponent implements OnInit {
  private zone = inject(NgZone);
  private metadataLoader = inject(SafeMetadataLoader);
  private modalService = inject(BsModalService);
  private pydtSettingsFactory = inject(PydtSettingsFactory);
  private authService = inject(AuthService);
  private updateService = inject(UpdateService);
  private router = inject(Router);

  readonly CIV6_GAME_ID = CIV6_GAME_ID;
  readonly civ6HotSeatAutoStartBeta = isCiv6HotSeatAutoStartBeta();
  version: string;
  newVersion: string;
  settings: PydtSettingsData;
  autoPlayEnabled = false;

  @ViewChild("aboutModal", { static: true }) aboutModal: TemplateRef<unknown>;
  @ViewChild("updateModal", { static: true }) updateModal: TemplateRef<unknown>;
  @ViewChild("settingsModal", { static: true }) settingsModal: TemplateRef<unknown>;
  openModal: BsModalRef;
  civGames: CivGame[];

  constructor() {
    setTheme("bs5");
  }

  ngOnInit(): void {
    const modalOptions: ModalOptions = {
      class: "modal-near-fullscreen",
    };

    void this.refreshAutoPlayEnabled();

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.SHOW_ABOUT_MODAL, data => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.version = data;
        this.openModal = this.modalService.show(this.aboutModal, modalOptions);
      });
    });

    window.pydtApi.ipc.receive(RPC_TO_RENDERER.SHOW_SETTINGS_MODAL, () => {
      void this.pydtSettingsFactory.getSettings().then(settings => {
        void this.zone.run(async () => {
          const metadata = await this.metadataLoader.loadMetadata();

          if (metadata) {
            this.civGames = metadata.civGames;
            this.hideOpenModal();
            this.settings = settings;
            this.openModal = this.modalService.show(this.settingsModal, modalOptions);
          }
        });
      });
    });

    this.updateService.listen();

    this.updateService.showModal$.subscribe(version => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.newVersion = version;
        this.openModal = this.modalService.show(this.updateModal, modalOptions);
      });
    });

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.SET_USER, token => {
      this.zone.run(() => {
        this.hideOpenModal();
        void this.authService.storeToken(token).then(() => this.router.navigate(["/"]));
      });
    });

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.NEW_USER, () => {
      this.zone.run(() => {
        this.hideOpenModal();
        void this.router.navigate(["/auth"]);
      });
    });
  }

  private async refreshAutoPlayEnabled(): Promise<void> {
    const settings = await this.pydtSettingsFactory.getSettings();
    this.autoPlayEnabled = settings.autoPlay;
  }

  openReleaseNotes(): void {
    window.pydtApi.ipc.send(RPC_TO_MAIN.OPEN_URL, `https://github.com/pydt/client/releases/tag/v${this.version}`);
  }

  gameStoreOptions(civGame: CivGame): { key: string; value: string }[] {
    return Object.keys(GameStore)
      .filter(x => !!civGame.dataPaths[GameStore[x] as string])
      .map(key => ({
        key,
        value: GameStore[key] as string,
      }));
  }

  hideOpenModal(): void {
    if (this.openModal) {
      this.openModal.hide();
    }

    this.openModal = null;
  }

  async openDirectoryDialog(civGame: CivGame): Promise<void> {
    const filePath = await window.pydtApi.ipc.invoke<string>(RPC_INVOKE.SHOW_OPEN_DIALOG);

    if (filePath) {
      this.settings.setSavePath(civGame, filePath);
    }
  }

  async saveSettings(): Promise<void> {
    await this.settings.save();
    window.pydtApi.setAutostart(this.settings.startOnBoot);
    await this.revertIntroSkipIfDisabled();
    await this.revertCiv6AutostartIfDisabled();
    window.pydtApi.ipc.send(RPC_TO_MAIN.SET_TURN_API_ENABLED, {
      enabled: this.settings.turnApiEnabled,
      port: this.settings.turnApiPort,
    });
    this.autoPlayEnabled = this.settings.autoPlay;
    this.pydtSettingsFactory.settingsChanged$.next();
    this.hideOpenModal();
  }

  // Turn the intro video back on
  private async revertIntroSkipIfDisabled(): Promise<void> {
    const civ6 = this.civGames?.find(x => x.id === CIV6_GAME_ID);

    if (!civ6 || this.settings.shouldSkipCiv6Intro(civ6)) {
      return;
    }

    const result = await window.pydtApi.ipc.invoke<{ ok: boolean; message: string }>(
      RPC_INVOKE.CIV6_INTRO_SKIP_REVERT,
      {
        dataPath: this.settings.getDefaultDataPath(civ6),
      },
    );

    if (!result?.ok) {
      window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_ERROR, `Could not restore Civ 6 intro video: ${result?.message}`);
    }
  }

  // Uninstall the Civ6 autostart when not needed
  private async revertCiv6AutostartIfDisabled(): Promise<void> {
    const civ6 = this.civGames?.find(x => x.id === CIV6_GAME_ID);

    if (!civ6 || this.settings.shouldHotSeatAutoStartCiv6(civ6)) {
      return;
    }

    const result = await window.pydtApi.ipc.invoke<{ ok: boolean; message: string }>(RPC_INVOKE.CIV6_AUTOSTART_REVERT, {
      dataPath: this.settings.getDefaultDataPath(civ6),
      waitForExit: true,
    });

    if (!result?.ok) {
      window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_ERROR, `Could not revert Civ 6 autostart: ${result?.message}`);
    }
  }

  async applyUpdate(): Promise<void> {
    await this.updateService.applyUpdate();
  }
}
