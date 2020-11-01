import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as app from 'electron';
import { difference, orderBy } from 'lodash';
import { Game, ProfileCacheService, User, UserService } from 'pydt-shared';
import { Observable, Subscription, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../shared/authService';
import { DiscourseInfo } from '../shared/discourseInfo';

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
  errorLoading = false;
  refreshDisabled = false;
  private user: User;
  private timerSub: Subscription;
  private destroyed = false;
  private lastNotification: Date;
  private pollUrl;
  private sortedTurns: GameWithYourTurn[];

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

    this.user = await this.userService.getCurrent().toPromise();

    const $timer = timer(10, POLL_INTERVAL);
    this.configureIot();

    this.timerSub = $timer.subscribe(() => {
      this.safeLoadGames();
    });
  }

  ngOnDestroy() {
    this.lastNotification = null;
    if (this.timerSub) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }

    this.destroyed = true;

    app.ipcRenderer.removeAllListeners('iot-connect');
    app.ipcRenderer.removeAllListeners('iot-error');
    app.ipcRenderer.removeAllListeners('iot-message');
  }

  refresh() {
    this.safeLoadGames();
    this.refreshDisabled = true;
    setTimeout(() => {
      this.refreshDisabled = false;
    }, 30000);
  }

  smackRead(gameId: string, postNumber: number) {
    this.discourseInfo[gameId] = postNumber;
    DiscourseInfo.saveDiscourseInfo(this.discourseInfo);
  }

  async safeLoadGames() {
    let count = 0;

    while (count < 3) {
      try {
        await this.loadGames();
        this.errorLoading = false;
        return;
      } catch (err) {
        count++;
        console.error('Error polling user games...', err);

        if (count < 3) {
          await new Promise(p => setTimeout(p, 5000));
        }
      }
    }

    this.errorLoading = true;
  }

  async loadGames() {
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

    this.games = await req.toPromise();
    this.games.forEach(x => x.gameType = x.gameType || 'CIV6');
    this.setSortedTurns();

    this.profileCache.getProfilesForGames(this.games).then(profiles => {
      this.gamePlayerProfiles = profiles;
    });

    // Notify about turns available
    const yourTurns = this.games
      .filter(game => {
        return game.currentPlayerSteamId === this.user.steamId && game.gameTurnRangeKey > 1;
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
        return DiscourseInfo.isNewSmackTalkPost(x, this.user, readPostNumber);
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
  }

  configureIot() {
    if (!this.user) {
      return;
    }

    const env = PYDT_CONFIG.PROD ? 'prod' : 'dev';
    const topic = `/pydt/${env}/user/${this.user.steamId}/gameupdate`;

    app.ipcRenderer.on('iot-connect', (e, data) => {
      console.log('connected to IoT!');
    });

    app.ipcRenderer.on('iot-error', (e, data) => {
      console.log('IoT error...', data);
    });

    app.ipcRenderer.on('iot-message', (e, data) => {
      console.log('received message from topic ', data.topic);
      this.safeLoadGames();
    });

    app.ipcRenderer.send('start-iot', {
      topic,
      accessKey: PYDT_CONFIG.IOT_CLIENT_ACCESS_KEY,
      secretKey: PYDT_CONFIG.IOT_CLIENT_SECRET_KEY
    });
  }

  setSortedTurns() {
    this.sortedTurns = this.games.map(game => ({
      ...game,
      yourTurn: !!game.inProgress && game.currentPlayerSteamId === this.user.steamId,
      hasSmackTalk: DiscourseInfo.isNewSmackTalkPost(game, this.user, this.discourseInfo[game.gameId] || 0)
    }));

    const yourTurns = orderBy(this.sortedTurns.filter(x => x.yourTurn), x => x.updatedAt, 'desc');

    const others = orderBy(difference(this.sortedTurns, yourTurns), [x => x.hasSmackTalk, x => x.updatedAt], ['desc', 'desc']);

    this.sortedTurns = [
      ...yourTurns,
      ...others
    ];
  }
}

interface GameWithYourTurn extends Game {
  yourTurn: boolean;
  hasSmackTalk: boolean;
}
