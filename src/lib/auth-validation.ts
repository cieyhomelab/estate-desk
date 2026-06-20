export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email jest wymagany";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Podaj poprawny adres email";
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Hasło jest wymagane";
  return undefined;
}

export function validateNewPassword(password: string, minLength: number): string | undefined {
  if (!password) return "Hasło jest wymagane";
  if (password.length < minLength) return `Hasło musi mieć co najmniej ${minLength} znaków`;
  return undefined;
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) return "Potwierdź swoje hasło";
  if (password !== confirmPassword) return "Hasła się nie zgadzają";
  return undefined;
}

// Polish has three plural forms: 1 znak, 2-4 znaki, 5+ znaków
export function pluralizeZnak(count: number): string {
  if (count === 1) return "znak";
  if (count <= 4) return "znaki";
  return "znaków";
}
