---
description: Check Supabase database connection, show key metrics, and display recent activity
---

# Database Status Check

Check the health and status of the Supabase database for this project.

## What to Check

1. **Database Connection**
   - Verify Supabase credentials are set
   - Test connection to database
   - Show connection status

2. **Key Metrics**
   - Total contacts count
   - Contacts by stage (new, lead, booked, attended, purchased)
   - Recent activity (last 24 hours, 7 days, 30 days)

3. **Data Quality**
   - Contacts with missing emails
   - Contacts with missing phone numbers
   - Contacts with incomplete data

4. **Recent Changes**
   - Last 10 contacts created
   - Last 10 contacts updated
   - Recent webhook events (if webhook_logs table exists)

## Instructions

When this command is invoked:

1. **First, verify environment variables exist:**
   ```bash
   echo "Checking environment variables..."
   if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
     echo "❌ NEXT_PUBLIC_SUPABASE_URL not set"
   else
     echo "✅ NEXT_PUBLIC_SUPABASE_URL is set"
   fi

   if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
     echo "❌ SUPABASE_SERVICE_ROLE_KEY not set"
   else
     echo "✅ SUPABASE_SERVICE_ROLE_KEY is set"
   fi
   ```

2. **Create a temporary script to check database:**
   Create a Node.js script that:
   - Imports Supabase client
   - Queries the contacts table
   - Shows key metrics
   - Displays recent activity

3. **Example script to create:**
   ```javascript
   // check-db-status.js
   const { createClient } = require('@supabase/supabase-js');

   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY,
     { auth: { persistSession: false } }
   );

   async function checkStatus() {
     console.log('\n=== Database Status Check ===\n');

     try {
       // Test connection
       console.log('Testing database connection...');
       const { error: connError } = await supabase.from('contacts').select('id').limit(1);

       if (connError) {
         console.error('❌ Connection failed:', connError.message);
         return;
       }

       console.log('✅ Database connection successful\n');

       // Get total count
       const { count: totalCount } = await supabase
         .from('contacts')
         .select('*', { count: 'exact', head: true });

       console.log(`📊 Total Contacts: ${totalCount}\n`);

       // Get counts by stage
       const { data: stageData } = await supabase
         .from('contacts')
         .select('stage');

       const stageCounts = stageData?.reduce((acc, { stage }) => {
         acc[stage] = (acc[stage] || 0) + 1;
         return acc;
       }, {});

       console.log('📈 Contacts by Stage:');
       Object.entries(stageCounts || {}).forEach(([stage, count]) => {
         console.log(`   ${stage}: ${count}`);
       });

       // Recent activity
       const now = new Date();
       const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
       const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
       const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

       const { count: last24h } = await supabase
         .from('contacts')
         .select('*', { count: 'exact', head: true })
         .gte('created_at', oneDayAgo);

       const { count: last7d } = await supabase
         .from('contacts')
         .select('*', { count: 'exact', head: true })
         .gte('created_at', sevenDaysAgo);

       const { count: last30d } = await supabase
         .from('contacts')
         .select('*', { count: 'exact', head: true })
         .gte('created_at', thirtyDaysAgo);

       console.log('\n📅 Recent Activity:');
       console.log(`   Last 24 hours: ${last24h} contacts`);
       console.log(`   Last 7 days: ${last7d} contacts`);
       console.log(`   Last 30 days: ${last30d} contacts`);

       // Most recent contacts
       const { data: recentContacts } = await supabase
         .from('contacts')
         .select('mcid, email, stage, created_at')
         .order('created_at', { ascending: false })
         .limit(5);

       console.log('\n🆕 Most Recent Contacts:');
       recentContacts?.forEach((contact, i) => {
         const date = new Date(contact.created_at).toLocaleString();
         console.log(`   ${i + 1}. ${contact.email || contact.mcid} (${contact.stage}) - ${date}`);
       });

       console.log('\n✅ Status check complete!\n');

     } catch (error) {
       console.error('❌ Error:', error.message);
     }
   }

   checkStatus();
   ```

4. **Run the script:**
   ```bash
   node check-db-status.js
   ```

5. **Clean up:**
   ```bash
   rm check-db-status.js
   ```

6. **Present the results clearly:**
   - Show connection status (success/failure)
   - Display key metrics in a readable format
   - Highlight any issues (missing data, connection problems)
   - Suggest next steps if issues are found

## Example Output

```
=== Database Status Check ===

Testing database connection...
✅ Database connection successful

📊 Total Contacts: 1,234

📈 Contacts by Stage:
   new: 456
   lead: 234
   booked: 123
   attended: 89
   purchased: 332

📅 Recent Activity:
   Last 24 hours: 23 contacts
   Last 7 days: 156 contacts
   Last 30 days: 567 contacts

🆕 Most Recent Contacts:
   1. user@example.com (lead) - 11/2/2024, 2:30:15 PM
   2. test@example.com (new) - 11/2/2024, 1:15:42 PM
   3. contact@example.com (booked) - 11/2/2024, 12:05:20 PM
   4. buyer@example.com (purchased) - 11/2/2024, 11:22:10 AM
   5. prospect@example.com (lead) - 11/2/2024, 10:45:33 AM

✅ Status check complete!
```

## Troubleshooting

If the connection fails:
1. Check `.env.local` exists and has correct values
2. Verify Supabase credentials are correct
3. Check if Supabase service is running
4. Verify network connectivity

If metrics seem wrong:
1. Check table exists: `contacts`
2. Verify column names match expected schema
3. Check for data type mismatches

## Notes

- This command requires the project to have a `contacts` table
- It uses the service role key (admin access)
- The script is temporary and gets cleaned up after running
- All dates/times are shown in local timezone
- Counts are exact (not estimates)

Use this command whenever you want a quick health check of your database!
