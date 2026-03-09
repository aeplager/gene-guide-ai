# 🎙️ Vapi Transcript Configuration Guide

## ✅ Current Status

**Good News:** The transcript functionality **already exists** on your audio consultation page!

The `LegacyVoiceCallPanel` component includes:
- ✅ Live transcript capture from Vapi message events (real-time)
- ✅ User/AI message display with timestamps
- ✅ Feedback buttons (thumbs up/down)
- ✅ Feedback text area
- ✅ Save feedback functionality
- ✅ No backend configuration required!

**How it works:** The component listens to Vapi's message events and populates the transcript in real-time as the conversation happens.

---

## 🔧 How It Works

### Simple Architecture:

```
┌─────────────────┐
│  Audio Page     │
│  (Frontend)     │
└────────┬────────┘
         │
         ├─────► Vapi.ai SDK ─────► Vapi Assistant
         │                                │
         │                                │ sends message events
         │                                ▼
         │                          [transcript events]
         │                                │
         └◄───────── handleMessage ◄──────┘
                         │
                         ▼
              Store in transcript state
                         │
                         ▼
              Display on page immediately
```

### Event Handling:

The component listens to Vapi's `message` events which include:
- **transcript** events (user speech transcription)
- **speech-update** events (AI responses)

These are captured in real-time and added to the transcript state, which is displayed on the page.

---

## 🎯 No Configuration Required!

Unlike the video page (Tavus) which requires database polling, the audio page transcript works out-of-the-box because:

1. ✅ Vapi SDK sends message events in real-time
2. ✅ Frontend captures these events directly
3. ✅ No custom LLM configuration needed
4. ✅ No database integration required
5. ✅ Works immediately when you start a call

---

### Testing Workflow:

1. **Start Audio Consultation:**
   - Navigate to `/audio` page
   - Click "Start Call"
   - Have a short conversation with the AI

2. **Check Frontend Logs:**
   - Open browser console (F12)
   - Look for transcript polling logs:
     ```
     [Transcript] Starting polling on page load...
     [Transcript] Fetching for call abc-123-xyz (3h window)
     [Transcript] ✅ Fetched 6 turns
     ```

3. **Verify Transcript Display:**
   - Scroll down on the audio page
   - You should see "Live Conversation Transcript" card
   - Messages should appear with:
     - 👤 You / 🤖 Assistant badges
     - Timestamps
     - Thumbs up/down feedback buttons
     - Feedback text area (when feedback selected)

4. **Test Feedback:**
   - Click thumbs up or down on a message
   - Type optional feedback text
   - Click "Save Feedback" button
   - Refresh page - feedback should persist

---

## 🐛 Troubleshooting

### Issue: "No recent conversations" message

**Possible Causes:**
1. ❌ Vapi assistant not configured to use custom LLM
2. ❌ Custom LLM not storing turns in database
3. ❌ Vapi call ID not tracked in `conversations_users`
4. ❌ User not authenticated (JWT token missing)

**Solutions:**
1. Verify Vapi assistant configuration (Step 1)
2. Check custom LLM logs for database writes
3. Check browser console for `/vapi/track-call` success
4. Verify auth token in localStorage: `localStorage.getItem('auth_token')`

### Issue: Call ID tracking fails

**Check Browser Console:**
```
[Vapi] 📞 Got call ID from message event: abc-123-xyz
[Vapi] 🔗 Track-call response: 200
```

**If missing:** Check that LegacyVoiceCallPanel is calling `/vapi/track-call` correctly.

**Backend Logs:**
```
🎙️ vapi:track-call call_id=abc-123-xyz user_email=user@example.com
✅ vapi:track-call:db tracked call_id=abc-123-xyz user_id=123
```

### Issue: Transcript polling succeeds but no data

**Check Database:**
```sql
-- Are there any conversation turns at all?
SELECT COUNT(*) FROM conversation_turns;

-- Are there Vapi conversations registered?
SELECT * FROM conversations_users WHERE conversation_type_id = 3;
```

**If no data:** Custom LLM is not storing conversation turns. Check custom LLM code to ensure it writes to the database after each chat completion.

---

## 📝 Custom LLM Requirements

For transcript to work, your custom LLM service must:

### 1. Implement OpenAI-Compatible API:
```python
@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    # Generate AI response
    response = generate_response(request.messages)
    
    # CRITICAL: Store conversation turns in database
    conversation_id = request.metadata.get("conversation_id")  # From Vapi
    store_conversation_turn(
        conversation_id=conversation_id,
        role="user",
        content=request.messages[-1].content
    )
    store_conversation_turn(
        conversation_id=conversation_id,
        role="assistant",
        content=response.content
    )
    
    return ChatCompletionResponse(...)
```

### 2. Database Schema:
- Table: `conversations`
  - Columns: `id`, `tavus_conversation_id` (stores Vapi call ID), `user_id`, `created_at`
  
- Table: `conversation_turns`
  - Columns: `conversation_id`, `ordinal`, `role`, `content`, `created_at`, `feedback`, `feedback_status`

- Table: `conversations_users`
  - Columns: `user_id`, `tavus_conversation_id` (Vapi call ID), `conversation_type_id` (3 for Vapi), `created_at`

---

## 🧪 Testing Transcript

### Testing Workflow:

1. **Start Audio Consultation:**
   - Navigate to `/audio` page
   - Click "Start Call"
   - Speak to the AI (e.g., "What does my genetic variant mean?")

