import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth, type User, type UserCredential } from "firebase/auth";
import { auth } from "./firebase";
// Add these imports to your AuthContext.js
import { 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth";

type TAuthContext = {
    auth: Auth;
    user: User | null;
    login: (email: string, password: string) => Promise<UserCredential>;
    loginWithGoogle: () => Promise<UserCredential>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<TAuthContext | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sign In function for your Sales Managers
  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

    // Inside your AuthProvider function:
    function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    // Optional: Force account selection if they have multiple Google accounts
    provider.setCustomParameters({ prompt: 'select_account' });

    return signInWithPopup(auth, provider);
    }

  function logout() {
    return signOut(auth);
  }

  // Monitor auth state (persists login on refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ auth, user, login, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): TAuthContext => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};