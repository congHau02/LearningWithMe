import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';

export function createZodResolver<TFieldValues extends FieldValues>(
  schema: ZodTypeAny,
): Resolver<TFieldValues> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as TFieldValues, errors: {} };
    }

    const errors: FieldErrors<TFieldValues> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof TFieldValues | undefined;
      if (field && !errors[field]) {
        errors[field] = {
          type: issue.code,
          message: issue.message,
        } as FieldErrors<TFieldValues>[keyof TFieldValues];
      }
    }
    return { values: {}, errors };
  };
}
