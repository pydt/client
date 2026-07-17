import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject } from "rxjs";
import { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } from "../rpcChannels";

@Injectable({ providedIn: "root" })
export class UpdateService {
  readonly newVersion$ = new BehaviorSubject<string | null>(null);
  readonly showModal$ = new Subject<string>();
  private listening = false;

  listen(): void {
    if (this.listening) {
      return;
    }

    this.listening = true;

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.SHOW_UPDATE_MODAL, version => {
      const isNewVersion = version !== this.newVersion$.value;

      this.newVersion$.next(version);

      // Only auto-pop the modal the first time a given version is seen, so a periodic
      // recheck of an already-downloaded update doesn't nag mid-turn.
      if (isNewVersion) {
        this.showModal$.next(version);
      }
    });
  }

  promptForUpdate(): void {
    if (this.newVersion$.value) {
      this.showModal$.next(this.newVersion$.value);
    }
  }

  async applyUpdate(): Promise<void> {
    await window.pydtApi.ipc.invoke(RPC_INVOKE.SET_FORCE_QUIT, true);
    window.pydtApi.ipc.send(RPC_TO_MAIN.APPLY_UPDATE, null);
  }
}
