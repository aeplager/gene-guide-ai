SELECT conversation_type_id,
       name
FROM public.conversation_type
LIMIT 1000;
SELECT * FROM public.conversations_users
-- INSERT INTO public.conversation_type (conversation_type_id, name)
-- VALUES (3, 'VAPI');


SELECT 
    C.id as conversation_id,
    CT.ordinal,
    CT.created_at,
    U.user_email,
    C.user_id,
    CT.role,
    CT.content,
    CT.feedback,
    CT.feedback_status
FROM public.conversations C 
INNER JOIN public.conversation_turns CT ON C.id = CT.conversation_id  
INNER JOIN public.conversations_users CU
    ON C.tavus_conversation_id = CU.tavus_conversation_id
INNER JOIN public.users U ON CU.user_id = U.id 
WHERE U.user_email = 'aeplager@qkss.com'  
ORDER BY CT.created_at DESC
LIMIT 1000