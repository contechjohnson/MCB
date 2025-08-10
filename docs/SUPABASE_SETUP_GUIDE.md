# Supabase Setup Guide for MCB Project

## Step 1: Create a Supabase Account
1. Go to https://supabase.com
2. Click "Start your project" 
3. Sign up with GitHub or email
4. Create a new project:
   - Project name: `ManyChatMinimum` (or your choice)
   - Database Password: (save this securely!)
   - Region: Choose closest to you
   - Click "Create new project" (takes ~2 minutes)

## Step 2: Run the Database Setup
1. Once your project is ready, click on "SQL Editor" in the left sidebar
2. Click "New query"
3. Copy ALL the contents from `/sql/setup.sql`
4. Paste into the SQL editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. You should see "Success" messages

## Step 3: Get Your API Keys
1. Click on "Settings" (gear icon) in left sidebar
2. Click "API" under Configuration
3. You'll need these values:
   - **Project URL**: `https://[your-project-id].supabase.co`
   - **Anon/Public Key**: (safe for client-side)
   - **Service Role Key**: (KEEP SECRET - server only!)

## Step 4: Save Your Keys
Create a file called `.env.local` in your Next.js project (we'll create that next) with:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## What You Now Have:
✅ A `contacts` table ready for ManyChat data
✅ All indexes for fast queries
✅ Functions for calculating funnel metrics
✅ Everything needed for the dashboard

## Next Steps:
After Supabase is set up, we'll:
1. Create the Next.js project
2. Connect it to Supabase
3. Build the webhook endpoint
4. Create the dashboard

---

**Need Help?**
- Supabase Docs: https://supabase.com/docs
- The SQL file has comments explaining each part
- All the hard database work is done - just run the SQL!