import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(
    @Session() session: UserSession,
    @Query('archived') archived?: string,
    @Query('q') q?: string,
  ) {
    return this.notes.list(session.user.id, {
      archived: archived === 'true',
      q,
    });
  }

  @Get('tags')
  tags(@Session() session: UserSession) {
    return this.notes.listTags(session.user.id);
  }

  @Get('graph')
  graph(@Session() session: UserSession) {
    return this.notes.graph(session.user.id);
  }

  @Get(':id')
  get(@Session() session: UserSession, @Param('id') id: string) {
    return this.notes.get(session.user.id, id);
  }

  @Get(':id/backlinks')
  backlinks(@Session() session: UserSession, @Param('id') id: string) {
    return this.notes.backlinks(session.user.id, id);
  }

  @Get(':id/versions')
  versions(@Session() session: UserSession, @Param('id') id: string) {
    return this.notes.versions(session.user.id, id);
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Body()
    body: {
      id?: string;
      title?: string;
      body?: string;
      pinned?: boolean;
      archived?: boolean;
      isDaily?: boolean;
      dailyDate?: string | null;
      encrypted?: boolean;
      tags?: string[];
    },
  ) {
    return this.notes.create(session.user.id, body).then(async (note) => {
      if (body.body) {
        await this.notes.rebuildLinks(session.user.id, note.id, body.body);
      }
      if (body.tags) {
        await this.notes.syncTags(session.user.id, note.id, body.tags);
      }
      return note;
    });
  }

  @Patch(':id')
  async update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      body?: string;
      pinned?: boolean;
      archived?: boolean;
      encrypted?: boolean;
      tags?: string[];
    },
  ) {
    const note = await this.notes.update(session.user.id, id, body);
    if (body.body !== undefined) {
      await this.notes.rebuildLinks(session.user.id, id, body.body);
    }
    if (body.tags) {
      await this.notes.syncTags(session.user.id, id, body.tags);
    }
    return note;
  }

  @Post(':id/versions/:versionId/restore')
  restore(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.notes.restoreVersion(session.user.id, id, versionId);
  }

  @Delete(':id')
  remove(@Session() session: UserSession, @Param('id') id: string) {
    return this.notes.softDelete(session.user.id, id);
  }
}
