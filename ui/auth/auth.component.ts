import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { Router } from "@angular/router";
import { UserService } from "pydt-shared";
import { AuthService } from "../shared/authService";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FormsModule } from "@angular/forms";

class AuthModel {
  public token: string;
}

@Component({
  selector: "pydt-auth",
  templateUrl: "./auth.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TooltipDirective, FormsModule],
})
export class AuthComponent {
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);

  model = new AuthModel();
  authError = false;

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
