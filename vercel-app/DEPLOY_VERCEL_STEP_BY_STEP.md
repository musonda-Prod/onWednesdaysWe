# Deploy to Vercel — step by step

## Do you have a backup of the Streamlit app?

**Yes.** The Streamlit app is still in this repo and was not removed:

- **Root of the repo:** `dashboard.py`, `funnel_analyzer.py`, `requirements.txt`, `.streamlit/`, `.env` (your local env).  
- **Vercel app:** lives in the `vercel-app/` folder only.  
- So you have both: run Streamlit locally with `streamlit run dashboard.py` from the repo root, and deploy the Next.js app from `vercel-app/` to Vercel. They are separate; the Streamlit app is your backup and can be used anytime.

---

## Step 1: Push your code to Git

1. If you haven’t already, initialise Git and add a remote:
   ```bash
   cd "/Users/musondachalwe/Cursor test Musonda"
   git init
   git add .
   git commit -m "Add BNPL dashboard and Vercel app"
   git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
   git push -u origin main
   ```
2. Use your org’s repo URL. If the repo already exists, just push:
   ```bash
   git add .
   git commit -m "Add Vercel app and merchant chart"
   git push
   ```

---

## Step 2: Create a Vercel project and connect the repo

1. Go to [vercel.com](https://vercel.com) and sign in (use your org account if required).
2. Click **Add New…** → **Project**.
3. **Import** your Git repository (GitHub/GitLab/Bitbucket). Authorise Vercel if asked.
4. Select the repo that contains this project (e.g. `Cursor test Musonda` or whatever you named it).

---

## Step 3: Set the root directory to `vercel-app`

1. On the import screen, find **Root Directory**.
2. Click **Edit** next to it.
3. Enter: **`vercel-app`** (only this folder will be built).
4. Leave **Framework Preset** as **Next.js** (Vercel should detect it).
5. Do **not** deploy yet — set environment variables first.

---

## Step 4: Add environment variables (Snowflake)

1. On the same screen, open **Environment Variables** (or after creating the project go to **Settings → Environment Variables**).
2. Add these one by one (use the same values as in your Streamlit `.env`):

   | Name | Value | Notes |
   |------|--------|--------|
   | `SNOWFLAKE_ACCOUNT` | Your account (e.g. `xy12345`) | No `https://` or `.snowflakecomputing.com` |
   | `SNOWFLAKE_USER` | Your Snowflake user | |
   | `SNOWFLAKE_PASSWORD` | Your Snowflake password | Prefer a service-account password if possible |
   | `SNOWFLAKE_WAREHOUSE` | e.g. `COMPUTE_WH` | |
   | `SNOWFLAKE_DATABASE` | Your database name | |
   | `SNOWFLAKE_SCHEMA` | e.g. `PUBLIC` | Optional; code defaults to `PUBLIC` |
   | `SNOWFLAKE_REGION` | e.g. `eu-west-1` | Only if your account needs a region |

3. Optional: `EXCLUDE_TEST_USERS` = `true` (or `1`) to exclude test users (e.g. stitch.money) from counts.
4. Save. Apply to **Production** (and Preview if you want the same for branch deploys).

---

## Step 5: Deploy

1. Click **Deploy**.
2. Wait for the build to finish (a few minutes). If it fails, check the build log (often a missing env var or Node version).
3. When it succeeds, Vercel shows a URL like **`https://your-project-name.vercel.app`**.

---

## Step 6: Open the app and test

1. Open the URL in your browser.
2. Choose a date range in the sidebar and click **Refresh**.
3. You should see the BNPL Pulse dashboard and data from Snowflake. If you see an error, check **Settings → Environment Variables** and that Snowflake allows connections from Vercel’s IPs (no VPN required for standard Snowflake cloud).

---

## Later: redeploy after code changes

- Push to the branch connected to Vercel (e.g. `main`). Vercel will build and deploy automatically.
- Or in the Vercel dashboard: **Deployments** → **Redeploy** for the latest commit.

---

## Run the same app locally (optional)

```bash
cd vercel-app
npm install
cp .env.example .env.local
```

Edit `.env.local` with your Snowflake values (same as above), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
