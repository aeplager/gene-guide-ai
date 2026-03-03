SELECT C.created_at AT TIME ZONE 'America/Chicago' AS testdate_cst,C.id as conversation_id, CT.ordinal, CT.created_at,
       U.user_email, C.user_id, CT.role, CT.content,
       CT.feedback, CT.feedback_status
FROM public.conversations C 
INNER JOIN public.conversation_turns CT ON C.id = CT.conversation_id  
INNER JOIN public.conversations_users CU ON C.tavus_conversation_id = CU.tavus_conversation_id
INNER JOIN public.users U ON CU.user_id = U.id 
WHERE U.user_email = 'aeplager@qkss.com'
  AND CT.created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours'
ORDER BY CT.created_at DESC
LIMIT 10000;

SELECT  created_at AT TIME ZONE 'America/Chicago' AS testdate_cst
,*
FROM public.conversations 
ORDER BY created_at DESC 
LIMIT 10;

SELECT created_at AT TIME ZONE 'America/Chicago' AS testdate_cst
,*
FROM public.conversation_turns 
ORDER BY created_at DESC 
LIMIT 2;

SELECT created_at AT TIME ZONE 'America/Chicago' AS testdate_cst
,*
FROM public.conversations_users 
ORDER BY created_at DESC
LIMIT 2
;