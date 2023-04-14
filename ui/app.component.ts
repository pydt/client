import { Component, NgZone, OnInit, ViewChild, TemplateRef } from "@angular/core";
import { BsModalRef, BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { CivGame, GameStore } from "pydt-shared";
import { PydtSettingsData, PydtSettingsFactory } from "./shared/pydtSettings";
import { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } from "./rpcChannels";
import { setTheme } from "ngx-bootstrap/utils";
import { SafeMetadataLoader } from "./shared/safeMetadataLoader";
import { AuthService } from "./shared/authService";
import { Router } from "@angular/router";

@Component({
  selector: "pydt-app",
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
  version: string;
  newVersion: string;
  settings: PydtSettingsData;

  @ViewChild("aboutModal", { static: true }) aboutModal: TemplateRef<unknown>;
  @ViewChild("updateModal", { static: true }) updateModal: TemplateRef<unknown>;
  @ViewChild("settingsModal", { static: true }) settingsModal: TemplateRef<unknown>;
  openModal: BsModalRef;
  civGames: CivGame[];

  constructor(
    private zone: NgZone,
    private metadataLoader: SafeMetadataLoader,
    private modalService: BsModalService,
    private pydtSettingsFactory: PydtSettingsFactory,
    private authService: AuthService,
    private router: Router,
  ) {
    setTheme("bs3");
  }

  ngOnInit(): void {
    const modalOptions: ModalOptions = {
      class: "modal-lg",
    };

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

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.SHOW_UPDATE_MODAL, data => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.newVersion = data;
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
    this.hideOpenModal();
  }

  async applyUpdate(): Promise<void> {
    await window.pydtApi.ipc.invoke(RPC_INVOKE.SET_FORCE_QUIT, true);
    window.pydtApi.ipc.send(RPC_TO_MAIN.APPLY_UPDATE, null);
  }
}
