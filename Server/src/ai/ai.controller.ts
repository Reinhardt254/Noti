import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { AiService } from './ai.service';

@Controller('ai')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('summarize/:noteId')
  summarize(
    @Session() session: UserSession,
    @Param('noteId') noteId: string,
  ) {
    return this.ai.summarize(session.user.id, noteId);
  }

  @Post('summarize/:noteId/stream')
  async summarizeStream(
    @Session() session: UserSession,
    @Param('noteId') noteId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    for await (const token of this.ai.summarizeStream(session.user.id, noteId)) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }

  @Post('suggest-tags/:noteId')
  suggestTags(
    @Session() session: UserSession,
    @Param('noteId') noteId: string,
  ) {
    return this.ai.suggestTags(session.user.id, noteId);
  }

  @Post('ask')
  async ask(
    @Session() session: UserSession,
    @Body() body: { question: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    for await (const line of this.ai.askStream(
      session.user.id,
      body.question ?? '',
    )) {
      res.write(`data: ${line}\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
