import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BusyService } from 'pydt-shared';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class PydtHttpInterceptor implements HttpInterceptor {
  constructor(private busy: BusyService) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    this.busy.incrementBusy(true);

    return next.handle(req).pipe(finalize(() => {
      this.busy.incrementBusy(false);
    }));
  }
}
