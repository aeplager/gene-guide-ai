# 🎙️ Vapi Personalized Greeting - Complete Solution

## ❌ Problem: 400 Error with assistantOverrides

The Vapi Web SDK is rejecting our `assistantOverrides.firstMessage` parameter with a 400 error:
```
api.vapi.ai/call/web:1  Failed to load resource: the server responded with a status of 400
```

**Root Cause:** The `@vapi-ai/web` SDK doesn't support `firstMessage` in `assistantOverrides` (or we're using the wrong format).

---

## ✅ Solution: Configure Greeting in Vapi Dashboard

Since we can't override the first message via the SDK, we need to configure the greeting **in the Vapi Assistant** itself using **variables**.

### **Approach: Use Vapi Assistant Variables**

1. **Configure the Assistant in Vapi Dashboard** with a variable placeholder
2. **Pass the personalized greeting** as a variable when starting the call
3. **Assistant uses the variable** in its first message

---

## 📋 Implementation Steps

### **Step 1: Update Vapi Assistant Configuration**

Go to your Vapi Dashboard: https://dashboard.vapi.ai

1. **Open your Assistant** (ID: `b0ff3584-411d-4ebf-aae5-30329765476f`)

2. **Update the First Message** to use a variable:
   ```
   {{greeting}}
   ```

   Or with a fallback:
   ```
   {{greeting || "Hi, I'm here to help you understand your genetic testing results."}}
   ```

3. **Update System Prompt** (if needed) to include genetic context variable:
   ```
   You are Lucy, a compassionate genetic counselor.
   
   {{genetic_context}}
   
   [rest of your system prompt...]
   ```

4. **Save the Assistant**

### **Step 2: Update Frontend Code**

Update `src/components/LegacyVoiceCallPanel.tsx` to pass variables:

```typescript
// Pass variables to Vapi when starting call
const callOptions: any = {};

if (greeting || geneticContext) {
  callOptions.assistantOverrides = {
    variableValues: {}
  };
  
  if (greeting) {
    callOptions.assistantOverrides.variableValues.greeting = greeting;
  }
  
  if (geneticContext) {
    callOptions.assistantOverrides.variableValues.genetic_context = geneticContext;
  }
}

await vapiRef.current.start(ASSISTANT_ID, callOptions);
```

---

## 🔄 Alternative Approach: Send Greeting After Call Starts

If variables don't work, we can send the greeting as a message **after** the call connects:

### **Option A: Wait for Assistant, Then Send Context**

```typescript
// Start call without overrides
await vapiRef.current.start(ASSISTANT_ID);

// Listen for call-start event
vapiRef.current.on('call-start', () => {
  console.log("[Vapi] Call started, assistant will speak first");
  // Let the assistant speak its default greeting first
  // User can then ask questions about their specific condition
});
```

### **Option B: Inject Context as First User Message**

```typescript
await vapiRef.current.start(ASSISTANT_ID);

vapiRef.current.on('call-start', () => {
  // Send genetic context as if user said it
  if (geneticContext) {
    vapiRef.current.send({
      type: 'add-message',
      message: {
        role: 'user',
        content: `Please help me understand my genetic testing results: ${greeting}`
      }
    });
  }
});
```

---

## 🎯 Recommended Solution

### **Best Approach: Use Vapi Assistant Variables** ✅

**Why:**
- Clean separation: Greeting template in Vapi, data from backend
- Works with Vapi's API design
- No workarounds needed

**Implementation:**

1. **Vapi Dashboard:**
   - First Message: `{{greeting}}`
   - System Prompt: Include `{{genetic_context}}` at the top

2. **Frontend Code:**
   ```typescript
   await vapiRef.current.start(ASSISTANT_ID, {
     assistantOverrides: {
       variableValues: {
         greeting: greeting,
         genetic_context: geneticContext
       }
     }
   });
   ```

3. **Backend:** (Already done ✅)
   - `/vapi/start` endpoint provides greeting and genetic_context

---

## 🧪 Testing

### **Verify Variables Work:**

1. **Start a call** and check browser console:
   ```
   [Vapi] Starting call with variables: {greeting: "...", genetic_context: "..."}
   [Vapi] Call started
   ```

2. **Listen to the call:**
   - Assistant should speak the personalized greeting
   - Should have context about the genetic condition

### **If Variables Don't Work:**

Fall back to sending context after call starts:

