import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalDirective } from 'ngx-bootstrap/modal';
import { Router } from '@angular/router';
import { PydtSettings } from './shared/pydtSettings';
import * as app from 'electron';
import { NgZone } from '@angular/core';
import { AuthService } from './shared/authService';

@Component({
  selector: 'pydt-app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  version: string;
  newVersion: string;
  settings = new PydtSettings();

  @ViewChild('aboutModal') aboutModal: ModalDirective;
  @ViewChild('updateModal') updateModal: ModalDirective;
  @ViewChild('settingsModal') settingsModal: ModalDirective;

  constructor(private auth: AuthService, private router: Router, private zone: NgZone) {}

  ngOnInit() {
    this.auth.getToken().then(token => {
      if (!token) {
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
        this.zone.run(() => {
          this.settings = settings;
          this.settingsModal.show();
        });
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
