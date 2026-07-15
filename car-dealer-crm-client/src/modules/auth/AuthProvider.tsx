import { createContext, useContext, type PropsWithChildren } from "react";
import { authClient, clearBearerToken } from "./auth-client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
} | null;

type TAuthContext = {
  user: AuthUser;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<TAuthContext | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { data: session, isPending } = authClient.useSession();

  async function login(email: string, password: string) {
    const { error } = await authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message ?? "login_failed");
  }

  async function register(email: string, password: string, name: string) {
    const { error } = await authClient.signUp.email({ email, password, name });
    if (error) throw new Error(error.code ?? error.message ?? "register_failed");
  }

  async function logout() {
    await authClient.signOut();
    clearBearerToken();
  }

  const user: AuthUser = session?.user
    ? { id: session.user.id, email: session.user.email, name: session.user.name }
    : null;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {!isPending && children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): TAuthContext => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
