// ===== lib/storage.ts — helpers de localStorage =====

export interface StoredUser {
  name: string;
}

const USER_KEY = "av_user";

// Cache + suscripción para exponer la sesión vía useSyncExternalStore,
// evitando el parpadeo de hidratación de leer localStorage en un efecto.
type Listener = () => void;
const userListeners = new Set<Listener>();
let cachedRaw: string | null = null;
let cachedUser: StoredUser | null = null;

function readUser(): StoredUser | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(USER_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedUser = raw ? JSON.parse(raw) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

function notifyUserListeners(): void {
  userListeners.forEach((listener) => listener());
}

export function subscribeUser(listener: Listener): () => void {
  userListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    userListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function getUser(): StoredUser | null {
  return readUser();
}

export function getUserServerSnapshot(): StoredUser | null {
  return null;
}

export function setUser(user: StoredUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
  notifyUserListeners();
}

export function clearUser(): void {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {}
  notifyUserListeners();
}
