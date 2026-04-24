import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { getUserProfile, isFirestorePermissionError, isFirestoreSetupError } from "@/services/firestoreService";
import type { UserProfile } from "@/lib/models";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (u: UserProfile | null) => void;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  setUser: () => {},
  refetch: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true); // Always set loading to true when state changes
      try {
        if (!firebaseUser) {
          setUser(null);
          return;
        }
        const profile = await getUserProfile(firebaseUser.uid, {
          name: firebaseUser.displayName,
          email: firebaseUser.email,
        });
        setUser(profile);
      } catch (error) {
        if (!isFirestoreSetupError(error) && !isFirestorePermissionError(error)) {
          throw error;
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, [refreshKey]);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, refetch: () => setRefreshKey((value) => value + 1) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
