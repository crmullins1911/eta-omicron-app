# Making it installable on iPhone & Android (PWA)

The app now has a manifest, icons, and a service worker — but a PWA can
only be "installed" from a real HTTPS URL, not from `localhost`. So the
remaining step is hosting it somewhere public.

## 1. Push this project to GitHub
If it isn't already in a repo:
```bash
cd eta-omicron-app
git init
git add .
git commit -m "Eta Omicron app"
```
Create a new repo on github.com, then follow its instructions to push
(`git remote add origin ...` and `git push`).

**Important:** make sure `.env` is in a `.gitignore` file so you don't
publish your Supabase keys to a public repo:
```bash
echo ".env" >> .gitignore
echo "node_modules" >> .gitignore
echo "dist" >> .gitignore
```

## 2. Deploy on Vercel (free)
1. Go to vercel.com and sign up/sign in with your GitHub account.
2. Click **Add New → Project**, select this repo.
3. Vercel auto-detects it's a Vite project — leave the build settings as
   default.
4. Before deploying, add your environment variables (same values as your
   local `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**. In about a minute you'll get a live URL like
   `https://eta-omicron-app.vercel.app`.

## 3. Update Supabase's redirect URL
Supabase Dashboard → Authentication → URL Configuration:
- Set **Site URL** to your new Vercel URL
- Add it under **Redirect URLs** too

Without this, magic-link sign-in emails will try to redirect back to
`localhost` instead of your live site.

## 4. Install it on a phone
**iPhone (Safari):**
1. Open your Vercel URL in Safari (must be Safari, not Chrome, for this to work on iOS).
2. Tap the Share icon (square with an arrow) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. It now appears as an app icon — tapping it opens full-screen, no browser bar.

**Android (Chrome):**
1. Open your Vercel URL in Chrome.
2. Chrome will usually show an **"Install app"** banner automatically — tap it.
3. If not, tap the **⋮** menu → **Add to Home screen** (or **Install app**).
4. Same result: a real home-screen icon that opens full-screen.

## 5. Share it with the chapter
Once it's live, send members the Vercel URL along with the two steps
above (with a screenshot if you'd like) — every member can install it
the same way, no App Store or Play Store account needed.

---

This gets you a fully installable app today. If you later want it in the
actual App Store/Play Store (for discoverability, push notifications,
etc.), the same codebase can be wrapped with Capacitor — that's a
separate step we can take once this is live and working well.
