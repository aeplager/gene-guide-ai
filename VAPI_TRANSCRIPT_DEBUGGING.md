# Vapi Transcript Debugging Guide

## Overview
The transcript functionality should work with database polling, but we need to diagnose why it's not showing Vapi conversation data.

## Architecture
1. **Frontend** (`LegacyVoiceCallPanel.tsx`) polls `/conversations/recent-transcript?conversation_id={vapi_call_id}` every 3 seconds
2. **Backend** (`app.py`) queries the database joining `conversations`, `conversation_turns`, and `conversations_users` tables
3. **Custom LLM** (`https://custom-llm-gc-221330051580.us-central1.run.app`) stores conversation turns when Vapi calls it
4. **Call Tracking** (`/vapi/track-call`) stores Vapi call ID in `conversations_users.tavus_conversation_id`

## Database Schema
```sql
-- conversations_users: Links users to conversations (Tavus or Vapi)
--   tavus_conversation_id: stores both Tavus and Vapi call IDs
--   conversation_type_id: 1=Tavus, 3=Vapi

-- conversations: Main conversation records
--   tavus_conversation_id: must match conversations_users.tavus_conversation_id
--   conversation_type_id: 1=Tavus, 3=Vapi

-- conversation_turns: Individual messages
--   conversation_id: foreign key to conversations.id
```

## Query Logic
The `/conversations/recent-transcript` endpoint does:
```sql
FROM public.conversations C 
INNER JOIN public.conversation_turns CT ON C.id = CT.conversation_id  
INNER JOIN public.conversations_users CU ON C.tavus_conversation_id = CU.tavus_conversation_id
WHERE CU.tavus_conversation_id = {vapi_call_id}
```

## Debugging Steps

### Step 1: Make a Vapi Call
1. Open the audio page
2. Start a Vapi call
3. Have a conversation (say a few things, wait for AI responses)
4. Check browser console for logs

### Step 2: Check Frontend Logs
Look for these log messages in browser console:
- `[Vapi] 📞 Got call ID from message event: {call_id}`
- `[Vapi] 🔗 Track-call response: 200` (confirms call ID was tracked)
- `[Transcript] 📡 Fetching for call {call_id} from: /conversations/recent-transcript?conversation_id={call_id}`
- `[Transcript] ✅ Fetched N turns` (should show > 0 if working)
- `[Transcript] ⚠️ No turns found for call ID` (indicates the issue)

### Step 3: Check Debug Endpoint
After making a call, run this debug endpoint:
```bash
curl -X GET "http://localhost:5000/conversations/debug-vapi" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Or visit in browser (if logged in): `http://localhost:5000/conversations/debug-vapi`

**What to look for:**
```json
{
  "diagnosis": {
    "has_tracked_calls": true/false,     // Should be true if /vapi/track-call worked
    "has_conversation_records": true/false,  // Should be true if custom LLM created conversations record
    "has_turns": true/false,             // Should be true if custom LLM stored turns
    "issue": "diagnosis message"
  }
}
```

### Step 4: Diagnose Based on Results

#### Issue: `has_tracked_calls = false`
**Problem:** Frontend isn't calling `/vapi/track-call` or it's failing
**Fix:** 
- Check browser console for `Track-call response` log
- Check backend logs for `🎙️ vapi:track-call call_id=...`
- Verify JWT token is valid

#### Issue: `has_tracked_calls = true` but `has_conversation_records = false`
**Problem:** Custom LLM isn't creating `conversations` records with matching `tavus_conversation_id`
**Fix:** The custom LLM needs to:
1. Accept the Vapi call ID in its requests (check Vapi assistant configuration)
2. Create a `conversations` record with `tavus_conversation_id = vapi_call_id`
3. Create `conversation_turns` records linked to that conversation

**Check Vapi Assistant Configuration:**
- Does the Vapi assistant have the custom LLM endpoint configured?
- Does it pass the call ID in the request to the custom LLM?

#### Issue: `has_conversation_records = true` but `has_turns = false`
**Problem:** Conversations exist but turns aren't being created
**Fix:** 
- Check custom LLM logs for errors when storing turns
- Verify database connection from custom LLM
- Check if turns are being created with correct `conversation_id` foreign key

#### Issue: All `true` but transcript still doesn't show
**Problem:** Frontend or query timing issue
**Fix:**
- Check if `conversations.tavus_conversation_id` exactly matches `conversations_users.tavus_conversation_id`
- Verify the query returns data (check backend logs)
- Check if frontend is rendering the transcript array correctly

## Enhanced Logging
The code now includes detailed logging:

**Frontend:**
- Shows exact URL being polled
- Shows number of turns fetched and first turn data
- Warns when no turns found for specific call ID
- Suggests running debug endpoint

**Backend:**
- New `/conversations/debug-vapi` endpoint shows all database state
- Provides diagnosis of what's missing

## Expected Flow
1. User starts Vapi call → frontend gets call ID from Vapi event
2. Frontend calls `/vapi/track-call` → creates `conversations_users` record
3. User talks → Vapi calls custom LLM with call ID
4. Custom LLM creates `conversations` record (if not exists) with `tavus_conversation_id = vapi_call_id`
5. Custom LLM stores each turn in `conversation_turns`
6. Frontend polls `/conversations/recent-transcript?conversation_id={vapi_call_id}`
7. Backend joins tables and returns turns
8. Frontend displays transcript

## Next Steps
Run through the debugging steps above to identify where the flow is breaking. The most likely issue is **Step 4** (custom LLM not creating conversations records with the correct tavus_conversation_id).
