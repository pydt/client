import { Component } from '@angular/core';
import { Router }    from '@angular/router';

import { ApiService } from 'pydt-shared';

@Component({
  selector: 'pydt-auth',
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  private model = new AuthModel();
  private busy: Promise<any>;

  constructor(private apiService: ApiService, private router: Router) {}

  onSubmit() {
    this.busy = this.apiService.setToken(this.model.token)
      .then(() => {
        this.router.navigate(['/']);
      });
  }
}

class AuthModel {
  public token: string;
}
