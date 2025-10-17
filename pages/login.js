import React, { useState } from "react";
import { useRouter } from "next/router";
import { db } from "../lib/firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function Login() {
  const router = useRouter();
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    const { email, password } = loginForm;

    try {
      if (!email || !password) {
        alert("Please enter your email/username and password!");
        return;
      }

      // ✅ Check by email or username
      const usersRef = collection(db, "profiles");
      const emailQuery = query(usersRef, where("email", "==", email));
      const usernameQuery = query(usersRef, where("username", "==", email));

      const [emailSnap, usernameSnap] = await Promise.all([
        getDocs(emailQuery),
        getDocs(usernameQuery),
      ]);

      const foundDoc =
        !emailSnap.empty
          ? emailSnap.docs[0]
          : !usernameSnap.empty
          ? usernameSnap.docs[0]
          : null;

      if (!foundDoc) {
        alert("User not found!");
        return;
      }

      const user = { id: foundDoc.id, ...foundDoc.data() };

      if (user.password !== password) {
        alert("Incorrect password!");
        return;
      }

      localStorage.setItem("loggedInUser", JSON.stringify(user));
      alert("✅ Login successful!");

      if (!user.area || !user.phone) router.push("/profile-setup");
      else router.push("/");
    } catch (error) {
      console.error("Login failed:", error);
      alert("Error logging in!");
    }
  };

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Poppins, sans-serif",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 30,
          borderRadius: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          maxWidth: 400,
          width: "100%",
        }}
      >
        <h2 style={{ color: "#e91e63", textAlign: "center" }}>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Email or Username"
            value={loginForm.email}
            onChange={(e) =>
              setLoginForm({ ...loginForm, email: e.target.value })
            }
            style={{
              width: "100%",
              padding: 10,
              margin: "10px 0",
              borderRadius: 8,
              border: "1px solid #e91e63",
            }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) =>
              setLoginForm({ ...loginForm, password: e.target.value })
            }
            style={{
              width: "100%",
              padding: 10,
              margin: "10px 0",
              borderRadius: 8,
              border: "1px solid #e91e63",
            }}
            required
          />
          <button
            type="submit"
            style={{
              background: "#e91e63",
              color: "#fff",
              padding: "8px 15px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}




