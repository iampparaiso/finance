# Manual Setup Steps — Finance OS

These steps require browser interaction or credentials and cannot be automated.
Complete them in order before telling Claude "manual steps done" to continue with Task 1.

---

## Step 1: Enable Google Apps Script API (one-time)

1. Open this URL in your browser (sign in as `iampparaiso@gmail.com`):
   https://script.google.com/home/usersettings
2. Find **"Google Apps Script API"** and toggle it **ON**.
3. Done — you only need to do this once per Google account.

---

## Step 2: Log in to clasp

> **Note:** On Windows, PowerShell may block clasp with a script execution policy error.
> If `clasp` fails, use `npx clasp` instead (e.g. `npx clasp login`), or run this once
> in an **Administrator** PowerShell to allow local scripts:
> ```
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

1. Open **PowerShell** and navigate to the appsscript folder:
   ```
   cd C:\Users\ppara\Desktop\finance\appsscript
   ```
2. Run:
   ```
   clasp login
   ```
   If that fails due to execution policy, run:
   ```
   npx clasp login
   ```
3. A browser window will open — sign in as **iampparaiso@gmail.com**.
4. After signing in, return to the terminal. You should see:
   ```
   Logged in! You may close this window.
   ```

---

## Step 3: Create the Apps Script project

1. Still in PowerShell at `C:\Users\ppara\Desktop\finance\appsscript\`, run:
   ```
   clasp create --type standalone --title "Finance OS"
   ```
   (Use `npx clasp create ...` if `clasp` is blocked by execution policy.)
2. This creates `appsscript/.clasp.json` containing the `scriptId` — this file is **gitignored** so it will never be committed.
3. The command will print a Script URL like:
   ```
   https://script.google.com/d/SCRIPT_ID_HERE/edit
   ```
   **Copy and save that URL** — you'll need the Script ID later when deploying.

---

## Step 4: Create the GitHub repository

1. Go to: https://github.com/new
2. Fill in:
   - **Repository name:** `finance`
   - **Visibility:** Public (required for free GitHub Pages)
   - **Do NOT** check "Initialize this repository with a README"
3. Click **"Create repository"**.
4. Back in PowerShell at `C:\Users\ppara\Desktop\finance\`, run these three commands:
   ```
   git remote add origin https://github.com/iampparaiso/finance.git
   git branch -M main
   git push -u origin main
   ```
5. Your initial commit (schemas + plan) will now be on GitHub.

---

## Step 5: What to do next

Once all steps above are complete, tell Claude:

> "Manual steps done"

Claude will then continue with **Task 1** — writing the Google Apps Script backend files.
