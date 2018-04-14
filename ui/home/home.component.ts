import { Component, OnInit, OnDestroy } from '@angular/core';
import { Http } from '@angular/http';
import { ProfileCacheService } from 'pydt-shared';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { Game, SteamProfile, DefaultService } from '../swagger/api';
import { Router } from '@angular/router';
import { AuthService } from '../shared/authService';
import * as _ from 'lodash';
import * as app from 'electron';
import * as awsIot from 'aws-iot-device-sdk';
import 'rxjs/add/observable/timer';

const POLL_INTERVAL: number = 600 * 1000;
const TOAST_INTERVAL: number = 14.5 * 60 * 1000;

@Component({
  selector: 'pydt-home',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  games: Game[];
  gamePlayerProfiles: any = {};
  private profile: SteamProfile;
  private timerSub: Subscription;
  private destroyed = false;
  private lastNotification: Date;
  private refreshDisabled = false;
  private iotDevice;
  private pollUrl;

  constructor(
    private api: DefaultService,
    private http: Http,
    private router: Router,
    private profileCache: ProfileCacheService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    if (!await this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }

    this.profile = await this.api.userSteamProfile().toPromise();

    const timer = Observable.timer(10, POLL_INTERVAL);
    this.configureIot();

    this.timerSub = timer.subscribe(() => {
      this.loadGames();
    });
  }

  ngOnDestroy() {
    this.lastNotification = null;
    if (this.timerSub) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }

    this.destroyed = true;

    if (this.iotDevice) {
      this.iotDevice.end(true);
      this.iotDevice = null;
    }
  }

  refresh() {
    this.loadGames();
    this.refreshDisabled = true;
    setTimeout(() => {
      this.refreshDisabled = false;
    }, 30000);
  }

  loadGames(retry = 0) {
    if (retry >= 3) {
      return;
    }

    let req: Observable<Game[]>;

    if (this.destroyed) {
      return this.ngOnDestroy();
    }

    if (this.pollUrl) {
      req = this.http.get(this.pollUrl).map(resp => {
        return resp.json();
      });
    } else {
      req = this.api.userGames().map(games => {
        this.pollUrl = games.pollUrl;
        return games.data;
      });
    }

    req.subscribe(games => {
      this.games = games;

      this.profileCache.getProfilesForGames(games).then(profiles => {
        this.gamePlayerProfiles = profiles;
      });

      const yourTurns = _.chain(this.games)
        .filter(game => {
          return game.currentPlayerSteamId === this.profile.steamid && game.gameTurnRangeKey > 1;
        })
        .map(game => {
          return game.displayName;
        })
        .value();

      app.ipcRenderer.send('turns-available', !!yourTurns.length);

      if (yourTurns.length && (!this.lastNotification || new Date().getTime() - this.lastNotification.getTime() > TOAST_INTERVAL)) {
        app.ipcRenderer.send('show-toast', {
          title: 'Play Your Damn Turn!',
          message: yourTurns.join(', ')
        });
        this.lastNotification = new Date();
      }
    }, err => {
      console.log('Error polling user games...', err);

      setTimeout(() => {
        this.loadGames(retry + 1);
      }, 5000);
    });
  }

  configureIot() {
    if (!this.profile) {
      return;
    }

    const env = PYDT_CONFIG.PROD ? 'prod' : 'dev';
    const topic = `/pydt/${env}/user/${this.profile.steamid}/gameupdate`;

    this.iotDevice = awsIot.device({
      region: 'us-east-1',
      protocol: 'wss',
      keepalive: 600,
      accessKeyId: PYDT_CONFIG.IOT_CLIENT_ACCESS_KEY,
      secretKey: PYDT_CONFIG.IOT_CLIENT_SECRET_KEY,
      host: 'a21s639tnrshxf.iot.us-east-1.amazonaws.com'
    });

    this.iotDevice.on('connect', () => {
      console.log('connected to IoT!');
      this.iotDevice.subscribe(topic);
    });

    this.iotDevice.on('error', err => {
      console.log('IoT error...', err);
    });

    this.iotDevice.on('message', (recTopic, message) => {
      console.log('received message from topic ', recTopic);
      if (recTopic === topic) {
        this.loadGames();
      }
    });
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
