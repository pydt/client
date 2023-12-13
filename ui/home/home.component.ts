import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { difference, orderBy } from "lodash-es";
import { Game, ProfileCacheService, SteamProfileMap, User, UserService } from "pydt-shared";
import { Observable, Subscription, timer } from "rxjs";
import { map } from "rxjs/operators";
import { TurnCacheService } from "../shared/turnCacheService";
import { AuthService } from "../shared/authService";
import { DiscourseInfo } from "../shared/discourseInfo";
import { environment } from "../environments/environment";
import { RPC_TO_MAIN, RPC_TO_RENDERER } from "../rpcChannels";

const POLL_INTERVAL: number = 600 * 1000;
const TOAST_INTERVAL: number = 14.5 * 60 * 1000;

interface GameWithYourTurn extends Game {
  yourTurn: boolean;
  hasSmackTalk: boolean;
}

@Component({
  selector: "pydt-home",
  templateUrl: "./home.component.html",
})
export class HomeComponent implements OnInit, OnDestroy {
  games: Game[];
  gamePlayerProfiles: SteamProfileMap = {};
  discourseInfo: DiscourseInfo;
  errorLoading = false;
  refreshDisabled = false;
  hasUnreadSmack = false;
  private user: User;
  private timerSub: Subscription;
  private destroyed = false;
  private lastNotification: Date;
  private pollUrl: string;
  private iotConnected = false;
  private sortedTurns: GameWithYourTurn[];
  private navigationSubscription: Subscription;

  constructor(
    private readonly userService: UserService,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly profileCache: ProfileCacheService,
    private readonly turnCacheService: TurnCacheService,
    private readonly authService: AuthService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!(await this.authService.isAuthenticated())) {
      await this.router.navigate(["/auth"]);
      return;
    }

    this.route.queryParamMap.subscribe(x => {
      if (x.has("errorLoading")) {
        this.errorLoading = true;
      }
    });

    // Force a refresh of the user data
    this.user = await this.authService.getUser(true);

    const $timer = timer(10, POLL_INTERVAL);

    this.timerSub = $timer.subscribe(() => {
      void this.safeLoadGames();
    });

