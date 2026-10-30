import { z } from "zod";
import { isValidNewPassword, PASSWORD_REQUIREMENT } from "./account-credentials.mjs";

export const newPasswordSchema = z.string().refine(isValidNewPassword, PASSWORD_REQUIREMENT);

// Existing passwords remain verifiable, including those created before the
// new-password byte limit. Only newly chosen passwords use newPasswordSchema.
const currentPasswordSchema = z.string().min(1).max(20000);

export const passwordChangeSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: newPasswordSchema,
  })
  .strict();

export const accountDeleteSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    confirmation: z.literal("SUPPRIMER"),
    scope: z.enum(["data", "account"]),
  })
  .strict();
