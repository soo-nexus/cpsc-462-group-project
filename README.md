# expo-user-management

A React Native app built with Expo and Supabase for user authentication and profile management, featuring interactive charts powered by react-native-gifted-charts.

---

## Prerequisites

Make sure you have the following installed before getting started:

- [Node.js](https://nodejs.org/) v20 or higher
- [nvm](https://github.com/nvm-sh/nvm) (recommended for managing Node versions)
- [Expo Go](https://expo.dev/go) installed on your iPhone or Android device

---

## Project Setup Guide

Follow every step in order before running `npx expo start --clear`. Skipping any step is the most common cause of errors.

---

### Step 1 — Install nvm (one time only)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```
Close and reopen your terminal after installing, then verify:
```bash
nvm --version
```

---

### Step 2 — Clone the repository
```bash
git clone https://github.com/yourusername/expo-user-management.git
cd expo-user-management
```

---

### Step 3 — Install the correct Node version
```bash
nvm install
nvm use
```
Verify you are on the right version:
```bash
node --version
```
It should match the version in `.nvmrc`.

---

### Step 4 — Install dependencies
```bash
npm ci --legacy-peer-deps
```
> Always use `npm ci` instead of `npm install` — it installs the exact versions from `package-lock.json` so everyone on the team gets the same packages.

---

### Step 5 — Create your `.env` file
```bash
cp .env.example .env
```
Open `.env` and fill in the Supabase credentials (get these from a teammate or the Supabase dashboard):
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
> Never commit this file to GitHub. It is already listed in `.gitignore`.

---

### Step 6 — Create the babel config (if it does not exist)
Check if `babel.config.js` exists:
```bash
ls babel.config.js
```
If it does not exist, create it:
```bash
touch babel.config.js
```
Then open it and paste:
```javascript
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
```

---

### Step 7 — Network setup
> If you are on eduroam or a university network, Expo Go will not load without one of these two options.

**Option A: iPhone Hotspot (recommended)**
1. iPhone → **Settings → Personal Hotspot → turn on**
2. Mac → connect to your iPhone hotspot via Wi-Fi
3. Keep your phone on the hotspot (it is already connected since it is the source)

**Option B: Tunnel**
```bash
npx expo start --tunnel
```

---

### Step 8 — Start the project
```bash
npx expo start --clear
```
Scan the QR code with your iPhone camera to open in Expo Go.

---

### Step 9 — Verify Supabase connection
You should see either `✅ Supabase connected successfully!` or `❌ Supabase connection failed` in your terminal logs. If you see the error, double check your `.env` values.

## Dependencies

| Package | Version |
|---------|---------|
| expo | 54.0.33 |
| react | 19.1.0 |
| react-native | 0.81.5 |
| typescript | 5.9.3 |
| @supabase/supabase-js | 2.99.0 |
| @react-native-async-storage/async-storage | 2.2.0 |
| react-native-url-polyfill | 3.0.0 |
| react-native-gifted-charts | 1.4.76 |
| react-native-linear-gradient | 2.8.3 |
| react-native-svg | 15.12.1 |
| react-native-chart-kit | 6.12.0 |
| react-native-skia | 0.0.1 |
| babel-preset-expo | 54.0.10 |
| expo-status-bar | 3.0.9 |
| @types/react | 19.1.17 |

---

## Project Structure

```
expo-user-management/
├── lib/
│   └── supabase.ts           # Supabase client setup
├── components/               # Reusable UI components
├── App.tsx                   # App entry point with interactive charts
├── babel.config.js           # Babel configuration
├── .env                      # Your local environment variables (do not commit)
├── .env.example              # Environment variable template
├── .nvmrc                    # Node version pin
└── package.json
```

---

## Supabase Setup

If you are setting up the Supabase project from scratch:

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the **User Management Starter** quickstart under **Community → Quickstarts**
3. Copy your **Project URL** and **anon key** into your `.env` file

---

## Charts Setup

This project uses `react-native-gifted-charts` for interactive charts. It supports:

- **Tap a point** to see its value
- **Drag finger along the line** to trace values with a tooltip
- Animated rendering and curved lines

---

## Troubleshooting

**"Project is incompatible with this version of Expo Go"**
- Update Expo Go on your phone via the App Store / Google Play

**Dependency errors on install**
```bash
npm ci --legacy-peer-deps
```

**App not loading / network error**
- Make sure your phone and laptop are on the same network, or use the hotspot/tunnel method above

**Environment variables not working**
- Make sure your `.env` file exists and variables are prefixed with `EXPO_PUBLIC_`
- Restart the Expo server after any changes to `.env`

**Bundler cache issues**
```bash
npx expo start --clear
```

---

## Tech Stack

- [Expo](https://expo.dev/) SDK 54
- [React Native](https://reactnative.dev/) 0.81.5
- [Supabase](https://supabase.com/) (Auth, Database, Storage)
- [react-native-gifted-charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts) (Interactive Charts)
- TypeScript

---