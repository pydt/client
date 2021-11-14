import { Injectable } from "@angular/core";
import { Configuration, User, UserService } from "pydt-shared";
import rpcChannels from "../rpcChannels";

@Injectable()
export class AuthService {
  private user: User;

  constructor(
    private readonly apiConfig: Configuration,
    private readonly userService: UserService
  ) {}

  async isAuthenticated() {
    await this.setApiConfig();
    return !!this.apiConfig.apiKeys.Authorization;
  }

  async getUser(force: boolean) {
    if (!this.user || force) {
      try {
        this.user = await this.userService.getCurrent().toPromise();
      } catch {
        /* Ignore error, we'll try again later... */
      }
    }

    return this.user;
  }

  async storeToken(token: string): Promise<void> {
    const config = {
      token: token,
    };

    if (!token) {
      this.user = null;
    }

    await window.pydtApi.ipc.invoke(
      rpcChannels.STORAGE_SET,
      "configData",
      config
    );
    
    return this.setApiConfig();
  }

  private setApiConfig() {
    return this.getConfig().then((config) => {
      this.apiConfig.apiKeys = { Authorization: config ? config.token : null };
    });
  }

  private getConfig(): Promise<any> {
    return window.pydtApi.ipc.invoke(rpcChannels.STORAGE_GET, "configData");
  }
}
