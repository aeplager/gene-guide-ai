SELECT conversation_type_id,
       name
FROM public.conversation_type
LIMIT 1000;
SELECT * FROM public.conversations_users
-- INSERT INTO public.conversation_type (conversation_type_id, name)
-- VALUES (3, 'VAPI');