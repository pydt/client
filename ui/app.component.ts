import { Component, OnInit, ViewChild, ViewContainerRef  } from '@angular/core';
import { ModalDirective } from 'ng2-bootstrap/ng2-bootstrap';
import { Router }    from '@angular/router';
import * as app from 'electron';

import { ApiService } from 'pydt-shared';

@Component({
  selector: 'app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private version: string;
  private newVersion: string;
  @ViewChild('aboutModal') aboutModal: ModalDirective;
  @ViewChild('updateModal') updateModal: ModalDirective;

  constructor(private api: ApiService, private router: Router, private viewContainerRef: ViewContainerRef) {}

  ngOnInit() {
    this.api.isLoggedIn().then(isLoggedIn => {
      if (!isLoggedIn) {
        this.router.navigate(['/auth']);
      }
    });

    app.ipcRenderer.on('show-about-modal', (e, data) => {
      this.version = data;
      this.aboutModal.show();
    });

    app.ipcRenderer.on('show-update-modal', (e, data) => {
      this.newVersion = data;
      this.updateModal.show();
    });
  }

  applyUpdate() {
    app.ipcRenderer.send('apply-update');
  }
}
