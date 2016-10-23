import { Component, OnInit } from '@angular/core';
import { Router }    from '@angular/router';

import { ApiService } from '../shared/api.service';
import { ConfigService } from '../shared/config.service';
import { Config } from '../shared/config';

@Component({
  selector: 'auth',
  templateUrl: './auth.component.html'
})
export class AuthComponent implements OnInit {
  private model = new Config("", null);

  constructor(private apiService: ApiService, private configService: ConfigService, private router: Router) {}

  ngOnInit() {

  }

  onSubmit() {
    let config;

    this.configService.getConfig().then(_config => {
      config = _config;
      config.token = this.model.token;

      return this.configService.saveConfig(config);
    })
    .then(() => {
      return this.apiService.getSteamProfile();
    })
    .then(profile => {
      config.profile = profile;
      return this.configService.saveConfig(config);
    })
    .then(() => {
      this.router.navigate(['/']);
    })
    .catch(err => {
      config.token = null;
      return this.configService.saveConfig(config);
    });
  }
}
