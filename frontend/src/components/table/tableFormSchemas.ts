import { z } from 'zod';
import { createZodResolver } from '../../utils/zodResolver';
import { extractYouTubeVideoId } from '../../utils/youtubeSync';

export const MAX_SOS_TOPIC_LENGTH = 80;
export const MAX_TABLE_CHAT_LENGTH = 200;

export const sosBannerSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập chủ đề cần hỗ trợ')
    .max(MAX_SOS_TOPIC_LENGTH, `Chủ đề tối đa ${MAX_SOS_TOPIC_LENGTH} ký tự`),
});
export type SosBannerFormValues = z.infer<typeof sosBannerSchema>;
export const sosBannerResolver = createZodResolver<SosBannerFormValues>(sosBannerSchema);

export const youtubeUrlSchema = z.object({
  url: z
    .string()
    .refine(
      (val) => Boolean(extractYouTubeVideoId(val)),
      'Link hoặc mã YouTube không hợp lệ (cần URL YouTube hoặc mã 11 ký tự).',
    ),
});
export type YouTubeUrlFormValues = z.infer<typeof youtubeUrlSchema>;
export const youtubeUrlResolver = createZodResolver<YouTubeUrlFormValues>(youtubeUrlSchema);

export const tableChatSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Tin nhắn không được để trống')
    .max(MAX_TABLE_CHAT_LENGTH, `Tin nhắn tối đa ${MAX_TABLE_CHAT_LENGTH} ký tự`),
});
export type TableChatFormValues = z.infer<typeof tableChatSchema>;
export const tableChatResolver = createZodResolver<TableChatFormValues>(tableChatSchema);
