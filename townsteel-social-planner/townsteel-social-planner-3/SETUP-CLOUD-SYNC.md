# Setting up cloud sync (Supabase)

This connects the planner to a free database so your plan is the same in every browser and on every computer. It takes about 20 minutes and you only do it once.

You'll need:

- The new planner files (the updated zip)
- `supabase-setup.sql` (included in the zip)

Supabase sometimes renames menu items. If a label doesn't match exactly, look for the closest one.

## Part 1: Create your Supabase project

1. Go to **supabase.com** and click **Start your project**.
2. Sign in with **GitHub** (easiest, since you already have an account).
3. Click **New project**.
   - Name: `townsteel-social-planner`
   - Database password: click **Generate a password** and save it in your password manager. The planner doesn't use it, but Supabase asks for it.
   - Region: pick one near you, for example East US.
   - Plan: **Free**.
4. Click **Create new project** and wait a minute or two while it sets up.

## Part 2: Create the database table

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open `supabase-setup.sql` from the zip (any text editor works, or open it on GitHub), copy all of it, and paste it into the editor.
4. Click **Run**. You should see "Success. No rows returned."

This creates one table for your planner, plus rules so only you can read or change your data.

## Part 3: Sign-in settings

1. In the left sidebar, click **Authentication**, then **Sign In / Providers**.
2. Under **Email**, turn **off** "Confirm email" and click **Save**. Since you're the only user, this skips the confirmation email step.
3. Leave this page open. You'll come back in Part 6.

## Part 4: Copy your two keys

1. Click **Project Settings** (gear icon at the bottom of the left sidebar).
2. Under **Data API** (or the **Connect** button at the top of the project), copy the **Project URL**. It looks like `https://abcdefghijklm.supabase.co`.
3. Under **API Keys**, copy the **anon public** key (it may be called the **publishable** key). It's a long string.

Use only the anon / publishable key. Never copy the **service_role** or **secret** key anywhere: that one bypasses all the rules.

## Part 5: Update the planner on GitHub

**Upload the new files**

1. Unzip the new `townsteel-social-planner.zip`.
2. Go to your repo on GitHub. If your files are still inside a `townsteel-social-planner` folder there, click into that folder first.
3. Click **Add file > Upload files**.
4. Open the unzipped folder, select everything inside it, and drag it onto the page. Files with the same name get replaced.
5. Click **Commit changes**.

**Paste in your keys**

1. On GitHub, open the `js` folder, then `config.js`.
2. Click the **pencil icon** to edit.
3. Paste your Project URL between the first pair of quotes and your anon key between the second pair:

   ```js
   window.PLANNER_CONFIG = {
     supabaseUrl: "https://abcdefghijklm.supabase.co",
     supabaseKey: "eyJhbGciOi...your long key..."
   };
   ```

4. Click **Commit changes**.
5. Wait about 2 minutes for GitHub Pages to update.

Publishing these two values is safe. The anon key can only do what the database rules allow, and those rules only let a signed-in user see their own planner.

## Part 6: Create your account (order matters)

1. **First**, open the planner in the browser you've been using all along, the one with your posts in it. Refresh the page. You'll see a sign-in screen.
2. Enter your email, choose a password, and click **Create account**. The planner uploads everything already in that browser to your account. The badge in the top right should say **Synced**.
3. Now go back to Supabase: **Authentication > Sign In / Providers**, turn **off** "Allow new users to sign up", and click **Save**. Nobody else can make an account on your planner now.
4. On any other browser or computer, open the planner and click **Sign in** with the same email and password. Your plan loads.

## How it works day to day

- Every change saves to the browser instantly, then to your account about a second later. The badge in the top right shows the status.
- If you're offline, the badge says "Offline: saved on this device". Changes sync when you're back online, or when you click **Strategy & settings > Sync now**.
- When you switch back to a tab, it checks for changes you made in another browser.
- If you edited in two browsers at once, the planner asks which version to keep instead of overwriting.
- **Sign out** (in Strategy & settings) clears that browser's copy. Your plan stays safe in your account.

## Good to know

- **Free plan pause:** Supabase pauses free projects after about a week with no activity. Using the planner counts as activity. If it ever pauses, log in to supabase.com and click **Restore project**.
- **Backups:** **Export backup** still works. Download one now and then as an extra safety net.
- **Forgot your password:** don't delete your user in Supabase, because that deletes your planner data too. Ask for help resetting it instead.
