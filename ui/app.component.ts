import { Component, OnInit } from '@angular/core';
import { Router }    from '@angular/router';

import { ApiService } from 'civx-angular2-shared';

@Component({
  selector: 'app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.api.isLoggedIn().then(isLoggedIn => {
      if (!isLoggedIn) {
        this.router.navigate(['/auth']);
      }
    });
  }
}
