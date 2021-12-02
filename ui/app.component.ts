import { Component, NgZone, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { BsModalRef, BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { CivGame, GameStore, MetadataCacheService } from 'pydt-shared';
import { PydtSettingsData, PydtSettingsFactory } from './shared/pydtSettings';
import rpcChannels from './rpcChannels';
import { setTheme } from 'ngx-bootstrap/utils';

@Component({
  selector: 'pydt-app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  version: string;
  newVersion: string;
  settings: PydtSettingsData;

  @ViewChild('aboutModal', { static: true }) aboutModal: TemplateRef<any>;
  @ViewChild('updateModal', { static: true }) updateModal: TemplateRef<any>;
  @ViewChild('manualUpdateModal', { static: true }) manualUpdateModal: TemplateRef<any>;
  @ViewChild('settingsModal', { static: true }) settingsModal: TemplateRef<any>;
  openModal: BsModalRef;
  civGames: CivGame[];

  constructor(private zone: NgZone, public metadataCache: MetadataCacheService, private modalService: BsModalService, private pydtSettingsFactory: PydtSettingsFactory) {
    setTheme('bs3');
  }

  ngOnInit() {    
    const modalOptions: ModalOptions = {
      class: 'modal-lg'
    };

    window.pydtApi.ipc.receive(rpcChannels.SHOW_ABOUT_MODAL, data => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.version = data;
        this.openModal = this.modalService.show(this.aboutModal, modalOptions);
      });
    });

    window.pydtApi.ipc.receive(rpcChannels.SHOW_SETTINGS_MODAL, () => {
      this.pydtSettingsFactory.getSettings().then(settings => {
        this.zone.run(async () => {
          this.civGames = (await this.metadataCache.getCivGameMetadata()).civGames;
          this.hideOpenModal();
          this.settings = settings;
          this.openModal = this.modalService.show(this.settingsModal, modalOptions);
        });
      });
    });

    window.pydtApi.ipc.receive(rpcChannels.SHOW_UPDATE_MODAL, data => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.newVersion = data;
        this.openModal = this.modalService.show(this.updateModal, modalOptions);
      });
    });

    window.pydtApi.ipc.receive(rpcChannels.MANUAL_UPDATE_MODAL, data => {
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
    const filePath = await window.pydtApi.showOpenDialog();

    if (filePath) {
      this.settings.setSavePath(civGame, filePath);
    }
  }

  async saveSettings() {
    await this.settings.save();
    window.pydtApi.setAutostart(this.settings.startOnBoot);
    this.hideOpenModal();
  }

  applyUpdate() {
    window.pydtApi.applyUpdate();
  }
}
