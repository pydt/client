import { Injectable } from "@angular/core";
import { Game, SteamProfileMap } from "pydt-shared";

@Injectable()
export class PlayTurnState {
  public game: Game;
  public gameTitle: string;
  public gamePlayerProfiles: SteamProfileMap;
}
