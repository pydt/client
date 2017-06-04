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
      let playerName = 'AI';
      let profile = this.gamePlayerProfiles[this.player.steamId];

      if (profile && !this.player.hasSurrendered) {
        playerName = profile.personaname;
      }

      let civDesc = 'Unknown Civ';

      if (this.civDef) {
        civDesc = this.civDef.getFullDisplayName();
      }

      return `${playerName} /<br />${civDesc}`;
    } else {
      return 'AI';
    }
  }

  getProfileImg() {
    if (this.player && this.player.steamId && !this.player.hasSurrendered) {
      return (this.gamePlayerProfiles[this.player.steamId] || {}).avatarmedium;
    }

    return 'https://playyourdamnturn.com/img/android.png';
  }

  ngOnDestroy() {
    this.tooltip.hide();
  }
}
