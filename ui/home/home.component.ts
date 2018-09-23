import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as awsIot from 'aws-iot-device-sdk';
import * as app from 'electron';
import { difference } from 'lodash';
import { ProfileCacheService } from 'pydt-shared';
import { Observable, Subscription, timer } from 'rxjs';
import { AuthService } from '../shared/authService';
import { DiscourseInfo } from '../shared/discourseInfo';
import { Game, SteamProfile, UserService } from '../swagger/api';
import { map } from 'rxjs/operators';

const POLL_INTERVAL: number = 600 * 1000;
const TOAST_INTERVAL: number = 14.5 * 60 * 1000;

@Component({
  selector: 'pydt-home',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit, OnDestroy {
  games: Game[];
  gamePlayerProfiles: any = {};
  discourseInfo: DiscourseInfo;
  private profile: SteamProfile;
  private timerSub: Subscription;
  private destroyed = false;
  private lastNotification: Date;
  private refreshDisabled = false;
  private iotDevice;
  private pollUrl;

  constructor(
    private userService: UserService,
    private http: HttpClient,
    private router: Router,
    private profileCache: ProfileCacheService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    if (!await this.authService.isAuthenticated()) {
      this.router.navigate(['/auth']);
      return;
    }

    this.profile = await this.userService.steamProfile().toPromise();

    const $timer = timer(10, POLL_INTERVAL);
    this.configureIot();

    this.timerSub = $timer.subscribe(() => {
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

  smackRead(gameId: string, postNumber: number) {
    this.discourseInfo[gameId] = postNumber;
    DiscourseInfo.saveDiscourseInfo(this.discourseInfo);
  }

  async loadGames(retry = 0) {
    if (retry >= 3) {
      return;
    }

    let req: Observable<Game[]>;

    if (this.destroyed) {
      return this.ngOnDestroy();
    }

    if (this.pollUrl) {
      req = this.http.get<Game[]>(this.pollUrl);
    } else {
      req = this.userService.games().pipe(map(games => {
        this.pollUrl = games.pollUrl;
        return games.data;
      }));
    }

    this.discourseInfo = await DiscourseInfo.getDiscourseInfo();

    try {
      this.games = await req.toPromise();

      this.profileCache.getProfilesForGames(this.games).then(profiles => {
        this.gamePlayerProfiles = profiles;
      });

      // Notify about turns available
      const yourTurns = this.games
        .filter(game => {
          return game.currentPlayerSteamId === this.profile.steamid && game.gameTurnRangeKey > 1;
        })
        .map(game => {
          return game.displayName;
        });

      app.ipcRenderer.send('turns-available', !!yourTurns.length);

      let notificationShown = false;

      if ((!this.lastNotification || new Date().getTime() - this.lastNotification.getTime() > TOAST_INTERVAL)) {
        if (yourTurns.length) {
          app.ipcRenderer.send('show-toast', {
            title: 'Play Your Damn Turn!',
            message: yourTurns.join(', ')
          });
          notificationShown = true;
        }

        // Notify about smack talk
        const smackTalk = this.games.filter(x =>  {
          const readPostNumber = this.discourseInfo[x.gameId] || 0;
          return x.latestDiscoursePostNumber && x.latestDiscoursePostNumber > readPostNumber;
        }).map(x => x.displayName);

        if (smackTalk.length) {
          app.ipcRenderer.send('show-toast', {
            title: 'New Smack Talk Message!',
            message: smackTalk.join(', ')
          });
          notificationShown = true;
        }
      }

      if (notificationShown) {
        this.lastNotification = new Date();
      }
    } catch (err) {
      console.error('Error polling user games...', err);

      setTimeout(() => {
        this.loadGames(retry + 1);
      }, 5000);
    }
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

  get sortedTurns(): GameWithYourTurn[] {
    const yourTurnGames = this.games.filter((game: Game) => {
      return game.inProgress && game.currentPlayerSteamId === this.profile.steamid;
    });
    
    const result = yourTurnGames.map((game: Game) => {
      return {
        ...game,
        yourTurn: true
      };
    });

    return result.concat(difference(this.games, yourTurnGames).map((game: Game) => {
      return {
        ...game,
        yourTurn: false
      };
    }));
  }
}

interface GameWithYourTurn {
  yourTurn: boolean;
}
