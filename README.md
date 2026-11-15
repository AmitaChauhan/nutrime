# NutriMe

One personal app with two pages:

- **NutriMe Kitchen**: snap your ingredients, see the nutrition, get balanced portions and a recipe.
- **NutriMe Health**: log what you ate, check in on how you feel, and see which foods suit you.
  The Android app also reads steps, sleep, resting heart rate and weight from Health Connect.

Your meal log, check-ins and health data stay on your phone. Only photos (and, if you ask, summary
numbers) go to the AI through your own website.

## What's in here

| Folder | What it is |
|---|---|
| `web/index.html` | The landing page at https://nutrime.nl/ |
| `web/app/` | The app itself at https://nutrime.nl/app/ (also the inside of the Android app) |
| `netlify/functions/ai.mjs` | Your private AI connection at `/api/ai`. Holds the OpenRouter key on Netlify |
| `android/` | The Android app (Capacitor), built automatically by GitHub |
| `.github/workflows/android.yml` | Builds the Android app file on every push |

## 1. Website (Netlify)

On a computer with Node.js installed, in this folder:

    npx netlify-cli login
    npx netlify-cli deploy --prod

Pick your existing NutriMe site. Check you're on the new version: https://nutrime.nl/ shows the landing page,
and https://nutrime.nl/app/ shows Kitchen, Move and Health on the bottom bar, with "NutriMe version 1.4" at the
bottom of the Kitchen page. If you installed the app before, opening the old home-screen icon takes you to
/app/ automatically. For the best result, remove the old icon and add the app again from https://nutrime.nl/app/. In Netlify, under Site configuration > Environment variables, keep
(or add) `OPENROUTER_API_KEY`, `APP_PASSCODE` and optionally `OPENROUTER_MODEL`
(default `anthropic/claude-haiku-4.5`). Check it works at `https://YOUR-SITE/api/ai`
(it should say `"server":true,"ready":true`).

## 2. Android app (GitHub builds it)

1. Push this folder to your GitHub repo (`main` branch).
2. The app already points at https://nutrime.nl. To use a different address, add a repository variable
   `NUTRIME_SITE` (Settings > Secrets and variables > Actions > Variables).
3. Open the repo's Actions tab > "Build Android app" > the latest run > download `NutriMe-android`.
4. Unzip it on your Android phone and open `app-debug.apk`. Allow "install unknown apps" when asked.
5. In NutriMe Health, tap "Sync from Health Connect" and allow access.

Android 14 and newer have Health Connect built in. On older phones, install "Health Connect" from the Play Store.

## iPhone (later)

The same code builds for iPhone with `npx cap add ios` and the HealthKit setup in
`@capgo/capacitor-health`'s README. It needs an Apple Developer account and a cloud Mac build (for example Codemagic).

## Updating

- Website: run `npx netlify-cli deploy --prod` again.
- Android: push to `main`, then install the new app file from Actions over the old one. Your data stays.
- Netlify's free plan stops functions after about 10 seconds, so keep a fast model.

## Accounts and cloud sync (Supabase)

With these settings NutriMe asks people to sign in with email and password, and their
meals, check-ins, health data, Move, Mind, to-dos and settings sync between the website
and the Android app. Without them, the app keeps working with the shared passcode and
data stays on each device.

1. Create a free project at https://supabase.com (region: Frankfurt or another EU region).
2. In the project, open **SQL Editor**, paste everything from `supabase/schema.sql`, press **Run**.
   This creates one table with row-level security, so each account can only read its own rows.
3. **Authentication > URL Configuration**: set Site URL to `https://nutrime.nl`.
4. **Project Settings > API Keys**: copy the Project URL and either the **publishable** key (`sb_publishable_…`, preferred) or the legacy `anon` `public` key. Both work.
5. In Netlify (Site configuration > Environment variables) add:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the publishable key or legacy anon key (both are meant to be public; your data is protected by row-level security). Never use the secret / service-role key.
   - `ALLOWED_EMAILS` = your email (only these accounts can use the AI, which spends your OpenRouter credits)
6. Redeploy: `npx netlify-cli deploy --prod`.
7. Open the app, tap **Create an account**, confirm the email, sign in. Do this first on the device
   that has the most data; every other device's data is merged in when it signs in.
8. Optional: after creating your account, turn off **Authentication > Sign In / Providers > Allow new users to sign up**.

The service-role key is never needed. Never put it in the app or in Netlify.

### Google sign-in (optional)

1. https://console.cloud.google.com > create a project (any name, e.g. NutriMe).
2. **APIs & Services > OAuth consent screen**: External, app name NutriMe, your email as support and developer contact. Under **Audience** add your Gmail as a test user (or publish the app later).
3. **APIs & Services > Credentials > Create credentials > OAuth client ID**: type **Web application**.
   Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback` (Supabase shows this exact URL on its Google provider page).
4. Copy the Client ID and Client secret into **Supabase > Authentication > Sign In / Providers > Google**, turn it on, save.
5. **Supabase > Authentication > URL Configuration > Redirect URLs**: add `https://nutrime.nl/app/` and `app.nutrime.personal://login` (the Android app).
6. Add the Google account's email to `ALLOWED_EMAILS` in Netlify if it differs from your other one.

Apple sign-in comes later with the iPhone app (it needs a paid Apple Developer account).
