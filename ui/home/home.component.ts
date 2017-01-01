import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router }    from '@angular/router';

import { ApiService, ProfileCacheService, SteamProfile, Game } from 'pydt-shared';
import { Observable, Subscription } from 'rxjs';
import * as _ from 'lodash';
import * as app from 'electron';

const POLL_INTERVAL: number = 60 * 1000;
const TOAST_INTERVAL: number = 14.5 * 60 * 1000;

@Component({
  selector: 'pydt-home',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  private busy: Promise<any>;
  private games: Game[];
  private profile: SteamProfile;
  private gamePlayerProfiles: any = {};
  private timerSub: Subscription;
  private destroyed = false;
  private lastNotification: Date;

  constructor(private apiService: ApiService, private profileCache: ProfileCacheService, private router: Router) {}

  ngOnInit() {
    this.apiService.getSteamProfile().then(profile => {
      this.profile = profile;

      const timer = Observable.timer(10, POLL_INTERVAL);
      let pollUrl;

      this.timerSub = timer.subscribe(() => {
        if (this.destroyed) {
          return this.ngOnDestroy();
        }

        let req;

        if (pollUrl) {
          req = this.apiService.getPublicJson(pollUrl);
        } else {
          req = this.apiService.getUserGames().then(games => {
            pollUrl = games.pollUrl;
            return games.data;
          });
        }

        this.busy = req.then(games => {
          this.games = games;

          this.profileCache.getProfilesForGames(games).then(profiles => {
            this.gamePlayerProfiles = profiles;
          });

          const yourTurns = _.chain(this.games)
            .filter(game => {
              return game.currentPlayerSteamId === profile.steamid && game.gameTurnRangeKey > 1;
            })
            .map(game => {
              return game.displayName;
            })
            .value();

          if (yourTurns.length && (!this.lastNotification || new Date().getTime() - this.lastNotification.getTime() > TOAST_INTERVAL)) {
            app.ipcRenderer.send('show-toast', {
              title: 'Play Your Damn Turn!',
              message: yourTurns.join(', ')
            });
            this.lastNotification = new Date();
          }
        }).catch(err => {
          console.log('Error polling user games...', err);
        });

        // Only show busy overlay on initial load...
        if (this.games) {
          this.busy = null;
        }
      });
    });
  }

  ngOnDestroy() {
    this.lastNotification = null;
    if (this.timerSub) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }

    this.destroyed = true;
  }

  yourTurnGames() {
    return _.filter(this.games, (game: Game) => {
      return game.inProgress && game.currentPlayerSteamId === this.profile.steamid;
    });
  }

  notYourTurnGames() {
    return _.difference(this.games, this.yourTurnGames());
  }
}
