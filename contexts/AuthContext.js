// contexts/AuthContext.js
"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      setUser(authUser || null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = (email, password) =>
    auth.signInWithEmailAndPassword(email, password);

  const signOut = () => auth.signOut();

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

