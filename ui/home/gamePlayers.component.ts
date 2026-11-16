import { Component, Input, OnInit, inject, ChangeDetectionStrategy } from "@angular/core";
import { CivDef, Game, GamePlayer, SteamProfileMap, CivGame, PydtSharedModule } from "pydt-shared";
import { SafeMetadataLoader } from "../shared/safeMetadataLoader";

@Component({
  selector: "pydt-game-players",
  templateUrl: "./gamePlayers.component.html",
  styleUrls: ["./gamePlayers.component.css"],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [PydtSharedModule],
})
export class GamePlayersComponent implements OnInit {
  private metadataLoader = inject(SafeMetadataLoader);

  @Input() game: Game;
  @Input() gamePlayerProfiles: SteamProfileMap;
  gamePlayers: GamePlayer[] = [];
  civDefs: CivDef[] = [];
  games: CivGame[];

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    const metadata = await this.metadataLoader.loadMetadata();

    if (metadata) {
      this.games = metadata.civGames;

      for (let i = 0; i < this.game.slots; i++) {
        if (this.game.players.length > i) {
          this.gamePlayers.push(this.game.players[i]);
          this.civDefs.push(this.civGame.leaders.find(leader => leader.leaderKey === this.game.players[i].civType));
        } else {
          this.gamePlayers.push(null);
          this.civDefs.push(null);
        }
      }
    }
  }

  get civGame(): CivGame {
    return this.games.find(x => x.id === this.game.gameType);
  }
}
