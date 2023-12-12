import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { UserService } from "pydt-shared";
import { AuthService } from "../shared/authService";

class AuthModel {
  public token: string;
}

@Component({
  selector: "pydt-auth",
  templateUrl: "./auth.component.html",
})
export class AuthComponent {
  model = new AuthModel();
  authError = false;

  constructor(
    private auth: AuthService,
    private userService: UserService,
    private router: Router,
  ) {}

  async onSubmit(): Promise<void> {
    this.authError = false;
    await this.auth.storeToken(this.model.token);

    try {
      await this.userService.steamProfile().toPromise();
      await this.router.navigate(["/"]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      await this.auth.storeToken("");
      this.authError = true;
    }
  }
}
