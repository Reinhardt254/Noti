import { Body, Controller, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ClipperService } from './clipper.service';

@Controller('clipper')
export class ClipperController {
  constructor(private readonly clipper: ClipperService) {}

  @Post()
  clip(@Session() session: UserSession, @Body() body: { url: string }) {
    return this.clipper.clip(session.user.id, body.url);
  }
}