```typescript
vapiRef.current.on('call-start', () => {
  // Let assistant speak default greeting first
  // Then context is available via conversation history
});

vapiRef.current.on('speech-end', () => {
  // After assistant finishes first message,
  // send genetic context as system message if SDK supports it
});
```

---

## 📝 Current Workaround (Temporary)

**What's Implemented Now:**

```typescript
// Just start the call without overrides
await vapiRef.current.start(ASSISTANT_ID);
```

**Issues:**
- ❌ No personalized greeting
- ❌ No genetic context passed to AI
- ❌ Generic conversation only

**Why:**
- `assistantOverrides.firstMessage` causes 400 error
- Need to find correct Vapi SDK parameter format

---

## 🔍 Next Steps

### **Option 1: Contact Vapi Support** (Recommended)

Ask Vapi Support:
1. How to pass dynamic first message when starting a call via Web SDK?
2. Does `assistantOverrides.firstMessage` work? If not, what's the correct parameter?
3. How to pass assistant variables via `@vapi-ai/web` SDK?
4. Can we send system messages after call starts?

### **Option 2: Check Vapi Documentation**

Look for:
- `@vapi-ai/web` npm package README
- Vapi Web SDK documentation
- Example code for dynamic greetings
- GitHub issues/discussions

### **Option 3: Alternative Integration**

Instead of Web SDK, use:
- **Vapi Phone Numbers** - User calls a number, greeting configured server-side
- **Vapi Inbound Calls** - Backend initiates call with full control
- **Server-side SDK** - Backend manages the entire call flow

---

## 💡 Interim Solution

**While we figure out the SDK:**

Configure a **generic but empathetic** greeting in Vapi Assistant dashboard:

```
Hi, I'm Lucy, your genetic counselor. I'm here to help you understand your genetic testing results. I know this can be a confusing time, so please feel free to ask me anything about your results, what they mean, and what steps you might consider next.
```

**User can then provide details:**
- User: "I have a variant in the GDF5 gene"
- Assistant: "I see you have a variant in GDF5. Let me help you understand what that means..."

**Pros:**
- ✅ Works immediately (no code changes)
- ✅ Still empathetic and helpful
- ✅ User provides context naturally

**Cons:**
- ❌ Not as personalized as we wanted
- ❌ User has to repeat information they already entered

---

## 📊 Comparison

| Approach | Personalization | Complexity | Status |
|----------|----------------|------------|--------|
| **assistantOverrides.firstMessage** | ⭐⭐⭐ | Easy | ❌ 400 Error |
| **Assistant Variables** | ⭐⭐⭐ | Medium | ⚠️ Need to Test |
| **Post-call Message Injection** | ⭐⭐ | Hard | ⚠️ May not work |
| **Generic Dashboard Config** | ⭐ | Easy | ✅ Works Now |
| **Server-side Vapi SDK** | ⭐⭐⭐ | Hard | 🔄 Alternative |

---

## ✅ Action Items

**Immediate (You):**
1. ✅ Backend provides personalized greeting via `/vapi/start`
2. ⚠️ Test Vapi Assistant Variables approach
3. ⚠️ Or contact Vapi support for correct SDK usage

**Short-term:**
1. Get correct SDK parameter format from Vapi
2. Implement dynamic greeting properly
3. Test with real users

**Long-term:**
1. Consider server-side Vapi integration for full control
2. Evaluate if Web SDK limitations are acceptable
3. Document final solution for team

---

## 🆘 Support Contacts

- **Vapi Support:** support@vapi.ai
- **Vapi Documentation:** https://docs.vapi.ai
- **Vapi Discord:** (check their website)
- **GitHub Issues:** Search for `@vapi-ai/web` issues

---

## 📝 Summary

**Current Status:**
- ✅ Backend `/vapi/start` endpoint works perfectly
- ✅ Returns personalized greeting and genetic context
- ❌ Frontend can't pass greeting to Vapi (400 error)
- ⚠️ Need correct SDK usage or workaround

**Next Step:**
**Try using `variableValues` in `assistantOverrides`** instead of `firstMessage`:

```typescript
await vapiRef.current.start(ASSISTANT_ID, {
  assistantOverrides: {
    variableValues: {
      greeting: greeting,
      genetic_context: geneticContext
    }
  }
});
```

And configure your Vapi Assistant to use `{{greeting}}` in its first message template.

**If that doesn't work, contact Vapi support for the correct approach!** 🚀

