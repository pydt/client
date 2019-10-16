import { Component, Input, OnInit } from '@angular/core';
import { CivDef, GAMES, Game, GamePlayer, SteamProfileMap } from 'pydt-shared';


@Component({
    selector: 'pydt-game-players',
    templateUrl: './game.players.html',
    styleUrls: ['./game.players.css']
})

export class GamePlayers implements OnInit {
    @Input() game: Game;
    @Input() gamePlayerProfiles: SteamProfileMap;
    gamePlayers: GamePlayer[] = [];
    civDefs: CivDef[] = [];

    ngOnInit() {
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
        return GAMES.find(x => x.id === this.game.gameType);
    }
}