import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router }    from '@angular/router';

import { ApiService } from '../shared/api.service';
import { Config } from '../shared/config';
import { ConfigService } from '../shared/config.service';
import { ProfileCacheService } from '../shared/profileCache.service';
import { Observable, Subscription } from 'rxjs';
import * as _ from 'lodash';
import * as app from 'electron';

@Component({
  selector: 'home',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  private games: any;
  private gamePlayerProfiles: any = {};
  private config: Config;
  private timerSub: Subscription;
  private lastNotification: Date;

  constructor(private apiService: ApiService, private configService: ConfigService, private profileCache: ProfileCacheService, private router: Router) {}

  ngOnInit() {
    this.configService.getConfig().then(config => {
      this.config = config;
    });

    const timer = Observable.timer(10, 60000);
    this.timerSub = timer.subscribe(() => {
      this.apiService.getUserGames().then(games => {
        this.games = games;
        const steamid = this.config.profile.steamid;

        const yourTurns = _.chain(games)
          .filter((game: any) => {
            return game.currentPlayerSteamId == steamid;
          })
          .map((game: any) => {
            return game.displayName
          })
          .value();

        if (yourTurns.length && (!this.lastNotification || new Date().getTime() - this.lastNotification.getTime() > 900000)) {
          app.ipcRenderer.send('show-toast', yourTurns.join(', '));
        }

        let steamIds = _.uniq(_.flatMap(this.games, (game) => {
          return _.map(game.players, 'steamId');
        }));

        return this.profileCache.getProfiles(steamIds as [string]).then(profiles => {
          this.gamePlayerProfiles = profiles;
        });
      });
    });
  }

  ngOnDestroy() {
    this.timerSub.unsubscribe();
  }

  playTurn(game) {
    this.router.navigate(['/playTurn/' + game.gameId]);
  }
}
