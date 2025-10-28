import styles from '../styles/Home.module.css';
import Modal from './Modal';

export function LoginForm({ showLogin, setShowLogin, loginForm, setLoginForm, handleLogin, authError }) {
  if (!showLogin) return null;
  return (
    <Modal title="Login" onClose={() => setShowLogin(false)}>
      <form onSubmit={handleLogin}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          placeholder="Email"
          value={loginForm.email}
          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          className={styles.input}
          required
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          placeholder="Password"
          value={loginForm.password}
          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          className={styles.input}
          required
        />
        {authError && <p className={styles.error}>{authError}</p>}
        <button type="submit" className={styles.button}>Login</button>
      </form>
    </Modal>
  );
}

export function RegisterForm({ showRegister, setShowRegister, registerForm, setRegisterForm, handleRegister, authError }) {
  if (!showRegister) return null;
  return (
    <Modal title="Register" onClose={() => setShowRegister(false)}>
      <form onSubmit={handleRegister}>
        <label htmlFor="reg-name">Full Name</label>
        <input
          id="reg-name"
          type="text"
          placeholder="Full Name"
          value={registerForm.name}
          onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
          className={styles.input}
          required
        />
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          placeholder="Email"
          value={registerForm.email}
          onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
          className={styles.input}
          required
        />
        <label htmlFor="reg-password">Password</label>
        <input
          id="reg-password"
          type="password"
          placeholder="Password"
          value={registerForm.password}
          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
          className={styles.input}
          required
          minLength={8}
        />
        {authError && <p className={styles.error}>{authError}</p>}
        <button type="submit" className={styles.button}>Register</button>
      </form>
    </Modal>
  );
}
