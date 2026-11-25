import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from '@pakhotels/db/schemas/media.schema';
import { StorageModule } from '@pakhotels/storage';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { ImagePipelineService } from './image-pipeline.service';
import { ImageAiService } from './image-ai.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    StorageModule,
  ],
  providers: [MediaService, ImagePipelineService, ImageAiService],
  controllers: [MediaController],
  // Exported so other modules (property, blog) can record an upload in the
  // library instead of writing a loose file nobody can find again.
  exports: [MediaService, ImagePipelineService, ImageAiService],
})
export class MediaModule {}
