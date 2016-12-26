import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { SteamProfile, Game, GamePlayer, CivDef } from 'pydt-shared';

@Component({
  selector: 'pydt-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class GamePlayerComponent implements OnDestroy {
  @Input() game: Game;
  @Input() player: GamePlayer;
  @Input() gamePlayerProfiles: Map<String, SteamProfile>;
  @Input() civDef: CivDef;
  @ViewChild('tooltip') tooltip: any;

  getTooltip() {
    if (this.player) {
      let playerName = '?';
      let profile = this.gamePlayerProfiles[this.player.steamId];

      if (profile) {
        playerName = profile.personaname;
      }

      return `${playerName} /<br />${this.civDef.getFullDisplayName()}`;
    } else {
      return 'AI';
    }
  }

  ngOnDestroy() {
    this.tooltip.hide();
  }
}
