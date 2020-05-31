import { Component, NgZone, OnInit, ViewChild } from '@angular/core';
import * as app from 'electron';
import { ModalDirective } from 'ngx-bootstrap/modal';
import { CivGame, GAMES, GameStore } from 'pydt-shared';
import { PydtSettings } from './shared/pydtSettings';

@Component({
  selector: 'pydt-app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  version: string;
  newVersion: string;
  settings = new PydtSettings();
  GAMES = GAMES;

  @ViewChild('aboutModal', { static: true }) aboutModal: ModalDirective;
  @ViewChild('updateModal', { static: true }) updateModal: ModalDirective;
  @ViewChild('manualUpdateModal', { static: true }) manualUpdateModal: ModalDirective;
  @ViewChild('settingsModal', { static: true }) settingsModal: ModalDirective;

  constructor(private zone: NgZone) {}

  ngOnInit() {
    app.ipcRenderer.on('show-about-modal', (e, data) => {
      this.zone.run(() => {
        this.hideAllModals();
        this.version = data;
        this.aboutModal.show();
      });
    });

    app.ipcRenderer.on('show-settings-modal', (e, data) => {
      PydtSettings.getSettings().then(settings => {
        this.zone.run(() => {
          this.hideAllModals();
          this.settings = settings;
          this.settingsModal.show();
        });
      });
    });

    app.ipcRenderer.on('show-update-modal', (e, data) => {
      this.zone.run(() => {
        this.hideAllModals();
        this.newVersion = data;
        this.updateModal.show();
      });
    });

    app.ipcRenderer.on('manual-update-modal', (e, data) => {
      this.zone.run(() => {
        this.hideAllModals();
        this.newVersion = data;
        this.manualUpdateModal.show();
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

  hideAllModals() {
    this.aboutModal.hide();
    this.settingsModal.hide();
    this.updateModal.hide();
    this.manualUpdateModal.hide();
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
    this.settingsModal.hide();
  }

  applyUpdate() {
    app.ipcRenderer.send('apply-update');
  }
}
