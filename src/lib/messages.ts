export const messages: Record<string, string> = {
  "blad-zapisu": "Nie udało się zapisać. Spróbuj ponownie.",
  "blad-serwera": "Błąd serwera. Spróbuj ponownie.",
  "cena-nieprawidlowa": "Cena musi być liczbą większą od zera z co najwyżej dwoma miejscami po przecinku.",
  "prowizja-nieprawidlowa": "Prowizja musi być liczbą większą od zera i nie większą niż 100%.",
  "stawki-nieprawidlowe": "Stawki muszą być liczbami z zakresu 0–100.",
  "juz-zamknieta": "Ogłoszenie jest już zamknięte.",
  "brakujace-dokumenty": "Przed zamknięciem uzupełnij wymagane dokumenty.",
  "nieprawidlowa-nazwa": "Nieprawidłowa nazwa dokumentu.",
  "blad-usuniecia": "Wystąpił błąd podczas usuwania. Spróbuj ponownie.",
  "blad-konfiguracji": "Błąd konfiguracji. Skontaktuj się z administratorem.",
  "blad-ladowania": "Błąd podczas ładowania danych.",
  "nazwa-wymagana": "Imię i nazwisko jest wymagane.",
  "rola-nieprawidlowa": "Wybrana rola jest nieprawidłowa.",
  "transakcja-zamknieta": "Nie można zmienić prowizji — transakcja jest już zamknięta.",
};

const FALLBACK = "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";

export function getFlashMessage(slug: string): string {
  return messages[slug] ?? FALLBACK;
}
