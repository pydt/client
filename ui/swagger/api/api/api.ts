export * from './auth.service';
import { AuthService } from './auth.service';
export * from './game.service';
import { GameService } from './game.service';
export * from './user.service';
import { UserService } from './user.service';
export * from './webhook.service';
import { WebhookService } from './webhook.service';
export const APIS = [AuthService, GameService, UserService, WebhookService];
