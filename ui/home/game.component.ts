import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CivDef, CIV6_LEADERS, PcsProfileMap } from 'pydt-shared';
import { PlayTurnState } from '../playTurn/playTurnState.service';
import { Game, GamePlayer } from '../swagger/api';
import * as _ from 'lodash';
import * as countdown from 'countdown';
import * as app from 'electron';

@Component({
  selector: 'pydt-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  @Input() game: Game;
  @Input() gamePlayerProfiles: PcsProfileMap;
  @Input() yourTurn: boolean;
  gamePlayers: GamePlayer[] = [];
  civDefs: CivDef[] = [];
  private now: Date;

  constructor(private router: Router, private playTurnState: PlayTurnState) {}

  ngOnInit() {
    // Save current date to prevent "changed after it was checked" bugs
    this.now = new Date();

    for (let i = 0; i < this.game.slots; i++) {
      if (this.game.players.length > i) {
        this.gamePlayers.push(this.game.players[i]);
        this.civDefs.push(_.find(CIV6_LEADERS, leader => {
          return leader.leaderKey === this.game.players[i].civType;
        }));
      } else {
        this.gamePlayers.push(null);
        this.civDefs.push(null);
      }
    }
  }

  playTurn() {
    this.playTurnState.game = this.game;
    this.router.navigate(['/playTurn']);
  }

  openGameOnWeb() {
    app.ipcRenderer.send('opn-url', 'https://playyourdamnturn.com/game/' + this.game.gameId);
  }

  lastTurn() {
    // tslint:disable-next-line:no-bitwise
    return countdown(Date.parse(this.game.updatedAt as any), this.now, countdown.HOURS | countdown.MINUTES);
  }
}
