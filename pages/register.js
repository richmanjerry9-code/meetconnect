import { useState } from "react";
import { useRouter } from "next/router";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const Register = ({ setUser, setShowRegister }) => {
  const router = useRouter();
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { name, email, password } = registerForm;

      // ✅ 1. Validate
      if (!name || !password) {
        alert("Name and password are required!");
        setLoading(false);
        return;
      }

      // ✅ 2. Check for duplicate email if provided
      if (email) {
        const q = query(collection(db, "profiles"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          alert("Email already registered!");
          setLoading(false);
          return;
        }
      }

      // ✅ 3. Add user to Firestore
      const newUser = {
        name,
        email: email || "",
        password,
        username: name.toLowerCase().replace(/\s+/g, "_"),
        role: "User",
        membership: "Regular",
        phone: "",
        gender: "",
        age: "",
        nationality: "",
        county: "",
        ward: "",
        area: "",
        nearby: [],
        services: [],
        profilePic: "",
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "profiles"), newUser);
      const savedUser = { id: docRef.id, ...newUser };

      // ✅ 4. Save locally for session
      localStorage.setItem("loggedInUser", JSON.stringify(savedUser));
      setUser(savedUser);
      setShowRegister(false);

      alert("✅ Registration successful!");
      router.push("/profile-setup");
    } catch (error) {
      console.error("Registration failed:", error);
      alert("Error during registration. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleRegister}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <input
        type="text"
        placeholder="Full Name"
        value={registerForm.name}
        onChange={(e) =>
          setRegisterForm({ ...registerForm, name: e.target.value })
        }
        required
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={registerForm.email}
        onChange={(e) =>
          setRegisterForm({ ...registerForm, email: e.target.value })
        }
      />
      <input
        type="password"
        placeholder="Password"
        value={registerForm.password}
        onChange={(e) =>
          setRegisterForm({ ...registerForm, password: e.target.value })
        }
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Registering..." : "Register"}
      </button>
    </form>
  );
};

export default Register;






