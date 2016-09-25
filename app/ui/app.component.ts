import { Component, OnInit } from '@angular/core';
import { Router }    from '@angular/router';

import { ConfigService } from './shared/config.service';
import { Config } from './shared/config';

@Component({
  selector: 'app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  constructor(private configService: ConfigService, private router: Router) {}

  ngOnInit() {
    this.configService.getConfig().then(config => {
      if (!config.token) {
        this.router.navigate(['/auth']);
      }
    })
  }
}
