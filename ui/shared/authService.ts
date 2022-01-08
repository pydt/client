import { Injectable } from "@angular/core";
import { Configuration, User, UserService } from "pydt-shared";
import { RPC_INVOKE } from "../rpcChannels";

export class ConfigData {
  token: string;
}

@Injectable()
export class AuthService {
  private user: User;

  constructor(
    private readonly apiConfig: Configuration,
    private readonly userService: UserService,
  ) {}

  async isAuthenticated(): Promise<boolean> {
    await this.setApiConfig();
    return !!this.apiConfig.apiKeys.Authorization;
  }

  async getUser(force: boolean): Promise<User> {
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
      token,
    };

    if (!token) {
      this.user = null;
    }

    await window.pydtApi.ipc.invoke(
      RPC_INVOKE.STORAGE_SET,
      "configData",
      config,
    );

    return this.setApiConfig();
  }

  private setApiConfig(): Promise<void> {
    return this.getConfig().then(config => {
      this.apiConfig.apiKeys = { Authorization: config ? config.token : null };
    });
  }

  private getConfig(): Promise<ConfigData> {
    return window.pydtApi.ipc.invoke(RPC_INVOKE.STORAGE_GET, "configData");
  }
}
