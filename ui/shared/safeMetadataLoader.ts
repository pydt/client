import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { MetadataCacheService, PydtMetadata } from "pydt-shared";

@Injectable()
export class SafeMetadataLoader {
  constructor(
    public metadataCache: MetadataCacheService,
    private router: Router,
  ) { }

  public async loadMetadata(): Promise<PydtMetadata> {
    try {
      return this.metadataCache.getCivGameMetadata();
    } catch {

      await this.router.navigateByUrl("/?errorLoading=true");
      return null;
    }
  }
}
