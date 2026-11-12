import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import { createZodResolver } from './zodResolver';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_UTF8_BYTES = 72;

export const localUpgradeSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập địa chỉ email')
      .email('Email không đúng định dạng')
      .max(255, 'Email tối đa 255 ký tự')
      .transform((val) => val.toLowerCase()),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, 'Mật khẩu phải có ít nhất 8 ký tự')
      .refine(
        (val) => new TextEncoder().encode(val).length <= PASSWORD_MAX_UTF8_BYTES,
        'Mật khẩu tối đa 72 byte UTF-8',
      ),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type LocalUpgradeFormValues = z.infer<typeof localUpgradeSchema>;

const baseResolver = createZodResolver<LocalUpgradeFormValues>(localUpgradeSchema);

export const localUpgradeResolver: Resolver<LocalUpgradeFormValues> = async (
  values,
  context,
  options,
) => {
  const result = await baseResolver(values, context, options);
  if (
    Object.keys(result.errors).length > 0 &&
    !result.errors.confirmPassword &&
    values.password !== values.confirmPassword
  ) {
    result.errors.confirmPassword = {
      type: 'custom',
      message: 'Mật khẩu xác nhận không khớp',
    };
  }
  return result;
};
