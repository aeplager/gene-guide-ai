# Transcript Feedback Feature

## Overview
Added a comprehensive feedback system for conversation transcripts that allows users to rate each conversation turn with thumbs up/down and provide optional text feedback.

## Database Changes
Two new columns were added to the `conversation_turns` table:
- `feedback` (text): Stores optional text feedback from users
- `feedback_status` (bigint, default 0): Stores feedback status:
  - `0` = No feedback
  - `1` = Thumbs up (positive)
  - `2` = Thumbs down (negative)

**Note**: The `conversation_turns` table does not have an `id` column. Turns are identified by the composite key of `conversation_id` + `ordinal`.

## Backend Changes (`app.py`)

### Updated Endpoint: `/conversations/recent-transcript`
- Now includes `conversation_id`, `ordinal`, `feedback`, and `feedback_status` fields in the response
- **Composite Key**: Uses `conversation_id` + `ordinal` to uniquely identify each turn (no `id` column)
- These fields are essential for the frontend to display and manage feedback
- **New Feature**: Accepts optional `conversation_id` query parameter
  - When provided: Fetches complete transcript for that specific Tavus conversation (regardless of age)
  - When omitted: Fetches recent conversations from last 2 hours
  - Example: `GET /conversations/recent-transcript?conversation_id=c8c554555afdd4e1`
- Enables viewing full history of previous conversations being continued

### New Endpoint: `/conversations/turn-feedback` (POST)
- **Purpose**: Save user feedback for a specific conversation turn
- **Authentication**: Requires JWT token
- **Request Body**:
  ```json
  {
    "conversation_id": 123,
    "ordinal": 5,
    "feedback_status": 1,  // 0=none, 1=thumbs up, 2=thumbs down
    "feedback": "Optional text feedback"
  }
  ```
- **Note**: Uses composite key (conversation_id + ordinal) since conversation_turns table has no id column
- **Security**: Verifies that the turn belongs to the authenticated user before updating
- **Returns**: Success confirmation with conversation_id and ordinal

## Frontend Changes

### Both Video (`QAScreen.tsx`) and Audio (`LegacyVoiceCallPanel.tsx`) Screens

#### New UI Components
1. **Thumbs Up/Down Buttons**: 
   - Appear on the right side of each transcript turn
   - Toggle feedback status (click again to clear)
   - Highlighted when selected (thumbs up = blue, thumbs down = red)

2. **Feedback Text Area**:
   - Automatically appears when user selects thumbs up or down
   - Allows optional text feedback
   - Placeholder: "Add optional feedback comment..."

3. **Save Feedback Button**:
   - Appears in the card header when there are unsaved changes
   - Shows count of pending feedback items
   - Displays "Saving..." during save operation
   - Only visible when changes exist

4. **Visual Indicators**:
   - Unsaved changes: Turn gets a blue ring border
   - "Unsaved" badge appears next to the timestamp
   - Filled thumbs icons when feedback is selected

#### State Management
- `feedbackChanges`: Tracks all unsaved feedback modifications
- `savingFeedback`: Boolean flag for save operation state
- Feedback state is local until user clicks "Save Feedback"

#### User Flow
1. User views conversation transcript
2. User clicks thumbs up or thumbs down on any turn
3. Optional: User adds text feedback in the text area that appears
4. "Save Feedback" button appears in header showing count
5. User clicks "Save Feedback" when done
6. All feedback is saved to database in parallel
7. Success toast notification appears
8. Transcript refreshes to show saved feedback

## Features

### Batch Saving
- Users can rate multiple turns before saving
- All feedback saves simultaneously for better UX
- Single success message confirms all saves

### Persistent Feedback
- Saved feedback persists across page reloads
- Feedback state is loaded from database on page load
- Users can modify previously saved feedback

### Visual Feedback
- Clear indication of unsaved changes
- Filled icons show current feedback state
- Ring border highlights modified turns
- Toast notifications confirm actions

### Error Handling
- Authentication check before save
- Turn ownership verification on backend
- User-friendly error messages
- Failed saves don't clear unsaved changes

## Technical Details

### TypeScript Types
Updated transcript type definition to include:
```typescript
{
  conversation_id: number;  // Part of composite key
  ordinal: number;          // Part of composite key
  role: string;
  content: string | { text?: string; ... };
  created_at: string;
  feedback_status: number;
  feedback: string | null;
}
```

Feedback changes are tracked using composite key format `"conversationId-ordinal"`:
```typescript
Record<string, {
  status: number;
  text: string;
  conversation_id: number;
  ordinal: number;
}>
```

### Icons Used
- `ThumbsUp` from lucide-react (positive feedback)
- `ThumbsDown` from lucide-react (negative feedback)
- `Save` from lucide-react (save button)

### Styling
- Thumbs up selected: Default blue variant
- Thumbs down selected: Destructive red variant
- Unsaved changes: Ring border with primary color
- Textarea: Clean border with focus ring

## Testing Checklist
- [ ] Click thumbs up on a turn → Icon fills, textarea appears
- [ ] Click thumbs down on a turn → Icon fills red, textarea appears
- [ ] Click same thumb again → Clears feedback, textarea disappears
- [ ] Type text feedback → Text saves locally
- [ ] Save button appears with correct count
- [ ] Click save → Success toast, feedback persists after reload
- [ ] Modify saved feedback → Can update and re-save
- [ ] Works on both video and audio screens
- [ ] Feedback only visible/editable for authenticated users
- [ ] Cannot save feedback for turns not owned by user

## Conversation Continuation Feature

### Viewing Previous Conversation Transcript
When a user has a previous conversation that they can continue:
1. The QA screen detects the `existingConversationId` on page load
2. If the "Start new conversation" checkbox is NOT checked:
   - **Before video call starts**: The transcript automatically fetches that specific conversation
   - Full conversation history is displayed immediately (regardless of age)
   - Transcript description shows: "Showing previous conversation from [date] (most recent at top)"
3. **When video call starts**: Transcript switches to fetch all recent conversations (last 2 hours)
   - This captures both the previous conversation AND the newly active conversation
   - All messages from all conversations appear in one unified view
   - Most recent messages always appear at the top
   - Previous conversation messages naturally appear lower in the list

### Transcript Sorting
- **Always sorted by `created_at` DESC** (most recent messages at top)
- This ensures users see the latest interaction first
- When multiple conversations are shown:
  - Active conversation messages appear at top (most recent)
  - Previous conversation messages appear below (older)
  - Natural chronological flow with newest first

### Benefits
- Users can review their previous conversation before continuing
- No 2-hour time limit when viewing a specific conversation
- Seamless transition between viewing history and seeing live updates
- Clear visual indication of which conversation is being shown
- Most recent messages always visible at the top (no scrolling needed)
- Unified view of all related conversations in one place

## Future Enhancements (Optional)
- Add ability to filter transcript by feedback status
- Export transcript with feedback for analysis
- Admin dashboard to view all feedback
- Auto-save feedback after delay
- Keyboard shortcuts for quick feedback
- Conversation search and filtering by date/topic