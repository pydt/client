import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalDirective } from 'ngx-bootstrap/modal';
import { PydtSettings } from './shared/pydtSettings';
import { NgZone } from '@angular/core';
import * as app from 'electron';

@Component({
  selector: 'pydt-app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  version: string;
  newVersion: string;
  settings = new PydtSettings();

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

  hideAllModals() {
    this.aboutModal.hide();
    this.settingsModal.hide();
    this.updateModal.hide();
    this.manualUpdateModal.hide();
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
