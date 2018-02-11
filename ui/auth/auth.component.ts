import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../shared/authService';
import { DefaultService } from '../swagger/api/index';

@Component({
  selector: 'pydt-auth',
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  model = new AuthModel();
  authError = false;

  constructor(
    private auth: AuthService,
    private api: DefaultService,
    private router: Router
  ) {}

  async onSubmit() {
    this.authError = false;
    await this.auth.storeToken(this.model.token);

    try {
      await this.api.userSteamProfile().toPromise();
      this.router.navigate(['/']);
    } catch (err) {
      console.log(err);
      this.auth.storeToken('');
      this.authError = true;
    }
  }
}

class AuthModel {
  public token: string;
}
