import { Injectable } from '@nestjs/common';
import { loadAppConfig } from './app-config.loader';

@Injectable()
export class AppConfigService {
  /** Immutable snapshot of env-backed app config at service construction time. */
  readonly config = loadAppConfig();
}
