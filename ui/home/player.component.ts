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
  isMouseOver = false;

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

  get imgSrc() {
    if (this.isMouseOver) {
      const image = this.civDef ? this.civDef.getImageFileName() : 'RANDOM_RANDOM.png';
      return `https://playyourdamnturn.com/img/civs/${image}`;
    }

    if (this.player && this.player.steamId && !this.player.hasSurrendered) {
      return (this.gamePlayerProfiles[this.player.steamId] || {} as PcsSteamProfile).avatarmedium;
    }

    return 'https://playyourdamnturn.com/img/android.png';
  }

  iconMouseOver() {
    this.isMouseOver = true;
  }

  iconMouseOut() {
    this.isMouseOver = false;
  }

  ngOnDestroy() {
    this.tooltip.hide();
  }
}
