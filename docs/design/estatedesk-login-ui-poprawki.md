# EstateDesk — input dla modelu kodującego

## Cel

Przerób ekran logowania EstateDesk na bardziej profesjonalny, nowoczesny ekran typu premium SaaS/CRM. Aktualny widok jest zbyt płaski, ma dużo pustej przestrzeni i formularz wygląda jak placeholder. Docelowo ekran ma być spójny z ciemnym dashboardem aplikacji: głęboki navy background, subtelne niebiesko-indygowe glow, delikatna siatka/pattern, glassmorphism card dla formularza i dopracowana typografia.

## Zakres zmian

Zmień przede wszystkim:

1. tło całej strony logowania,
2. lewą sekcję hero,
3. prawą sekcję formularza,
4. inputy,
5. przycisk logowania,
6. spacing i hierarchię wizualną.

Nie zmieniaj logiki logowania. To jest zadanie UI/styling.

---

## Docelowy layout

Ekran powinien zostać w układzie dwukolumnowym:

- lewa kolumna: branding + hero copy + lista benefitów,
- prawa kolumna: karta logowania.

Zachowaj teksty po polsku:

- `EstateDesk`
- `Twój panel nieruchomości.`
- `Kompletne narzędzia dla agenta nieruchomości — od onboardingu właściciela po zamknięcie transakcji.`
- `Zarządzanie ofertami i cyklem życia`
- `Kolekcja dokumentów z checklistą`
- `Kalkulator prowizji agenta`
- `Zaloguj się`
- `Wprowadź dane, aby kontynuować`
- `EMAIL`
- `HASŁO`
- `ty@example.com`
- `Twoje hasło`
- `Zapomniałeś hasła?`
- `Nie masz konta? Zarejestruj się`

---

## Główne założenia wizualne

Design powinien wyglądać jak dopracowany produkt SaaS:

- ciemny, elegancki background,
- subtelne niebieskie/indygowe światła,
- delikatny grid/pattern na tle,
- glassmorphism na karcie logowania,
- mocny kontrast tekstów,
- nowoczesna typografia,
- większy nacisk na brandowy niebiesko-indygowy przycisk,
- mniej płaskości, więcej głębi.

Unikaj przeładowania grafikami. To ma nadal wyglądać jak realny ekran logowania aplikacji webowej, nie jak landing page z dużą ilustracją.

---

## CSS — tło całej strony

Zastąp obecny płaski background bardziej rozbudowanym tłem:

```css
.auth-page {
  min-height: 100vh;
  color: #f8fafc;
  background:
    radial-gradient(circle at 18% 35%, rgba(37, 99, 235, 0.20), transparent 32%),
    radial-gradient(circle at 72% 24%, rgba(99, 102, 241, 0.12), transparent 28%),
    radial-gradient(circle at 50% 100%, rgba(14, 165, 233, 0.08), transparent 36%),
    linear-gradient(135deg, #07111f 0%, #0b1423 48%, #111827 100%);
  background-attachment: fixed;
}
```

Jeżeli projekt używa klasy `.bg-cosmic`, można ją rozszerzyć lub zastąpić:

```css
.bg-cosmic {
  background:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
    radial-gradient(circle at 20% 10%, rgba(37, 99, 235, 0.20), transparent 28%),
    radial-gradient(circle at 85% 15%, rgba(79, 70, 229, 0.16), transparent 32%),
    radial-gradient(circle at 55% 100%, rgba(14, 165, 233, 0.08), transparent 40%),
    linear-gradient(180deg, #070b14 0%, #0b1020 45%, #080c16 100%);
  background-size:
    32px 32px,
    32px 32px,
    auto,
    auto,
    auto,
    auto;
  background-attachment: fixed;
}
```

---

## Lewa sekcja hero

Lewa strona nie powinna być jednolitą pustą przestrzenią. Dodaj subtelne efekty wizualne: grid, glow i delikatne fale/łuki, ale bez przesady.

```css
.auth-hero {
  position: relative;
  overflow: hidden;
}

.auth-hero::before {
  content: "";
  position: absolute;
  width: 560px;
  height: 560px;
  left: -160px;
  top: 18%;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.22), transparent 68%);
  filter: blur(8px);
  pointer-events: none;
}

.auth-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 36px 36px;
  mask-image: linear-gradient(to right, black, transparent 72%);
  pointer-events: none;
}
```

