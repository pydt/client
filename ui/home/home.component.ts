import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router }    from '@angular/router';

import { ApiService, ProfileCacheService, SteamProfile } from 'civx-angular2-shared';
import { Observable, Subscription } from 'rxjs';
import * as _ from 'lodash';
import * as app from 'electron';

const POLL_INTERVAL: number = 60 * 1000;
const TOAST_INTERVAL: number = 14.5 * 60 * 1000;

@Component({
  selector: 'home',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  private games: any;
  private profile: SteamProfile;
  private gamePlayerProfiles: any = {};
  private timerSub: Subscription;
  private lastNotification: Date;

  constructor(private apiService: ApiService, private profileCache: ProfileCacheService, private router: Router) {}

  ngOnInit() {
    const timer = Observable.timer(10, POLL_INTERVAL);
    let pollUrl;

    this.timerSub = timer.subscribe(() => {
      let req;

      if (pollUrl) {
        req = this.apiService.getPublicJson(pollUrl);
      } else {
        req = this.apiService.getUserGames().then(games => {
          pollUrl = games.pollUrl;
          return games.data;
        });
      }

      req.then(games => {
        this.games = games;
        return this.apiService.getSteamProfile();
      })
      .then(profile => {
        this.profile = profile;
        const yourTurns = _.chain(this.games)
          .filter((game: any) => {
            return game.currentPlayerSteamId == profile.steamid;
          })
          .map((game: any) => {
            return game.displayName
          })
          .value();

        if (yourTurns.length && (!this.lastNotification || new Date().getTime() - this.lastNotification.getTime() > TOAST_INTERVAL)) {
          app.ipcRenderer.send('show-toast', {
            title: 'PLAY YOUR DAMN TURN',
            message: yourTurns.join(', ')
          });
          this.lastNotification = new Date();
        }

        let steamIds = _.uniq(_.flatMap(this.games, (game) => {
          return _.map(game.players, 'steamId');
        }));

        return this.profileCache.getProfiles(steamIds as [string]).then(profiles => {
          this.gamePlayerProfiles = profiles;
        });
      }).catch(err => {
        console.log('Error polling user games...', err);
      });
    });
  }

  ngOnDestroy() {
    this.lastNotification = null;
    this.timerSub.unsubscribe();
  }

  playTurn(game) {
    this.router.navigate(['/playTurn/' + game.gameId]);
  }
}
