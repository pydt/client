import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './home/home.component';
import { AuthComponent } from './auth/auth.component';
import { PlayTurnComponent } from './playTurn/playTurn.component';

const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'auth', component: AuthComponent },
  { path: 'playTurn', component: PlayTurnComponent }
];

export const routing = RouterModule.forRoot(routes, { useHash: true, relativeLinkResolution: 'legacy' });
