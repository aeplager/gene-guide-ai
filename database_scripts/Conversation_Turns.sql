SELECT conversation_id,
           created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago' AS created_at_cst,
       ordinal,       
       role,
       content,
       user_id,
       persona_id,       
       topic_id,
       feedback,
       feedback_status
FROM public.conversation_turns
ORDER BY created_at DESC, ordinal DESC
LIMIT 1000;