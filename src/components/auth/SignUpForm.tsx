import React, { useEffect, useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { validateEmail, validateNewPassword, validateConfirmPassword, pluralizeZnak } from "@/lib/auth-validation";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset if navigation was blocked (network failure after submit)
  useEffect(() => {
    if (!isSubmitting) return;
    const timer = setTimeout(() => {
      setIsSubmitting(false);
    }, 15_000);
    return () => {
      clearTimeout(timer);
    };
  }, [isSubmitting]);

  function validate() {
    const next: typeof errors = {};
    const emailErr = validateEmail(email);
    if (emailErr) next.email = emailErr;
    const passwordErr = validateNewPassword(password, MIN_PASSWORD_LENGTH);
    if (passwordErr) next.password = passwordErr;
    const confirmErr = validateConfirmPassword(password, confirmPassword);
    if (confirmErr) next.confirmPassword = confirmErr;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
      return;
    }
    setIsSubmitting(true);
  }

  const passwordHint = (() => {
    if (errors.password || password.length === 0 || password.length >= MIN_PASSWORD_LENGTH) return undefined;
    const remaining = MIN_PASSWORD_LENGTH - password.length;
    return (
      <p className="mt-1 text-xs text-blue-100/50">
        Jeszcze {remaining} {pluralizeZnak(remaining)}
      </p>
    );
  })();

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label="Email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder="ty@example.com"
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label="Hasło"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder="Min. 6 znaków"
        autoComplete="new-password"
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label="Potwierdź hasło"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Powtórz hasło"
        autoComplete="new-password"
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pending={isSubmitting} pendingText="Tworzenie konta..." icon={<UserPlus className="size-4" />}>
        Utwórz konto
      </SubmitButton>
    </form>
  );
}
