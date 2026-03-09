# Vapi Custom LLM Configuration for Transcript Storage

## Problem
The transcript doesn't appear because there's a mismatch in the `tavus_conversation_id` field:
- **Frontend** tracks Vapi call ID via `/vapi/track-call` → stores in `conversations_users.tavus_conversation_id`
- **Custom LLM** stores conversations but uses a different value for `conversations.tavus_conversation_id`
- **Query** joins on `C.tavus_conversation_id = CU.tavus_conversation_id` → **fails to find matches**

## Solution Overview
Configure your Vapi assistant to pass the call ID to your custom LLM service at:
`https://custom-llm-gc-221330051580.us-central1.run.app`

The custom LLM must use this call ID as the `tavus_conversation_id` when creating `conversations` records.

## Step 1: Configure Vapi Assistant Model Settings

1. Go to **Vapi Dashboard** → **Assistants** → Select your assistant
2. Navigate to **Model** settings
3. If using a **Custom LLM Provider**, configure:

### Option A: OpenAI-Compatible Endpoint
```json
{
  "provider": "custom-llm",
  "url": "https://custom-llm-gc-221330051580.us-central1.run.app/v1/chat/completions",
  "model": "gemini-2.0-flash-exp",
  "metadata": {
    "conversation_id": "{{call.id}}"
  }
}
```

### Option B: Using Request Headers
```json
{
  "provider": "custom-llm",
  "url": "https://custom-llm-gc-221330051580.us-central1.run.app/v1/chat/completions",
  "model": "gemini-2.0-flash-exp",
  "headers": {
    "X-Vapi-Call-Id": "{{call.id}}"
  }
}
```

**Key Point:** The `{{call.id}}` variable in Vapi contains the same call ID that the frontend receives and tracks.

## Step 2: Custom LLM Service Requirements

Your custom LLM service at `https://custom-llm-gc-221330051580.us-central1.run.app` must:

### Extract the Call ID
Look for the call ID in one of these locations:
1. **Request metadata** (if using Option A): `request.body.metadata.conversation_id`
2. **Request headers** (if using Option B): `request.headers['X-Vapi-Call-Id']`
3. **Vapi's standard headers**: `request.headers['X-Vapi-Call-Id']` or similar

### Use Call ID as tavus_conversation_id
When creating database records:

```python
# When storing a conversation
INSERT INTO conversations (tavus_conversation_id, conversation_type_id, user_id, created_at)
VALUES (%s, 3, %s, NOW())
ON CONFLICT (tavus_conversation_id) DO NOTHING

# Where %s parameters are:
# - tavus_conversation_id = call_id_from_vapi (the Vapi call ID from request)
# - conversation_type_id = 3 (for Vapi)
# - user_id = extracted from request or looked up
```

## Step 3: Verify Configuration

### Test 1: Check Vapi Sends Call ID
1. Look at your custom LLM service logs
2. Make a test call from the audio page
3. Check if you see the call ID in request logs
4. Example log: `Received request with call_id: 3c91d4e4-...`

### Test 2: Check Database Records Match
After making a call:

```sql
-- Check what the frontend tracked
SELECT * FROM conversations_users 
WHERE conversation_type_id = 3 
ORDER BY created_at DESC 
LIMIT 1;

-- Check what the custom LLM stored
SELECT * FROM conversations 
WHERE conversation_type_id = 3 
ORDER BY created_at DESC 
LIMIT 1;

-- These should have matching tavus_conversation_id values
```

### Test 3: Use Debug Endpoint
```bash
curl -X GET "http://localhost:5000/conversations/debug-vapi" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Look for the diagnosis:
```json
{
  "diagnosis": {
    "has_tracked_calls": true,
    "has_conversation_records": true,  // Should be true if custom LLM is working
    "has_turns": true,                 // Should be true if turns are stored
    "issue": "Data looks good"         // Or identifies the problem
  }
}
```

## Current Data Flow

### Without Fix (Current State)
```
┌──────────┐         ┌─────────────────────┐         ┌──────────────────┐
│ Frontend │  ID-A   │ conversations_users │  ID-B   │ conversations    │
│          ├────────>│ tavus_conv_id: A   │         │ tavus_conv_id: B │
└──────────┘         │ type: 3            │         │ type: 3          │
                     └─────────────────────┘         └──────────────────┘
                                                      ↑
                                                      │ ID-B (different!)
                                           ┌──────────┴─────────┐
                                           │ Custom LLM Service │
                                           └────────────────────┘
                                           
❌ Join FAILS: ID-A ≠ ID-B
```

### With Fix (Target State)
```
┌──────────┐         ┌─────────────────────┐         ┌──────────────────┐
│ Frontend │  ID-X   │ conversations_users │  ID-X   │ conversations    │
│          ├────────>│ tavus_conv_id: X   │<────────┤ tavus_conv_id: X │
└──────────┘         │ type: 3            │         │ type: 3          │
                     └─────────────────────┘         └──────────────────┘
                                                      ↑
                                                      │ ID-X (same!)
                                           ┌──────────┴─────────┐
                                           │ Custom LLM Service │
                                           │ (uses {{call.id}}) │
                                           └────────────────────┘
                                           
✅ Join SUCCEEDS: ID-X = ID-X
```

## Common Issues

### Issue 1: Custom LLM doesn't receive call ID
**Symptom:** Custom LLM logs don't show call ID
**Fix:** Check Vapi assistant model configuration, verify `{{call.id}}` variable is set

### Issue 2: Custom LLM receives call ID but doesn't use it
**Symptom:** Logs show call ID but database has different value
**Fix:** Update custom LLM code to use the received call ID as `tavus_conversation_id`

### Issue 3: Call ID format mismatch
**Symptom:** Call IDs exist but don't match (e.g., with/without prefix)
**Fix:** Ensure both frontend and custom LLM use exact same format

## Next Steps

1. **Check current Vapi assistant configuration**
   - Does it use your custom LLM endpoint?
   - Does it pass the call ID?

2. **Check custom LLM service code**
   - Does it extract call ID from request?
   - Does it store it as `tavus_conversation_id`?

3. **Test with debug endpoint**
   - Make a call
   - Check `/conversations/debug-vapi`
   - Compare call IDs

4. **Fix the mismatch**
   - Update Vapi configuration OR
   - Update custom LLM code to use Vapi call ID
