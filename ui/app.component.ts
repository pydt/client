import { Component, NgZone, OnInit, ViewChild, TemplateRef } from '@angular/core';
import * as app from 'electron';
import { ModalDirective, BsModalRef, BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { CivGame, GameStore, MetadataCacheService } from 'pydt-shared';
import { PydtSettings } from './shared/pydtSettings';

@Component({
  selector: 'pydt-app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  version: string;
  newVersion: string;
  settings = new PydtSettings();

  @ViewChild('aboutModal', { static: true }) aboutModal: TemplateRef<any>;
  @ViewChild('updateModal', { static: true }) updateModal: TemplateRef<any>;
  @ViewChild('manualUpdateModal', { static: true }) manualUpdateModal: TemplateRef<any>;
  @ViewChild('settingsModal', { static: true }) settingsModal: TemplateRef<any>;
  openModal: BsModalRef;
  civGames: CivGame[];

  constructor(private zone: NgZone, public metadataCache: MetadataCacheService, private modalService: BsModalService) {}

  ngOnInit() {
    const modalOptions: ModalOptions = {
      class: 'modal-lg'
    };

    app.ipcRenderer.on('show-about-modal', (e, data) => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.version = data;
        this.openModal = this.modalService.show(this.aboutModal, modalOptions);
      });
    });

    app.ipcRenderer.on('show-settings-modal', (e, data) => {
      PydtSettings.getSettings().then(settings => {
        this.zone.run(async () => {
          this.civGames = (await this.metadataCache.getCivGameMetadata()).civGames;
          this.hideOpenModal();
          this.settings = settings;
          this.openModal = this.modalService.show(this.settingsModal, modalOptions);
        });
      });
    });

    app.ipcRenderer.on('show-update-modal', (e, data) => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.newVersion = data;
        this.openModal = this.modalService.show(this.updateModal, modalOptions);
      });
    });

    app.ipcRenderer.on('manual-update-modal', (e, data) => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.newVersion = data;
        this.openModal = this.modalService.show(this.manualUpdateModal, modalOptions);
      });
    });
  }

  gameStoreOptions(civGame: CivGame) {
    return Object.keys(GameStore)
      .filter(x => !!civGame.dataPaths[GameStore[x]])
      .map(key => ({
        key,
        value: GameStore[key]
      }));
  }

  hideOpenModal() {
    if (this.openModal) {
      this.openModal.hide();
    }

    this.openModal = null;
  }

  async openDirectoryDialog(civGame: CivGame) {
    const result = await app.remote.dialog.showOpenDialog({ properties: [ 'openDirectory' ] });

    if (!result.canceled && result.filePaths.length) {
      this.settings.setSavePath(civGame, result.filePaths[0]);
    }
  }

  saveSettings() {
    PydtSettings.saveSettings(this.settings);
    app.ipcRenderer.send('set-autostart', this.settings.startOnBoot);
    this.hideOpenModal();
  }

  applyUpdate() {
    app.ipcRenderer.send('apply-update');
  }
}
