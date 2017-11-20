import { Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { CivDef, PcsProfileMap, PcsSteamProfile } from 'pydt-shared';
import { Game, GamePlayer } from '../swagger/api';

@Component({
  selector: 'pydt-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class GamePlayerComponent implements OnDestroy {
  @Input() game: Game;
  @Input() player: GamePlayer;
  @Input() gamePlayerProfiles: PcsProfileMap;
  @Input() civDef: CivDef;
  @ViewChild('tooltip') tooltip: any;

  getTooltip() {
    if (this.player) {
      const profile = this.gamePlayerProfiles[this.player.steamId];
      let playerName = 'AI';

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
      return (this.gamePlayerProfiles[this.player.steamId] || {} as PcsSteamProfile).avatarmedium;
    }

    return 'https://playyourdamnturn.com/img/android.png';
  }

  ngOnDestroy() {
    this.tooltip.hide();
  }
}
