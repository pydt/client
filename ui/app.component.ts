import { Component, OnInit, ViewChild, ViewContainerRef  } from '@angular/core';
import { ModalDirective } from 'ng2-bootstrap/ng2-bootstrap';
import { Router }    from '@angular/router';
import * as app from 'electron';

import { ApiService } from 'civx-angular2-shared';

@Component({
  selector: 'app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private version: string;
  @ViewChild('aboutModal') aboutModal: ModalDirective;

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
  }
}