Ważne: content w lewej sekcji musi mieć wyższy `z-index` niż pseudo-elementy.

```css
.auth-hero-content {
  position: relative;
  z-index: 1;
}
```

### Badge nad headline

Dodaj lub wystyluj mały badge nad głównym nagłówkiem:

```css
.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 999px;
  color: #c7d2fe;
  background: rgba(15, 23, 42, 0.52);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  backdrop-filter: blur(12px);
}
```

### Headline

Nagłówek powinien być duży, mocny, premium:

```css
.auth-title {
  max-width: 680px;
  font-size: clamp(48px, 5.8vw, 92px);
  line-height: 0.98;
  letter-spacing: -0.055em;
  font-weight: 800;
  color: #f8fafc;
}
```

### Opis

```css
.auth-description {
  max-width: 560px;
  color: #a8b3c7;
  font-size: 18px;
  line-height: 1.7;
}
```

### Lista benefitów

```css
.auth-benefits {
  display: grid;
  gap: 16px;
}

.auth-benefit {
  display: flex;
  align-items: center;
  gap: 14px;
  color: #dbeafe;
  font-size: 15px;
}

.auth-benefit-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #93c5fd;
  background: rgba(37, 99, 235, 0.18);
  border: 1px solid rgba(96, 165, 250, 0.22);
  box-shadow: 0 0 24px rgba(37, 99, 235, 0.20);
}
```

---

## Prawa sekcja i karta logowania

Prawa kolumna może być odrobinę ciemniejsza, ale formularz powinien siedzieć w wyraźnej, dopracowanej karcie.

```css
.auth-panel {
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.62));
  border-left: 1px solid rgba(148, 163, 184, 0.12);
  backdrop-filter: blur(18px);
  box-shadow: -24px 0 80px rgba(0, 0, 0, 0.22);
}
```

Karta formularza:

```css
.login-card {
  width: 100%;
  max-width: 520px;
  padding: 56px;
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.56);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(20px);
}
```

Dla mniejszych ekranów zmniejsz padding:

```css
@media (max-width: 768px) {
  .login-card {
    max-width: 100%;
    padding: 32px;
    border-radius: 22px;
  }
}
```

---

## Typografia formularza

```css
.login-title {
  color: #f8fafc;
  font-size: clamp(32px, 3vw, 44px);
  line-height: 1.05;
  letter-spacing: -0.04em;
  font-weight: 800;
}

.login-subtitle {
  margin-top: 10px;
  color: #94a3b8;
  font-size: 16px;
}

.auth-label {
  display: block;
  margin-bottom: 10px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
```

---

## Inputy

Inputy powinny być ciemne, nowoczesne, z cienką ramką i delikatnym focusem.

```css
.auth-input-wrap {
  position: relative;
}

.auth-input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
}

.auth-input-action {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
}

.auth-input {
  width: 100%;
  height: 58px;
  padding: 0 48px;
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.28);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: #f8fafc;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.auth-input::placeholder {
  color: #64748b;
}

.auth-input:focus {
  border-color: rgba(96, 165, 250, 0.72);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.16);
  background: rgba(2, 6, 23, 0.42);
}
```

---

## Linki

```css
.auth-link {
  color: #60a5fa;
  font-weight: 600;
  text-decoration: none;
  transition: color 160ms ease;
}

.auth-link:hover {
  color: #93c5fd;
}
```

---

## Przycisk logowania

Zamień biały button na brandowy gradient blue/indigo.

```css
.auth-button {
  width: 100%;
  height: 60px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
  color: white;
  font-weight: 800;
  font-size: 16px;
  box-shadow: 0 14px 36px rgba(37, 99, 235, 0.32);
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
}

.auth-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 44px rgba(37, 99, 235, 0.42);
  filter: brightness(1.05);
}

.auth-button:active {
  transform: translateY(0);
}
```

---

## Przykładowa struktura JSX/HTML

Dostosuj nazwy komponentów i klasy do aktualnego stacka projektu.

