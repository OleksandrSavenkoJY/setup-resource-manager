"use client";

import { useEffect, useState } from "react";
import { fetchMe, type CurrentUser } from "@/lib/api";

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    fetchMe().then(setUser).catch(() => setUser(null));
  }, []);
  return user;
}
