import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useState } from "react";
import "./login.css";

type Mode = "login" | "register";

export function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/listings");
    } catch {
      setError("Невірний email або пароль.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, name);
      // After registration user is logged in but pending — ProtectedRoute will show pending screen
      navigate("/listings");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Цей email вже зареєстровано.");
      } else if (err.code === "auth/weak-password") {
        setError("Пароль повинен містити не менше 6 символів.");
      } else {
        setError("Помилка реєстрації. Спробуйте ще раз.");
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="login-page">
      <header className="login-header">
        <img src="/logo.png" className="header-logo" alt="Royal Auto Club" />
      </header>

      <div className="login-body">
        <div className="login-card">
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === "login" ? "login-tab-active" : ""}`}
              onClick={() => switchMode("login")}
            >
              Вхід
            </button>
            <button
              className={`login-tab ${mode === "register" ? "login-tab-active" : ""}`}
              onClick={() => switchMode("register")}
            >
              Реєстрація
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label>Електронна пошта</label>
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="login-field">
                <label>Пароль</label>
                <input type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Вхід..." : "Увійти"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="login-field">
                <label>Ім'я</label>
                <input type="text" placeholder="Ваше ім'я" value={name}
                  onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="login-field">
                <label>Електронна пошта</label>
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="login-field">
                <label>Пароль</label>
                <input type="password" placeholder="Мінімум 6 символів" value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Реєстрація..." : "Зареєструватись"}
              </button>
              <p className="login-hint">
                Після реєстрації ваш акаунт буде активовано адміністратором.
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
