# Enable live scheduling with Supabase

The interface works in browser-only demo mode until it is connected to a Supabase project. Demo schedules do not sync with other people.

1. Create a free project at https://supabase.com/dashboard.
2. In **SQL Editor**, run the contents of `schema.sql`.
3. In **Project Settings → API**, copy the **Project URL** and the public **anon key**. Do not use or share the `service_role` key.
4. Add them to `static/schedule/config.js`:

   ```js
   window.SCHEDULER_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY"
   };
   ```

5. Commit and push the change. New schedules will then produce live participant links.

Anyone who has a participant link can read all submitted names and availabilities. A participant can update only their own response from the same browser; their private edit token is stored in browser storage.
