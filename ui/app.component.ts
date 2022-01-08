import { Component, NgZone, OnInit, ViewChild, TemplateRef } from "@angular/core";
import { BsModalRef, BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { CivGame, GameStore, MetadataCacheService } from "pydt-shared";
import { PydtSettingsData, PydtSettingsFactory } from "./shared/pydtSettings";
import { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } from "./rpcChannels";
import { setTheme } from "ngx-bootstrap/utils";

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
    public metadataCache: MetadataCacheService,
    private modalService: BsModalService,
    private pydtSettingsFactory: PydtSettingsFactory,
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
          this.civGames = (await this.metadataCache.getCivGameMetadata()).civGames;
          this.hideOpenModal();
          this.settings = settings;
          this.openModal = this.modalService.show(this.settingsModal, modalOptions);
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
  }

  openReleaseNotes(): void {
    window.pydtApi.openUrl(`https://github.com/pydt/client/releases/tag/v${this.version}`);
  }

  gameStoreOptions(civGame: CivGame): { key: string, value: string }[] {
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
