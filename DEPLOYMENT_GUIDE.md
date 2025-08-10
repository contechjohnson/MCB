# 🚀 Deployment Guide for MCB ManyChat System

## Step 1: Deploy to Vercel

Run this command and follow the prompts:
```bash
vercel
```

When prompted:
1. **Set up and deploy?** → Yes
2. **Which scope?** → Your account
3. **Link to existing project?** → No (create new)
4. **Project name?** → mcb-manychat (or your choice)
5. **Directory?** → ./ (current directory)
6. **Build settings?** → Accept defaults

## Step 2: Set Environment Variables on Vercel

After deployment, run:
```bash
vercel env pull
```

Then add your production environment variables:
```bash
# Add each environment variable
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENAI_API_KEY
vercel env add OPENAI_ASSISTANT_ID
vercel env add MANYCHAT_BOT_ID
vercel env add MANYCHAT_VERIFY_TOKEN
vercel env add MANYCHAT_API_KEY
```

Or go to: https://vercel.com/[your-username]/[project-name]/settings/environment-variables

## Step 3: Deploy to Production

```bash
vercel --prod
```

## Step 4: Get Your Production URL

Your app will be available at:
- Preview: `https://[project-name]-[random-id].vercel.app`
- Production: `https://[project-name].vercel.app`

## Step 5: Configure ManyChat

### In ManyChat, create an External Request:

1. Go to **Settings → Integrations → External Request**
2. Click **+ New Request**
3. Configure:
   - **Name:** AI Router
   - **Method:** POST
   - **URL:** `https://[your-project].vercel.app/api/ai-router`
   - **Headers:**
     - Content-Type: application/json
   - **Body (JSON):**
   ```json
   {
     "subscriber_id": "{{subscriber_id}}",
     "message": "{{last_text_input}}",
     "channel": "instagram",
     "profile": {
       "name": "{{full_name}}",
       "username": "{{instagram_username}}",
       "email": "{{email}}",
       "phone": "{{phone}}"
     },
     "tags": "{{tags}}"
   }
   ```

4. **Response Mapping:**
   - Map `reply_text` → Custom Field "AI Reply"
   - Map `booking_flag` → Custom Field "Show Booking"
   - Map `booking_url` → Custom Field "Booking Link"
   - Map `lead_stage` → Custom Field "Lead Stage"

### In your ManyChat Flow:

1. Add **External Request** action
2. Select your "AI Router" request
3. After the request, add conditions:
   - If `Show Booking` = true → Show booking flow
   - Else → Send `{{AI Reply}}`

## Step 6: Test the Connection

1. Send a test message in ManyChat
2. Check your dashboard: `https://[your-project].vercel.app/dashboard`
3. Verify the contact appears with correct data

## 🎯 Your URLs:

- **Webhook:** `https://[your-project].vercel.app/api/ai-router`
- **Dashboard:** `https://[your-project].vercel.app/dashboard`
- **Home:** `https://[your-project].vercel.app`

## 📊 Monitor Your System:

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Function Logs:** Click on your project → Functions tab
- **Analytics:** Built into Vercel dashboard

## 🔧 Troubleshooting:

If webhook isn't responding:
1. Check Vercel function logs
2. Verify environment variables are set
3. Test with curl:
```bash
curl -X POST https://[your-project].vercel.app/api/ai-router \
  -H "Content-Type: application/json" \
  -d '{"subscriber_id":"test123","message":"Hello"}'
```

## 🔄 Update Deployment:

After making changes:
```bash
git add .
git commit -m "Update"
vercel --prod
```