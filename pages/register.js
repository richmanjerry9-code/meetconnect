import { useState } from "react";
import { useRouter } from "next/router";
import { db } from "../lib/firebase.js";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import bcrypt from "bcryptjs";

const Register = ({ setUser, setShowRegister }) => {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { name, email, password } = form;

      // ✅ 1. Validate inputs
      if (!name || !password) {
        alert("Name and password are required!");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }

      // ✅ 2. Check if email is already used
      if (email) {
        const q = query(collection(db, "profiles"), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          alert("Email already registered!");
          setLoading(false);
          return;
        }
      }

      // ✅ 3. Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 12);

      // ✅ 4. Create user object
      const newUser = {
        name,
        email: email || "",
        password: hashedPassword,
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

      // ✅ 5. Save user to Firestore
      const docRef = await addDoc(collection(db, "profiles"), newUser);
      const savedUser = { id: docRef.id, ...newUser };

      // ✅ 6. Save user locally
      localStorage.setItem("loggedInUser", JSON.stringify(savedUser));
      setUser(savedUser);
      setShowRegister(false);

      alert("✅ Registration successful!");
      router.push("/profile-setup");
    } catch (err) {
      console.error("Registration failed:", err);
      alert("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleRegister}
      className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-md"
    >
      <input
        type="text"
        placeholder="Full Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
        className="border border-gray-300 p-2 rounded-md"
      />

      <input
        type="email"
        placeholder="Email (optional)"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="border border-gray-300 p-2 rounded-md"
      />

      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
        className="border border-gray-300 p-2 rounded-md"
      />

      <button
        type="submit"
        disabled={loading}
        className={`p-2 rounded-md font-semibold ${
          loading
            ? "bg-gray-400 text-white"
            : "bg-pink-600 hover:bg-pink-700 text-white"
        }`}
      >
        {loading ? "Registering..." : "Register"}
      </button>

      <p className="text-xs text-gray-500 mt-2 text-center">
        MeetConnect is for adults (18+) only. Please use responsibly.
      </p>
    </form>
  );
};

export default Register;