```tsx
export function LoginPage() {
  return (
    <main className="auth-page grid min-h-screen lg:grid-cols-[1.35fr_0.85fr]">
      <section className="auth-hero flex min-h-screen flex-col justify-between px-10 py-10 lg:px-16">
        <div className="auth-hero-content flex items-center gap-3">
          <div className="brand-icon">{/* home icon */}</div>
          <span className="font-bold text-white">EstateDesk</span>
        </div>

        <div className="auth-hero-content max-w-3xl">
          <div className="auth-badge mb-8">
            {/* small chart/building icon */}
            <span>Kompletny system dla agentów nieruchomości</span>
          </div>

          <h1 className="auth-title">Twój panel nieruchomości.</h1>

          <p className="auth-description mt-8">
            Kompletne narzędzia dla agenta nieruchomości — od onboardingu właściciela po zamknięcie transakcji.
          </p>
        </div>

        <div className="auth-hero-content auth-benefits">
          <div className="auth-benefit">
            <span className="auth-benefit-icon">✓</span>
            <span>Zarządzanie ofertami i cyklem życia</span>
          </div>
          <div className="auth-benefit">
            <span className="auth-benefit-icon">✓</span>
            <span>Kolekcja dokumentów z checklistą</span>
          </div>
          <div className="auth-benefit">
            <span className="auth-benefit-icon">✓</span>
            <span>Kalkulator prowizji agenta</span>
          </div>
        </div>
      </section>

      <section className="auth-panel flex min-h-screen items-center justify-center px-8 py-10">
        <form className="login-card">
          <h2 className="login-title">Zaloguj się</h2>
          <p className="login-subtitle">Wprowadź dane, aby kontynuować</p>

          <div className="mt-12">
            <label className="auth-label" htmlFor="email">EMAIL</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">{/* mail icon */}</span>
              <input id="email" className="auth-input" type="email" placeholder="ty@example.com" />
            </div>
          </div>

          <div className="mt-7">
            <label className="auth-label" htmlFor="password">HASŁO</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">{/* lock icon */}</span>
              <input id="password" className="auth-input" type="password" placeholder="Twoje hasło" />
              <button type="button" className="auth-input-action" aria-label="Pokaż hasło">
                {/* eye icon */}
              </button>
            </div>
          </div>

          <div className="mt-4 text-right">
            <a className="auth-link" href="/forgot-password">Zapomniałeś hasła?</a>
          </div>

          <button className="auth-button mt-9" type="submit">Zaloguj się</button>

          <p className="mt-7 text-center text-sm text-slate-400">
            Nie masz konta? <a className="auth-link" href="/register">Zarejestruj się</a>
          </p>
        </form>
      </section>
    </main>
  );
}
```

---

## Responsywność

Na desktopie użyj dwóch kolumn.

Na mobile:

- układ powinien przejść na jedną kolumnę,
- można ukryć lub skrócić dolną listę benefitów,
- karta logowania powinna mieć mniejszy padding,
- hero nie powinno zajmować pełnej wysokości ekranu przed formularzem.

Przykład:

```css
@media (max-width: 1024px) {
  .auth-page {
    display: block;
  }

  .auth-hero {
    min-height: auto;
    padding: 32px 24px 40px;
  }

  .auth-panel {
    min-height: auto;
    padding: 24px;
    border-left: 0;
    background: transparent;
    box-shadow: none;
  }

  .auth-title {
    font-size: clamp(42px, 12vw, 64px);
  }
}
```

---

## Kryteria akceptacji

Gotowy ekran powinien spełniać poniższe warunki:

- wygląda jak dopracowany ekran logowania premium SaaS,
- zachowuje ciemny styl EstateDesk,
- formularz znajduje się w wyraźnej glassmorphism karcie,
- button logowania jest gradientowy blue/indigo, nie biały,
- tło ma subtelny grid i glow, ale nie odwraca uwagi,
- teksty są czytelne i mają dobry kontrast,
- układ działa dobrze na desktopie i mobile,
- nie zmienia się logika aplikacji, tylko UI/styling.

---

## Opcjonalne drobne poprawki

Jeżeli masz czas, dodaj:

- bardzo delikatną animację `hover` dla karty lub buttona,
- focus-visible dla linków i przycisków,
- `prefers-reduced-motion` dla użytkowników ograniczających animacje,
- delikatny gradient border na karcie logowania.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```
