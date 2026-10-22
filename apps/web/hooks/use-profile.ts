"use client";

import { useQuery } from "@tanstack/react-query";

export interface Profile {
  userId: string;
  ageBand: string;
  county: string | null;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const response = await fetch("/api/v1/me/profile");
      if (!response.ok) throw new Error("Failed to load profile");
      const body = (await response.json()) as { profile: Profile | null };
      return body.profile;
    },
  });
}
