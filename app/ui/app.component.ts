import { Component, OnInit } from '@angular/core';
import { ConfigService } from './shared/config.service.ts';

@Component({
  selector: 'app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private token;

  constructor(private config: ConfigService) {}

  ngOnInit() {
    this.config.getToken().then(_token => {
      this.token = _token;
    });
  }
}
