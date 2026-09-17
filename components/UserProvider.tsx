"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  getUser,
  getUserServerSnapshot,
  setUser as persistUser,
  clearUser,
  subscribeUser,
  type StoredUser,
} from "@/lib/storage";

interface UserContextValue {
  user: StoredUser | null;
  login: (user: StoredUser | null) => void;
  signOut: () => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribeUser, getUser, getUserServerSnapshot);

  const login = (nextUser: StoredUser | null) => {
    if (nextUser) persistUser(nextUser);
    else clearUser();
  };

  const signOut = () => {
    clearUser();
  };

  return <UserContext.Provider value={{ user, login, signOut }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de UserProvider");
  return ctx;
}
