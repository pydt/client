import { isEmpty } from "lodash";
import { User, Game } from "pydt-shared";
import rpcChannels from "../rpcChannels";

export class DiscourseInfo {
  [gameId: string]: number;

  static async getDiscourseInfo(): Promise<DiscourseInfo> {
    const di = await window.pydtApi.ipc.invoke(
      rpcChannels.STORAGE_GET,
      "discourseInfo"
    );

    const result = new DiscourseInfo();

    if (!isEmpty(di)) {
      Object.assign(result, di);
    }

    return result;
  }

  static saveDiscourseInfo(di: DiscourseInfo): Promise<void> {
    return window.pydtApi.ipc.invoke(rpcChannels.STORAGE_SET, 'discourseInfo', di);
  }

  static isNewSmackTalkPost(game: Game, user: User, readPostNumber: number) {
    if (
      !game.latestDiscoursePostNumber ||
      game.latestDiscoursePostNumber <= readPostNumber
    ) {
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
