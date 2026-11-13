import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module';
import { ClipperController } from './clipper.controller';
import { ClipperService } from './clipper.service';

@Module({
  imports: [NotesModule],
  controllers: [ClipperController],
  providers: [ClipperService],
})
export class ClipperModule {}
