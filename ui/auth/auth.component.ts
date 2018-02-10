import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../shared/authService';

@Component({
  selector: 'pydt-auth',
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  model = new AuthModel();

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    this.auth.storeToken(this.model.token)
      .then(() => {
        this.router.navigate(['/']);
      });
  }
}

class AuthModel {
  public token: string;
}
