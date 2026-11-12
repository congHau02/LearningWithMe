import { z } from 'zod';
import { createZodResolver } from './zodResolver';

const PASSWORD_MAX_UTF8_BYTES = 72;

export const localLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập địa chỉ email')
    .email('Email không đúng định dạng')
    .max(255, 'Email tối đa 255 ký tự')
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu')
    .refine(
      (val) => val.trim().length > 0,
      'Vui lòng nhập mật khẩu',
    )
    .refine(
      (val) => new TextEncoder().encode(val).length <= PASSWORD_MAX_UTF8_BYTES,
      'Mật khẩu tối đa 72 byte UTF-8',
    ),
});

export type LocalLoginFormValues = z.infer<typeof localLoginSchema>;

export const localLoginResolver = createZodResolver<LocalLoginFormValues>(localLoginSchema);
