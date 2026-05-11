# Supabase email templates

Brandowane templates HTML dla maili wychodzących z Supabase Auth.
Pliki tutaj są **referencyjne** — same templates konfiguruje się
w Supabase dashboard, nie w kodzie aplikacji.

## Dlaczego HTML osadzone, nie webfonty

- Większość klientów email (Gmail, Outlook, Apple Mail) **blokuje
  `<style>` w `<head>`** albo strippuje go. Wszystkie style muszą
  być inline.
- Webfonty (Fraunces, Outfit) **nie ładują się w mailach** — Gmail
  ignoruje `@font-face`, Outlook blokuje cross-origin fonts.
  Templates używają stack `Georgia, Times New Roman, serif` żeby
  zachować podobny Fraunces-feel dla headlinów.
- Layout przez `<table>` — Outlook (Windows) renderuje przez Word
  engine który nie wspiera flexa.
- Kolory branded inline: `#faf5ec` (cream tło), `#b8613a` (sienna
  primary), `#2b1810` (heading), `#5b3a24` (body), `#8a6747`
  (muted). Pojawiają się ~15 razy — szukaj-zamień jeśli zmienisz
  brand.

## Jak wkleić w Supabase

1. **Dashboard → Authentication → Email Templates**
2. Wybierz typ (Reset Password / Confirm signup / Magic Link)
3. Włącz toggle **Enable custom email** (jeśli nie był włączony)
4. **Subject** — wklej z poniższej tabeli
5. **Message (HTML)** — wklej zawartość odpowiedniego pliku `.html`
   z tego folderu
6. **Save**

Test: wyślij sobie magic link / reset z aplikacji (`/forgot-password`)
i sprawdź jak wygląda na realnym mailu (Gmail w przeglądarce + apka
na telefonie, najlepiej też Outlook jeśli ktoś z grupy go używa).

## Subject lines (polski)

| Template            | Plik                    | Subject                           |
| ------------------- | ----------------------- | --------------------------------- |
| Reset Password      | `reset-password.html`   | Reset hasła w PlaceMates          |
| Confirm Signup      | `confirm-signup.html`   | Potwierdź adres — PlaceMates      |
| Magic Link          | `magic-link.html`       | Twój link logowania — PlaceMates  |

## Variables Supabase

Templates używają tylko `{{ .ConfirmationURL }}` — magic link URL.
Inne dostępne (na razie nie używane):

- `{{ .Email }}` — adresat
- `{{ .SiteURL }}` — URL appki z dashboardu
- `{{ .Token }}` — surowy token (jeśli chcesz custom redirect logic)
- `{{ .TokenHash }}` — hash tokena
- `{{ .RedirectTo }}` — redirect URL z `resetPasswordForEmail()` calla

Pełna lista: https://supabase.com/docs/guides/auth/auth-email-templates

## Plain-text fallback

Supabase wysyła **automatycznie** plain-text wersję wygenerowaną
z HTML (strip tagów). Wystarcza dla większości klientów. Jeśli
kiedyś chcesz custom plain-text — toggle w dashboardzie jest
osobny dla każdego templatu.

## Edycja

Templates są zwykłym HTML — edytuj plik, podgląd np. w
`<https://htmlemail.io/inline>` (już zinlinowane CSS) albo
po prostu otwórz w przeglądarce. Brand colors są w 4-5 miejscach
per template, łatwo find-replace.

Po edycji: ponownie wklej do Supabase i `Save`.

## Testowanie wizualne

Supabase nie ma podglądu w dashboardzie. Najpewniejszy workflow:

1. Wklej template do Supabase
2. Wyślij reset / signup do testowego konta (np. siebie)
3. Otwórz w **Gmail web** (najpopularniejszy klient — jeśli tam
   wygląda OK to 90% inboxów dostanie sensownie)
4. Sprawdź też **Gmail mobile app** — czasem renderuje inaczej
   niż web (zwłaszcza dark mode)
5. Bonus: **mail-tester.com** — wyślij tam testowy mail, pokazuje
   problem renderingu + spam score
