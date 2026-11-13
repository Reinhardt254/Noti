import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  push(
    @Session() session: UserSession,
    @Body()
    body: {
      notes?: Array<{
        id: string;
        title: string;
        body: string;
        pinned: boolean;
        archived: boolean;
        isDaily: boolean;
        dailyDate: string | null;
        encrypted: boolean;
        createdAt: string;
        updatedAt: string;
        deletedAt: string | null;
      }>;
      tags?: Array<{
        id: string;
        name: string;
        color: string;
        createdAt: string;
        updatedAt: string;
        deletedAt: string | null;
      }>;
      templates?: Array<{
        id: string;
        name: string;
        body: string;
        createdAt: string;
        updatedAt: string;
        deletedAt: string | null;
      }>;
      reminders?: Array<{
        id: string;
        noteId: string;
        remindAt: string;
        notificationId: string | null;
        done: boolean;
        createdAt: string;
        updatedAt: string;
        deletedAt: string | null;
      }>;
    },
  ) {
    return this.sync.push(session.user.id, body);
  }

  @Get('pull')
  pull(@Session() session: UserSession, @Query('since') since = '0') {
    return this.sync.pull(session.user.id, Number(since) || 0);
  }
}
