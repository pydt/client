import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalDirective } from 'ngx-bootstrap/modal';
import { Router } from '@angular/router';
import * as app from 'electron';

import { ApiService } from 'pydt-shared';
import { PydtSettings } from './shared/pydtSettings';

@Component({
  selector: 'pydt-app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private version: string;
  private newVersion: string;
  private settings = new PydtSettings();

  @ViewChild('aboutModal') aboutModal: ModalDirective;
  @ViewChild('updateModal') updateModal: ModalDirective;
  @ViewChild('settingsModal') settingsModal: ModalDirective;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.api.isLoggedIn().subscribe(isLoggedIn => {
      if (!isLoggedIn) {
        this.router.navigate(['/auth']);
      }
    });

    app.ipcRenderer.on('show-about-modal', (e, data) => {
      this.hideAllModals();
      this.version = data;
      this.aboutModal.show();
    });

    app.ipcRenderer.on('show-settings-modal', (e, data) => {
      this.hideAllModals();

      PydtSettings.getSettings().then(settings => {
        this.settings = settings;
        this.settingsModal.show();
      });
    });

    app.ipcRenderer.on('show-update-modal', (e, data) => {
      this.hideAllModals();
      this.newVersion = data;
      this.updateModal.show();
    });
  }

  hideAllModals() {
    this.aboutModal.hide();
    this.settingsModal.hide();
    this.updateModal.hide();
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
