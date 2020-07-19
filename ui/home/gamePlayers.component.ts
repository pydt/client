import { Component, Input, OnInit } from '@angular/core';
import { CivDef, Game, GamePlayer, SteamProfileMap, MetadataCacheService, CivGame } from 'pydt-shared';


@Component({
    selector: 'pydt-game-players',
    templateUrl: './gamePlayers.component.html',
    styleUrls: ['./gamePlayers.component.css']
})

export class GamePlayersComponent implements OnInit {
    @Input() game: Game;
    @Input() gamePlayerProfiles: SteamProfileMap;
    gamePlayers: GamePlayer[] = [];
    civDefs: CivDef[] = [];
    games: CivGame[];

    constructor(private metadataCache: MetadataCacheService) {
    }

    async ngOnInit() {
        this.games = (await this.metadataCache.getCivGameMetadata()).civGames;

        for (let i = 0; i < this.game.slots; i++) {
            if (this.game.players.length > i) {
                this.gamePlayers.push(this.game.players[i]);
                this.civDefs.push(this.civGame.leaders.find(leader => {
                    return leader.leaderKey === this.game.players[i].civType;
                }));
            } else {
                this.gamePlayers.push(null);
                this.civDefs.push(null);
            }
        }
    }

    get civGame() {
        return this.games.find(x => x.id === this.game.gameType);
    }
}
