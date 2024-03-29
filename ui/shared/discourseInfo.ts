import { isEmpty } from "lodash-es";
import { User, Game } from "pydt-shared";
import { RPC_INVOKE } from "../rpcChannels";
import { STORAGE_CONFIG } from "../storageConfig";

export class DiscourseInfo {
  [gameId: string]: number;

  static async getDiscourseInfo(): Promise<DiscourseInfo> {
    const di = await window.pydtApi.ipc.invoke(RPC_INVOKE.STORAGE_GET, STORAGE_CONFIG.DISCOURSE_INFO);

    const result = new DiscourseInfo();

    if (!isEmpty(di)) {
      Object.assign(result, di);
    }

    return result;
  }

  static saveDiscourseInfo(di: DiscourseInfo): Promise<void> {
    return window.pydtApi.ipc.invoke(RPC_INVOKE.STORAGE_SET, STORAGE_CONFIG.DISCOURSE_INFO, di);
  }

  static isNewSmackTalkPost(game: Game, user: User, readPostNumber: number): boolean {
    if (!game.latestDiscoursePostNumber || game.latestDiscoursePostNumber <= readPostNumber) {
      return false;
    }

    if (
      game.latestDiscoursePostUser === "system" ||
      game.latestDiscoursePostUser === (user.forumUsername || user.displayName)
    ) {
      return false;
    }

    return true;
  }
}
