import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Router } from "@angular/router";
import { Game, SteamProfileMap, User, CivGame, CountdownUtility } from "pydt-shared";
import { SafeMetadataLoader } from "../shared/safeMetadataLoader";
import { PlayTurnState } from "../playTurn/playTurnState.service";
import { DiscourseInfo } from "../shared/discourseInfo";
import { RPC_TO_MAIN } from "../rpcChannels";

@Component({
  selector: "pydt-game",
  templateUrl: "./game.component.html",
  styleUrls: ["./game.component.css"],
})
export class GameComponent implements OnInit, OnDestroy {
  @Input() game: Game;
  @Input() user: User;
  @Input() gamePlayerProfiles: SteamProfileMap;
  @Input() yourTurn: boolean;
  @Input() discoursePostNumber: number;
  @Output() smackRead = new EventEmitter<number>();
  private now: Date;
  updateDateHandle: NodeJS.Timeout;
  games: CivGame[] = [];

  constructor(
    private router: Router,
    private playTurnState: PlayTurnState,
    private metadataLoader: SafeMetadataLoader,
  ) {}

  async ngOnInit(): Promise<void> {
    // Save current date to prevent "changed after it was checked" bugs
    this.now = new Date();
    this.updateDateHandle = setInterval(() => {
      this.now = new Date();
    }, 30 * 1000);

    const metadata = await this.metadataLoader.loadMetadata();

    if (metadata) {
      this.games = metadata.civGames;
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.updateDateHandle);
  }

  get civGame(): CivGame {
    return this.games.find(x => x.id === this.game.gameType);
  }

  playTurn(): void {
    this.playTurnState.game = this.game;
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

  get lastTurn(): string {
    const lastTurnDate = this.game.lastTurnEndDate || this.game.updatedAt;

    return CountdownUtility.countdownAgo(lastTurnDate, this.now);
  }

  get timerExpires(): string {
    const lastTurnDate = this.game.lastTurnEndDate || this.game.updatedAt;
    const expirationDate = new Date(lastTurnDate.getTime() + this.game.turnTimerMinutes * 60 * 1000);

    if (expirationDate.getTime() - this.now.getTime() < 0) {
      return "soon...";
    }

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `in ${CountdownUtility.countdown(this.now, expirationDate)}`;
  }
}
