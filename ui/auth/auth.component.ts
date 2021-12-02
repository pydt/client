import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from 'pydt-shared';
import { AuthService } from '../shared/authService';

@Component({
  selector: 'pydt-auth',
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  model = new AuthModel();
  authError = false;

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  async onSubmit() {
    this.authError = false;
    await this.auth.storeToken(this.model.token);

    try {
      await this.userService.steamProfile().toPromise();
      this.router.navigate(['/']);
    } catch (err) {
      console.error(err);
      this.auth.storeToken('');
      this.authError = true;
    }
  }
}

class AuthModel {
  public token: string;
}
