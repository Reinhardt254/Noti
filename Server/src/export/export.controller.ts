import { Controller, Get, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ExportService } from './export.service';

@Controller('export')
export class ExportController {
  constructor(private readonly exporter: ExportService) {}

  @Get()
  export(
    @Session() session: UserSession,
    @Query('format') format: 'json' | 'markdown' = 'json',
  ) {
    if (format === 'markdown') {
      return this.exporter.toMarkdownBundle(session.user.id);
    }
    return this.exporter.toJson(session.user.id);
  }
}
