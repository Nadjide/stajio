import type { UserProfile } from "../types/models";
import { isCalendarDate } from "./internship";

/** Restoring an account before onboarding must return to profile setup. */
export function isProfileComplete(profile: Partial<UserProfile> | null | undefined): profile is UserProfile {
  return (
    !!profile &&
    [profile.uid, profile.email, profile.displayName, profile.school, profile.degree, profile.company].every(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) &&
    isCalendarDate(profile.internshipStart) &&
    isCalendarDate(profile.internshipEnd) &&
    profile.internshipEnd >= profile.internshipStart
  );
}