2. **Watch Transcript Appear:**
   - As you speak, your words will be transcribed
   - When AI responds, the response appears
   - Transcript updates in real-time, most recent at top

3. **Check Browser Console (Optional):**
   - Open browser console (F12)
   - Look for logs:
     ```
     [Vapi] 📨 Message event: transcript {type: "transcript", ...}
     [Vapi] 📝 User transcript: What does my genetic variant mean?
     [Vapi] 🤖 Assistant transcript: Based on your results...
     ```

4. **Verify Transcript Display:**
   - Scroll down on the audio page
   - You should see "Live Conversation Transcript" card
   - Messages appear with:
     - 👤 You / 🤖 Assistant badges
     - Timestamps
     - Thumbs up/down feedback buttons
     - Feedback text area (appears when you click thumbs)

5. **Test Feedback (Optional):**
   - Click thumbs up or down on a message
   - Type optional feedback text
   - Click "Save Feedback" button
   - Note: Feedback is saved to local state (not persisted to database yet)

---

## 🐛 Troubleshooting

### Issue: "No recent conversations" message

**Possible Causes:**
1. ❌ Call hasn't started yet
2. ❌ Vapi message events not being received
3. ❌ Message event structure is different than expected

**Solutions:**
1. Make sure you clicked "Start Call" and are in an active call
2. Open browser console and check for `[Vapi] 📨 Message event:` logs
3. If message logs appear but transcript doesn't populate, check the message structure
4. Update the `handleMessage` function based on actual Vapi event structure

### Issue: Only user messages appear, no AI responses

**Cause:** The message event type for AI responses might be different

**Solution:**
Check console logs for AI message events:
```
[Vapi] 📨 Message event: function-call {...}
[Vapi] 📨 Message event: assistant-message {...}
```

Update `LegacyVoiceCallPanel.tsx` to handle the correct message type.

### Issue: Messages appear but with wrong timestamps

**Cause:** Using client-side timestamp instead of message timestamp

**Solution:**
Update `handleMessage` to use `message.timestamp` or `message.created` if available:
```typescript
created_at: message.timestamp || new Date().toISOString()
```

---

## 🔍 Advanced: Understanding Vapi Message Events

Vapi sends various message types via the SDK. Common ones include:

- **`transcript`** - User speech transcription (interim and final)
- **`speech-update`** - AI speech status changes
- **`function-call`** - When assistant calls a function
- **`hang`** - Call hang-up events
- **`error`** - Error events

The `handleMessage` function in `LegacyVoiceCallPanel.tsx` currently handles:
1. **`transcript` with `transcriptType: "final"`** → User message
2. **`speech-update` with `status: "stopped"`** → AI response

If your Vapi assistant uses different event structures, you may need to adjust the event handling logic.

### Debugging Message Structure:

To see exactly what Vapi sends, check the console logs:

```javascript
console.log("[Vapi] 📨 Message event:", message?.type, message);
```

This will show you the full message structure so you can adjust the transcript capture logic accordingly.

---

## 📝 Code Reference

### Key Files:

**Frontend:**
- **`src/components/LegacyVoiceCallPanel.tsx`**
  - Lines 51-74: Transcript state management
  - Lines 67-130: `handleMessage` function (captures transcript from events)
  - Lines 708-830: Transcript UI rendering

**Backend (for feedback only):**
- **`app.py`**
  - Lines 1002-1056: `/vapi/track-call` endpoint (tracks call IDs)
  - Lines 1215-1285: `/conversations/turn-feedback` endpoint (saves feedback)

--- ## ✅ Success Checklist

- [ ] Audio call starts successfully
- [ ] User speech appears in transcript as you speak
- [ ] AI responses appear in transcript after AI speaks
- [ ] Transcript shows most recent messages at the top
- [ ] Timestamps display correctly
- [ ] Feedback buttons are clickable
- [ ] Feedback text area appears when thumbs clicked
- [ ] "Save Feedback" button appears when feedback is pending
- [ ] Transcript remains visible after call ends

---

## 🎯 Summary

**The transcript feature works automatically!** No configuration needed beyond basic Vapi setup:

1. ✅ Vapi assistant configured with ID and public key
2. ✅ Frontend listens to Vapi message events
3. ✅ Transcript populates in real-time during call
4. ✅ Appears on audio page automatically

**If transcript doesn't appear:**
1. Check browser console for Vapi message event logs
2. Verify message event structure matches expected format
3. Adjust `handleMessage` function if needed based on your Vapi configuration

---

## 💡 Future Enhancements

### Optional: Persist Transcript to Database

If you want transcripts to persist across sessions (like the video page does), you can:

1. **Create endpoint:** `POST /vapi/store-turn`
   - Accepts: `conversation_id`, `role`, `content`, `created_at`
   - Stores in `conversation_turns` table

2. **Update frontend** to call endpoint after each message:
   ```typescript
   // In handleMessage after adding to state
   fetch(`${backendBase}/vapi/store-turn`, {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ conversation_id: callId, role: 'user', content: text })
   });
   ```

3. **Benefits:**
   - Transcripts survive page refresh
   - Can view historical conversations
   - Analytics on conversation patterns

**For now:** Transcript works in real-time during the call, which is sufficient for most use cases!

---

## 📚 Related Documentation

- **Vapi.ai Docs:** https://docs.vapi.ai
- **Vapi Web SDK:** https://github.com/VapiAI/web
- **Project README:** `README.md`
- **Vapi Integration:** `VAPI_INTEGRATION_GUIDE.md`

