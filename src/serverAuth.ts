export type ServerAuthUser = {
  id: string;
  username: string;
  role: "admin" | "manager" | "operator" | "viewer";
  companyIds?: string[];
  factoryIds?: string[];
};
export type ServerSession = { token: string; expiresAt: string; user: ServerAuthUser; serverUrl: string };
const SESSION_KEY = "aximach.scheduler.session";
const AUTH_MODE_KEY = "aximach.scheduler.auth-mode";
const cleanUrl = (value: string) => value.trim().replace(/\/+$/, "");
export function getServerAuthMode(): "users" | "api-key" | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(AUTH_MODE_KEY);
  return value === "users" || value === "api-key" ? value : null;
}
export function setServerAuthMode(mode: "users" | "api-key") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_MODE_KEY, mode);
  window.dispatchEvent(new Event("aximach-server-session-updated"));
}
export function readServerSession(serverUrl?: string): ServerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServerSession>;
    if (typeof parsed.token !== "string" || parsed.token.length < 32 || typeof parsed.expiresAt !== "string" ||
        !parsed.user || typeof parsed.user.id !== "string" || typeof parsed.user.username !== "string" ||
        typeof parsed.user.role !== "string" || typeof parsed.serverUrl !== "string") return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (serverUrl && cleanUrl(parsed.serverUrl) !== cleanUrl(serverUrl)) return null;
    return parsed as ServerSession;
  } catch { return null; }
}
export function saveServerSession(session: Omit<ServerSession, "serverUrl">, serverUrl: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, serverUrl: cleanUrl(serverUrl) }));
  window.dispatchEvent(new Event("aximach-server-session-updated"));
}
export function clearServerSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("aximach-server-session-updated"));
}
export function getServerAuthHeaders(apiKey: string, serverUrl: string, tokenOverride?: string, requireUserSession?: boolean): Record<string, string> {
  const userMode = requireUserSession ?? getServerAuthMode() === "users";
  const token = tokenOverride || readServerSession(serverUrl)?.token;
  if (token) return { authorization: "Bearer " + token };
  if (userMode) return {};
  return apiKey ? { "x-aximach-key": apiKey } : {};
}
export function hasServerCredentials(apiKey: string, serverUrl: string): boolean {
  if (readServerSession(serverUrl)) return true;
  return getServerAuthMode() !== "users" && Boolean(apiKey);
}
