import { Injectable } from '@angular/core';
import { Game } from 'pydt-shared';

@Injectable()
export class PlayTurnState {
  public game: Game;
}
