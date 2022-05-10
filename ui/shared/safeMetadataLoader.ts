import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { MetadataCacheService, PydtMetadata } from "pydt-shared";

@Injectable()
export class SafeMetadataLoader {
  constructor(
    public metadataCache: MetadataCacheService,
    private router: Router,
  ) { }

  count = 0;

  public async loadMetadata(): Promise<PydtMetadata> {
    try {
      this.count++;
      if (this.count > 20) {
        throw new Error("wat");
      }

      return this.metadataCache.getCivGameMetadata();
    } catch {

      await this.router.navigateByUrl("/?errorLoading=true");
      return null;
    }
  }
}
