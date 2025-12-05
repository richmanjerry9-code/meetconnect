return (
  <div
    style={{
      padding: 20,
      fontFamily: 'Poppins, sans-serif',
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f7f7f7',
    }}
  >
    <div
      style={{
        background: '#fff',
        padding: 30,
        borderRadius: 10,
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
        maxWidth: 400,
        width: '100%',
      }}
    >
      <h2 style={{ color: '#e91e63', textAlign: 'center' }}>Login</h2>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={loginForm.email}
          onChange={(e) =>
            setLoginForm({ ...loginForm, email: e.target.value })
          }
          style={{
            width: '100%',
            padding: 10,
            margin: '10px 0',
            borderRadius: 8,
            border: '1px solid #e91e63',
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
            width: '100%',
            padding: 10,
            margin: '10px 0',
            borderRadius: 8,
            border: '1px solid #e91e63',
          }}
          required
        />

        {/* ✅ LOGIN BUTTON */}
        <button
          type="submit"
          style={{
            background: '#e91e63',
            color: '#fff',
            padding: '10px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            marginTop: 10,
          }}
        >
          Login
        </button>
      </form>

      {/* ✅ REGISTER BUTTON */}
      <button
        onClick={() => router.push('/register')}
        style={{
          background: 'transparent',
          color: '#e91e63',
          padding: '10px',
          borderRadius: 8,
          border: '1px solid #e91e63',
          cursor: 'pointer',
          width: '100%',
          marginTop: 12,
        }}
      >
        Create New Account
      </button>
    </div>
  </div>
);


