# Your AI Voice Agent Platform — Deployment Guide

This is written so you can follow it even with zero coding experience.
Do each step in order. Don't skip ahead.

## What you're deploying

A website where businesses can:
1. Sign up for an account
2. Log into a dashboard
3. Describe their AI voice agent in plain language
4. Your server sends that to Sarvam AI, which actually builds the agent

## Step 1: Get a free Sarvam AI account

1. Go to https://platform.sarvam.ai and sign up (no card needed)
2. Find your API key in the dashboard (usually under "API Keys" or "Settings")
3. Copy it somewhere safe — you'll need it in Step 4

## Step 2: Put this code on GitHub (free)

1. Go to https://github.com and create a free account if you don't have one
2. Click "New repository", name it `voice-agent-platform`, make it Public, create it
3. On the new repo page, click "uploading an existing file"
4. Upload all the files I gave you (server.js, package.json, README.md, and the `public` folder with index.html and dashboard.html)
5. Click "Commit changes"

## Step 3: Deploy it for free on Render

1. Go to https://render.com and sign up (free, no card needed for this tier)
2. Click "New +" → "Web Service"
3. Connect your GitHub account, then select the `voice-agent-platform` repo
4. Render will detect it's a Node app. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Click "Advanced" and add an Environment Variable:
   - Key: `SARVAM_API_KEY`
   - Value: (paste the API key you copied in Step 1)
6. Click "Create Web Service"

Render will now build and deploy your site. This takes a few minutes.
When it's done, you'll get a live URL like `https://voice-agent-platform.onrender.com`
— that's your platform, live on the internet, for free.

## Step 4: Test it

1. Open your live URL
2. Sign up as if you were a test business
3. Log in, go to the dashboard
4. Create a test agent and see if it saves successfully

## Important honest notes

- **The free Render tier "sleeps"** after 15 minutes of no traffic, and takes
  ~30 seconds to wake up on the next visit. Fine for testing, not for real
  paying customers yet — we'll upgrade this once you have revenue.
- **The database is a simple file (db.json)**, not a real production database.
  It works for testing but isn't safe long-term (Render's free tier can wipe
  it when it restarts). Once you have real users, tell me and I'll swap this
  for a free, permanent database (Supabase).
- **The Sarvam API call in server.js may need small adjustments** — I wrote
  it based on Sarvam's documented approach, but APIs change. If it errors,
  copy the exact error message back to me and I'll fix the code.
- **This has no telephony (real phone numbers) connected yet.** This first
  version lets clients configure an agent. Connecting real phone calls is
  the next piece we build once this part works.
