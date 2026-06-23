import { Controller, Get, Headers, Inject, Ip, Param, Header } from '@nestjs/common';
import { CrmTrackingService } from './crm-tracking.service';
import { CrmTrackingTokenService } from './crm-tracking-token.service';

const transparentGif = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

@Controller('crm/tracking')
export class CrmTrackingController {
  constructor(
    @Inject(CrmTrackingService) private readonly trackingService: CrmTrackingService,
    @Inject(CrmTrackingTokenService) private readonly tokenService: CrmTrackingTokenService
  ) {}

  @Get('open/:token')
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-store, no-cache, max-age=0')
  async open(@Param('token') token: string, @Headers('user-agent') userAgent?: string, @Ip() ipAddress?: string) {
    const messageId = this.tokenService.verifyMessageToken(token);

    if (messageId) {
      await this.trackingService.recordEmailOpen({
        messageId,
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null
      });
    }

    return transparentGif;
  }
}
