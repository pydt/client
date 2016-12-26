import { Component, Input, OnInit } from '@angular/core';
import { Router }    from '@angular/router';
import { SteamProfile, Game, GamePlayer, CivDef, Civ6Leaders } from 'pydt-shared';
import * as _ from 'lodash';
import * as countdown from 'countdown';

@Component({
  selector: 'pydt-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  @Input() game: Game;
  @Input() gamePlayerProfiles: Map<String, SteamProfile>;
  @Input() yourTurn: boolean;
  private gamePlayers: GamePlayer[] = [];
  private civDefs: CivDef[] = [];

  constructor(private router: Router) {}

  ngOnInit() {
    for (let i = 0; i < this.game.slots; i++) {
      if (this.game.players.length > i && !this.game.players[i].hasSurrendered) {
        this.gamePlayers.push(this.game.players[i]);
        this.civDefs.push(_.find(Civ6Leaders, leader => {
          return leader.leaderKey === this.game.players[i].civType;
        }));
      } else {
        this.gamePlayers.push(null);
        this.civDefs.push(null);
      }
    }
  }

  playTurn(game) {
    this.router.navigate(['/playTurn/' + game.gameId]);
  }

  lastTurn() {
    return countdown(Date.parse(this.game.updatedAt), null, countdown.HOURS | countdown.MINUTES);
  }
}