    this.navigationSubscription = this.router.events.subscribe((e: unknown) => {
      // If reloading page reload user and games (could be changing user)
      if (e instanceof NavigationEnd) {
        void this.authService.getUser(true).then(user => {
          this.user = user;
          this.iotConnected = false;
          this.pollUrl = "";
          void this.safeLoadGames();
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.lastNotification = null;
    if (this.timerSub) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }

    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
      this.navigationSubscription = null;
    }

    this.destroyed = true;

    window.pydtApi.ipc.removeAllListeners(RPC_TO_RENDERER.IOT_CONNECT);
    window.pydtApi.ipc.removeAllListeners(RPC_TO_RENDERER.IOT_ERROR);
    window.pydtApi.ipc.removeAllListeners(RPC_TO_RENDERER.IOT_MESSAGE);
  }

  refresh(): void {
    void this.safeLoadGames();
    this.refreshDisabled = true;
    setTimeout(() => {
      this.refreshDisabled = false;
    }, 30000);
  }

  async clearSmack() {
    this.hasUnreadSmack = false;

    for (const turn of this.sortedTurns) {
      this.discourseInfo[turn.gameId] = turn.latestDiscoursePostNumber;
    }

    await DiscourseInfo.saveDiscourseInfo(this.discourseInfo);
  }

  smackRead(gameId: string, postNumber: number): Promise<void> {
    this.discourseInfo[gameId] = postNumber;
    this.findUnreadSmack();
    return DiscourseInfo.saveDiscourseInfo(this.discourseInfo);
  }

  async safeLoadGames(): Promise<void> {
    let count = 0;

    while (count < 3) {
      try {
        this.user = await this.authService.getUser(false);
        this.configureIot();
        await this.loadGames();
        this.errorLoading = false;
        return;
      } catch (err) {
        count++;

        // eslint-disable-next-line no-console
        console.error("Error polling user games...", err);

        if (count < 3) {
          await new Promise(p => setTimeout(p, 5000));
        }
      }
    }

    this.errorLoading = true;
  }

  async loadGames(): Promise<void> {
    let req: Observable<Game[]>;

    if (this.destroyed) {
      this.ngOnDestroy();
      return;
    }

    if (this.pollUrl) {
      req = this.http.get<Game[]>(this.pollUrl);
    } else {
      req = this.userService.games().pipe(
        map(games => {
          this.pollUrl = games.pollUrl;
          return games.data;
        }),
      );
    }

    this.discourseInfo = await DiscourseInfo.getDiscourseInfo();

    this.games = await req.toPromise();
    this.games.forEach(x => {
      x.gameType = x.gameType || "CIV6";
    });
    this.setSortedTurns();

    this.gamePlayerProfiles = await this.profileCache.getProfilesForGames(this.games);

    // Notify about turns available
    const yourTurns = this.games.filter(
      game => game.currentPlayerSteamId === this.user.steamId && game.gameTurnRangeKey > 1,
    );

    this.turnCacheService.updateGames(yourTurns);

    window.pydtApi.ipc.send(RPC_TO_MAIN.UPDATE_TURNS_AVAILABLE, !!yourTurns.length);

    let notificationShown = false;

    if (!this.lastNotification || new Date().getTime() - this.lastNotification.getTime() > TOAST_INTERVAL) {
      if (yourTurns.length) {
        window.pydtApi.ipc.send(RPC_TO_MAIN.SHOW_NOTIFICATION, {
          title: "Play Your Damn Turn!",
          body: yourTurns.map(x => x.displayName).join(", "),
        });
        notificationShown = true;
      }

      // Notify about smack talk
      const smackTalk = this.findUnreadSmack();

      if (smackTalk.length) {
        window.pydtApi.ipc.send(RPC_TO_MAIN.SHOW_NOTIFICATION, {
          title: "New Smack Talk Message!",
          body: smackTalk.join(", "),
        });
        notificationShown = true;
      }
    }

    if (notificationShown) {
      this.lastNotification = new Date();
    }
  }

  private findUnreadSmack() {
    // Notify about smack talk
    const result = this.games
      .filter(x => {
        const readPostNumber = this.discourseInfo[x.gameId] || 0;

        return DiscourseInfo.isNewSmackTalkPost(x, this.user, readPostNumber);
      })
      .map(x => x.displayName);

    this.hasUnreadSmack = !!result.length;

    return result;
  }

  configureIot(): void {
    if (this.iotConnected) {
      return;
    }

    if (!this.user) {
      return;
    }

    const env = environment.production ? "prod" : "dev";
    const topic = `/pydt/${env}/user/${this.user.steamId}/gameupdate`;

    window.pydtApi.ipc.receive(RPC_TO_RENDERER.IOT_CONNECT, () => {
      // eslint-disable-next-line no-console
      console.log("connected to IoT!");
    });

    window.pydtApi.ipc.receive(RPC_TO_RENDERER.IOT_ERROR, data => {
      // eslint-disable-next-line no-console
      console.error("IoT error...", data);
    });

    window.pydtApi.ipc.receive<{ topic: string }>(RPC_TO_RENDERER.IOT_MESSAGE, data => {
      // eslint-disable-next-line no-console
      console.log("received message from topic ", data.topic);
      void this.safeLoadGames();
    });

    window.pydtApi.ipc.send(RPC_TO_MAIN.START_IOT, {
      topic,
      accessKey: environment.iotClientAccessKey,
      secretKey: environment.iotClientSecretKey,
    });

    this.iotConnected = true;
  }

  setSortedTurns(): void {
    this.sortedTurns = this.games.map(game => ({
      ...game,
      yourTurn: !!game.inProgress && game.currentPlayerSteamId === this.user.steamId,
      hasSmackTalk: DiscourseInfo.isNewSmackTalkPost(game, this.user, this.discourseInfo[game.gameId] || 0),
    }));

    const yourTurns = orderBy(
      this.sortedTurns.filter(x => x.yourTurn),
      [x => (x.flags || []).length, x => x.updatedAt],
      ["desc", "desc"],
    );

    const others = orderBy(
      difference(this.sortedTurns, yourTurns),
      [x => x.hasSmackTalk, x => x.updatedAt],
      ["desc", "desc"],
    );

    this.sortedTurns = [...yourTurns, ...others];
  }
}
