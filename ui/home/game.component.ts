import { Component, Input, OnInit } from '@angular/core';
import { Router }    from '@angular/router';
import { SteamProfile, Game } from 'civx-angular2-shared';

const POLL_INTERVAL: number = 60 * 1000;
const TOAST_INTERVAL: number = 14.5 * 60 * 1000;

@Component({
  selector: 'game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  @Input() game: Game;
  @Input() gamePlayerProfiles: Map<String, SteamProfile>;
  @Input() yourTurn: boolean;
  private iconGridCells: number;

  constructor(private router: Router) {}

  ngOnInit() {
    this.iconGridCells = Math.floor(12 / this.game.players.length);

    if (this.iconGridCells < 1) {
      this.iconGridCells = 1;
    }
  }

  playTurn(game) {
    this.router.navigate(['/playTurn/' + game.gameId]);
  }
}
