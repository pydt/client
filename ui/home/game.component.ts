import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from "@angular/core";
import { Router } from "@angular/router";
import { Game, SteamProfileMap, User, CivGame, CountdownUtility } from "pydt-shared";
import { SafeMetadataLoader } from "../shared/safeMetadataLoader";
import { PlayTurnState } from "../playTurn/playTurnState.service";
import { DiscourseInfo } from "../shared/discourseInfo";
import { RPC_TO_MAIN } from "../rpcChannels";
import { Observable } from "rxjs";
import { NgClass, AsyncPipe } from "@angular/common";
import { GamePlayersComponent } from "./gamePlayers.component";

export const gameTitleFor = (game: Game): string => {
  let result = game.displayName;

  if (game.flags?.length) {
    result += ` (${game.flags
      .map(x => {
        switch (x) {
          case "CIV6_CONGRESS_TURN":
            return "CONGRESS TURN!";
          default:
            return x;
        }
      })
      .join(", ")})`;
  }

  return result;
};

@Component({
  selector: "pydt-game",
  templateUrl: "./game.component.html",
  styleUrls: ["./game.component.css"],
  imports: [NgClass, GamePlayersComponent, AsyncPipe],
})
export class GameComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private playTurnState = inject(PlayTurnState);
  private metadataLoader = inject(SafeMetadataLoader);

  @Input() game: Game;
  @Input() user: User;
  @Input() gamePlayerProfiles: SteamProfileMap;
  @Input() yourTurn: boolean;
  @Input() discoursePostNumber: number;
  @Output() smackRead = new EventEmitter<number>();
  updateDateHandle: NodeJS.Timeout;
  games: CivGame[] = [];
  lastTurnText$: Observable<string>;

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    const metadata = await this.metadataLoader.loadMetadata();

    if (metadata) {
      this.games = metadata.civGames;
    }

    this.lastTurnText$ = CountdownUtility.lastTurnOrTimerExpires$(this.game);
  }

  ngOnDestroy(): void {
    clearInterval(this.updateDateHandle);
  }

  get civGame(): CivGame {
    return this.games.find(x => x.id === this.game.gameType);
  }

  get gameTitle() {
    return gameTitleFor(this.game);
  }

  get playText() {
    let flagText = "";

    if (this.game.flags?.length) {
      flagText = `(${this.game.flags
        .map(x => {
          switch (x) {
            case "CIV6_CONGRESS_TURN":
              return "Congress";
            default:
              return x;
          }
        })
        .join(", ")}) `;
    }

    return `Play Your Damn ${flagText}Turn!`;
  }

  playTurn(): void {
    this.playTurnState.game = this.game;
    this.playTurnState.gameTitle = this.gameTitle;
    this.playTurnState.gamePlayerProfiles = this.gamePlayerProfiles;
    void this.router.navigate(["/playTurn"]);
  }

  openGameOnWeb(): void {
    window.pydtApi.ipc.send(RPC_TO_MAIN.OPEN_URL, `https://playyourdamnturn.com/game/${this.game.gameId}`);
  }

  readSmack(): void {
    window.pydtApi.ipc.send(
      RPC_TO_MAIN.OPEN_URL,
      `https://discourse.playyourdamnturn.com/t/${this.game.discourseTopicId}`,
    );
    this.smackRead.emit(this.game.latestDiscoursePostNumber);
  }

  get newDiscoursePost(): boolean {
    return DiscourseInfo.isNewSmackTalkPost(this.game, this.user, this.discoursePostNumber || 0);
  }
}
