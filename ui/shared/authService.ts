import { Injectable } from "@angular/core";
import { Configuration, User, UserService } from "pydt-shared";
import { RPC_INVOKE, RPC_TO_MAIN } from "../rpcChannels";

export class ConfigData {
  token: string;
  allTokens?: {
    name: string;
    token: string;
  }[];
}

@Injectable()
export class AuthService {
  private user: User;

  constructor(private readonly apiConfig: Configuration, private readonly userService: UserService) {}

  async isAuthenticated(): Promise<boolean> {
    await this.setApiConfig();
    return !!this.apiConfig.apiKeys.Authorization;
  }

  async getUser(force: boolean): Promise<User> {
    if (!this.user || force) {
      try {
        this.user = await this.userService.getCurrent().toPromise();
        const config = await this.getConfig();

        AuthService.validateAllTokens(config);

        const tokenData = (config.allTokens || []).find(x => x.token === config.token);

        if (tokenData && tokenData.name !== this.user.displayName) {
          tokenData.name = this.user.displayName;
          await this.setConfig(config);
        }

        window.pydtApi.ipc.send(RPC_TO_MAIN.UPDATE_USERS, null);
      } catch {
        /* Ignore error, we'll try again later... */
      }
    }

    return this.user;
  }

  async storeToken(token: string): Promise<void> {
    const config = {
      ...(await this.getConfig()),
      token,
    };

    AuthService.validateAllTokens(config);

    this.user = null;

    await this.setConfig(config);

    return this.setApiConfig();
  }

  private static validateAllTokens(config: ConfigData) {
    if (config.token && !(config.allTokens || []).some(x => x.token === config.token)) {
      config.allTokens = [
        ...(config.allTokens || []),
        {
          name: `User ${(config.allTokens || []).length + 1}`,
          token: config.token,
        },
      ];
    }
  }

  private setApiConfig(): Promise<void> {
    return this.getConfig().then(config => {
      this.apiConfig.apiKeys = { Authorization: config ? config.token : null };
    });
  }

  private getConfig(): Promise<ConfigData> {
    return window.pydtApi.ipc.invoke(RPC_INVOKE.STORAGE_GET, "configData");
  }

  private setConfig(config: ConfigData): Promise<void> {
    return window.pydtApi.ipc.invoke(RPC_INVOKE.STORAGE_SET, "configData", config);
  }
}
