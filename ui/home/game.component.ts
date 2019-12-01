import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import * as countdown from 'countdown';
import * as app from 'electron';
import { Game, GAMES, SteamProfileMap } from 'pydt-shared';
import { PlayTurnState } from '../playTurn/playTurnState.service';


@Component({
  selector: 'pydt-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit, OnDestroy {
  @Input() game: Game;
  @Input() gamePlayerProfiles: SteamProfileMap;
  @Input() yourTurn: boolean;
  @Input() discoursePostNumber: number;
  @Output() smackRead = new EventEmitter<number>();
  private now: Date;
  updateDateHandle: any;

  constructor(private router: Router, private playTurnState: PlayTurnState) { }

  ngOnInit() {
    // Save current date to prevent "changed after it was checked" bugs
    this.now = new Date();
    this.updateDateHandle = setInterval(() => this.now = new Date(), 30 * 1000);
  }

  ngOnDestroy() {
    clearInterval(this.updateDateHandle);
  }

  get civGame() {
    return GAMES.find(x => x.id === this.game.gameType);
  }

  playTurn() {
    this.playTurnState.game = this.game;
    this.playTurnState.gamePlayerProfiles = this.gamePlayerProfiles;
    this.router.navigate(['/playTurn']);
  }

  openGameOnWeb() {
    app.ipcRenderer.send('open-url', 'https://playyourdamnturn.com/game/' + this.game.gameId);
  }

  readSmack() {
    app.ipcRenderer.send('open-url', 'https://discourse.playyourdamnturn.com/t/' + this.game.discourseTopicId);
    this.smackRead.emit(this.game.latestDiscoursePostNumber);
  }

  get newDiscoursePost() {
    return this.game.latestDiscoursePostNumber && this.game.latestDiscoursePostNumber > (this.discoursePostNumber || 0);
  }

  get lastTurn() {
    const lastTurnDate: any = this.game.lastTurnEndDate || this.game.updatedAt;
    // tslint:disable-next-line:no-bitwise
    return countdown(Date.parse(lastTurnDate), this.now, countdown.HOURS | countdown.MINUTES);
  }

  get timerExpires() {
    const lastTurnDate: any = this.game.lastTurnEndDate || this.game.updatedAt;
    const expirationDate = new Date(Date.parse(lastTurnDate) + this.game.turnTimerMinutes * 60 * 1000);

    if (expirationDate.getTime() - this.now.getTime() < 0) {
      return 'soon...';
    }

    // tslint:disable-next-line:no-bitwise
    return 'in ' + countdown(this.now, expirationDate, countdown.HOURS | countdown.MINUTES);
  }
}
