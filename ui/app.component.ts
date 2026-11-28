import { Component, NgZone, OnInit, ViewChild, TemplateRef, inject, ChangeDetectionStrategy } from "@angular/core";
import { BsModalRef, BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { BusyComponent, CivGame, GameStore } from "pydt-shared";
import { FormsModule } from "@angular/forms";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { ScrollTabsDirective } from "./shared/scrollTabs.directive";
import {
  CIV6_GAME_ID,
  isCiv6HotSeatAutoStartExtraBeta,
  PydtSettingsData,
  PydtSettingsFactory,
} from "./shared/pydtSettings";
import { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } from "./rpcChannels";
import { setTheme } from "ngx-bootstrap/utils";
import { SafeMetadataLoader } from "./shared/safeMetadataLoader";
import { AuthService } from "./shared/authService";
import { UpdateService } from "./shared/updateService";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";

@Component({
  selector: "pydt-app",
  templateUrl: "./app.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormsModule, RouterOutlet, TabsetComponent, TabDirective, ScrollTabsDirective, BusyComponent],
})
export class AppComponent implements OnInit {
  private zone = inject(NgZone);
  private metadataLoader = inject(SafeMetadataLoader);
  private modalService = inject(BsModalService);
  private pydtSettingsFactory = inject(PydtSettingsFactory);
  private authService = inject(AuthService);
  private updateService = inject(UpdateService);
  private router = inject(Router);

  readonly CIV6_GAME_ID = CIV6_GAME_ID;
  readonly civ6HotSeatAutoStartExtraBeta = isCiv6HotSeatAutoStartExtraBeta();
  version: string;
  newVersion: string;
  settings: PydtSettingsData;
  autoPlayEnabled = false;
  // Ask about starting on boot at most once per run (see maybeAskStartOnBoot)
  private startOnBootAsked = false;

  @ViewChild("aboutModal", { static: true }) aboutModal: TemplateRef<unknown>;
  @ViewChild("updateModal", { static: true }) updateModal: TemplateRef<unknown>;
  @ViewChild("settingsModal", { static: true }) settingsModal: TemplateRef<unknown>;
  @ViewChild("startOnBootModal", { static: true }) startOnBootModal: TemplateRef<unknown>;
  openModal: BsModalRef;
  civGames: CivGame[];

  constructor() {
    setTheme("bs5");
  }

  ngOnInit(): void {
    const modalOptions: ModalOptions = {
      class: "modal-near-fullscreen",
    };

    void this.refreshAutoPlayEnabled();

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.SHOW_ABOUT_MODAL, data => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.version = data;
        this.openModal = this.modalService.show(this.aboutModal, modalOptions);
      });
    });

    window.pydtApi.ipc.receive(RPC_TO_RENDERER.SHOW_SETTINGS_MODAL, () => {
      void this.pydtSettingsFactory.getSettings().then(settings => {
        void this.zone.run(async () => {
          const metadata = await this.metadataLoader.loadMetadata();

          if (metadata) {
            this.civGames = metadata.civGames;
            this.hideOpenModal();
            this.settings = settings;
            this.openModal = this.modalService.show(this.settingsModal, modalOptions);
          }
        });
      });
    });

    this.updateService.listen();

    this.updateService.showModal$.subscribe(version => {
      this.zone.run(() => {
        this.hideOpenModal();
        this.newVersion = version;
        this.openModal = this.modalService.show(this.updateModal, modalOptions);
      });
    });

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.SET_USER, token => {
      this.zone.run(() => {
        this.hideOpenModal();
        void this.authService.storeToken(token).then(() => this.router.navigate(["/"]));
      });
    });

    // Ask once the signed-in game list shows
    this.router.events.pipe(filter(e => e instanceof NavigationEnd && e.urlAfterRedirects === "/")).subscribe(() => {
      void this.maybeAskStartOnBoot();
    });

    window.pydtApi.ipc.receive<string>(RPC_TO_RENDERER.NEW_USER, () => {
      this.zone.run(() => {
        this.hideOpenModal();
        void this.router.navigate(["/auth"]);
      });
    });
  }

  // On a fresh install (nothing saved yet), ask whether to start on boot (forum #5360). Either answer
  // saves the settings, so it's only asked once; it stays in Settings as "Start client on boot".
  private async maybeAskStartOnBoot(): Promise<void> {
    // Not signed in yet: a fresh install passes through the game list on its way to sign-in,
    // which would close the pop-up. Signing in comes back here.
    if (this.startOnBootAsked || !(await this.authService.isAuthenticated())) {
      return;
    }

    const settings = await this.pydtSettingsFactory.getSettings();

    if (!settings.isNew) {
      this.startOnBootAsked = true;
      return;
    }

    this.zone.run(() => {
      // Don't cover another pop-up (an update, say); try again the next time the game list shows
      if (this.openModal || this.startOnBootAsked) {
        return;
      }

      this.startOnBootAsked = true;
      this.settings = settings;
      this.openModal = this.modalService.show(this.startOnBootModal);
    });
  }

  async answerStartOnBoot(startOnBoot: boolean): Promise<void> {
    this.settings.startOnBoot = startOnBoot;
    await this.settings.save();
    window.pydtApi.setAutostart(startOnBoot);
    this.pydtSettingsFactory.settingsChanged$.next();
    this.hideOpenModal();
  }

  private async refreshAutoPlayEnabled(): Promise<void> {
    const settings = await this.pydtSettingsFactory.getSettings();
    this.autoPlayEnabled = settings.autoPlay;

    // Linux AppImage: refresh the start-on-boot entry so it points at this copy of the app (setAutostart
    // rewrites it there). Linux only: on macOS even checking the entry goes through AppleScript, which
    // can ask the user for permission.
    if (settings.startOnBoot && window.pydtApi.platform === "linux") {
      window.pydtApi.setAutostart(true);
    }
  }

  openReleaseNotes(): void {
    window.pydtApi.ipc.send(RPC_TO_MAIN.OPEN_URL, `https://github.com/pydt/client/releases/tag/v${this.version}`);
  }

  gameStoreOptions(civGame: CivGame): { key: string; value: string }[] {
    return Object.keys(GameStore)
      .filter(x => !!civGame.dataPaths[GameStore[x] as string])
      .map(key => ({
        key,
        value: GameStore[key] as string,
      }));
  }

  hideOpenModal(): void {
    if (this.openModal) {
      this.openModal.hide();
    }

    this.openModal = null;
  }

  async openDirectoryDialog(civGame: CivGame): Promise<void> {
    const filePath = await window.pydtApi.ipc.invoke<string>(
      RPC_INVOKE.SHOW_OPEN_DIALOG,
      this.settings.getSavePath(civGame),
    );

    if (filePath) {
      this.settings.setSavePath(civGame, filePath);
    }
  }

  async saveSettings(): Promise<void> {
    await this.settings.save();
    window.pydtApi.setAutostart(this.settings.startOnBoot);
    await this.revertIntroSkipIfDisabled();
    await this.revertCiv6AutostartIfDisabled();
    window.pydtApi.ipc.send(RPC_TO_MAIN.SET_TURN_API_ENABLED, {
      enabled: this.settings.turnApiEnabled,
      port: this.settings.turnApiPort,
    });
    this.autoPlayEnabled = this.settings.autoPlay;
    this.pydtSettingsFactory.settingsChanged$.next();
    this.hideOpenModal();
  }

  // Turn the intro video back on
  private async revertIntroSkipIfDisabled(): Promise<void> {
    const civ6 = this.civGames?.find(x => x.id === CIV6_GAME_ID);

    if (!civ6 || this.settings.shouldSkipCiv6Intro(civ6)) {
      return;
    }

    const result = await window.pydtApi.ipc.invoke<{ ok: boolean; message: string }>(
      RPC_INVOKE.CIV6_INTRO_SKIP_REVERT,
      {
        dataPath: this.settings.getDefaultDataPath(civ6),
      },
    );

    if (!result?.ok) {
      window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_ERROR, `Could not restore Civ 6 intro video: ${result?.message}`);
    }
  }

  // Uninstall the Civ6 autostart when not needed
  private async revertCiv6AutostartIfDisabled(): Promise<void> {
    const civ6 = this.civGames?.find(x => x.id === CIV6_GAME_ID);

    if (!civ6 || this.settings.shouldHotSeatAutoStartCiv6(civ6)) {
      return;
    }

    const result = await window.pydtApi.ipc.invoke<{ ok: boolean; message: string }>(RPC_INVOKE.CIV6_AUTOSTART_REVERT, {
      dataPath: this.settings.getDefaultDataPath(civ6),
      waitForExit: true,
    });

    if (!result?.ok) {
      window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_ERROR, `Could not revert Civ 6 autostart: ${result?.message}`);
    }
  }

  async applyUpdate(): Promise<void> {
    await this.updateService.applyUpdate();
  }
}
