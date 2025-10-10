import { useState } from "react";
import { useRouter } from "next/router";

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
      // 1️⃣ Send registration data to /api/users
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to register user");
        setLoading(false);
        return;
      }

      // 2️⃣ Create a blank profile for the user
      const profileRes = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.email,
          name: registerForm.name,
          profilePic: "",
          phone: "",
          county: "",
          area: "",
          services: [],
          nearby: [],
        }),
      });

      const profileData = await profileRes.json();

      if (!profileRes.ok) {
        alert(profileData.message || "Profile creation failed");
        setLoading(false);
        return;
      }

      // 3️⃣ Save the logged-in user locally
      const loggedInUser = { ...data.user, profile: profileData.profile };
      localStorage.setItem("loggedInUser", JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      setShowRegister(false);

      // 4️⃣ Redirect to profile creation page
      router.push("/create-profile");
    } catch (error) {
      console.error("Registration failed:", error);
      alert("Error connecting to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister}>
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
        placeholder="Email Address"
        value={registerForm.email}
        onChange={(e) =>
          setRegisterForm({ ...registerForm, email: e.target.value })
        }
        required
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



