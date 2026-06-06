import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./AuthForm.module.css";

type Mode = "signin" | "signup";

interface Props {
  serverError?: string;
  defaultMode?: Mode;
}

const MIN_PASSWORD = 6;

export default function AuthForm({ serverError, defaultMode = "signin" }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const next: Record<string, string> = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Podaj poprawny adres e-mail";
    }
    if (!password) {
      next.password = "Hasło jest wymagane";
    } else if (mode === "signup" && password.length < MIN_PASSWORD) {
      next.password = `Hasło musi mieć min. ${MIN_PASSWORD} znaków`;
    }
    if (mode === "signup") {
      if (!confirmPassword) {
        next.confirmPassword = "Potwierdź hasło";
      } else if (password !== confirmPassword) {
        next.confirmPassword = "Hasła się nie zgadzają";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    if (!validate()) e.preventDefault();
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      return Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field));
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
  }

  const isSignIn = mode === "signin";

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{isSignIn ? "Zaloguj się" : "Utwórz konto"}</h1>
      <p className={styles.subheading}>
        {isSignIn ? "Wprowadź dane, aby kontynuować" : "Dołącz do EstateDesk i zacznij działać"}
      </p>

      <form
        method="POST"
        action={isSignIn ? "/api/auth/signin" : "/api/auth/signup"}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className={styles.fieldGroup}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError("email");
              }}
              placeholder="ty@example.com"
              className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
              autoComplete="email"
            />
          </div>
          {errors.email && <p className={styles.errorText}>{errors.email}</p>}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="password" className={styles.label}>
            Hasło
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
              }}
              placeholder={isSignIn ? "Twoje hasło" : "Min. 6 znaków"}
              className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
              autoComplete={isSignIn ? "current-password" : "new-password"}
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => {
                setShowPassword(!showPassword);
              }}
              aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className={styles.errorText}>{errors.password}</p>}
          {isSignIn && !errors.password && (
            <div className={styles.forgotRow}>
              <a href="/auth/reset-password" className={styles.link}>
                Zapomniałeś hasła?
              </a>
            </div>
          )}
        </div>

        {!isSignIn && (
          <div className={styles.fieldGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Potwierdź hasło
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearError("confirmPassword");
                }}
                placeholder="Powtórz hasło"
                className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ""}`}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => {
                  setShowConfirm(!showConfirm);
                }}
                aria-label={showConfirm ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className={styles.errorText}>{errors.confirmPassword}</p>}
          </div>
        )}

        {serverError && <p className={styles.serverError}>{serverError}</p>}

        <button type="submit" className={styles.submitBtn}>
          {isSignIn ? "Zaloguj się" : "Utwórz konto"}
        </button>
      </form>

      <p className={styles.switchRow}>
        {isSignIn ? "Nie masz konta? " : "Masz już konto? "}
        <button
          type="button"
          className={styles.switchBtn}
          onClick={() => {
            switchMode(isSignIn ? "signup" : "signin");
          }}
        >
          {isSignIn ? "Zarejestruj się" : "Zaloguj się"}
        </button>
      </p>
    </div>
  );
}
