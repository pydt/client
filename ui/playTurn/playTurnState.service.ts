import { Injectable } from '@angular/core';
import { Game } from '../swagger/api';

@Injectable()
export class PlayTurnState {
  public game: Game;
}
