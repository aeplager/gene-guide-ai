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
  --AND CT.created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '2 hours'
ORDER BY CT.created_at DESC
LIMIT 10000;

-- ========================================
-- DEBUG: Compare Tavus (video) vs Vapi (audio) data
-- ========================================

-- 1. Check conversations_users for Vapi entries (conversation_type_id=3)
SELECT 
    'conversations_users (Vapi)' as source,
    CU.id, 
    CU.user_id, 
    CU.tavus_conversation_id, 
    CU.conversation_type_id,
    CU.created_at AT TIME ZONE 'America/Chicago' AS created_cst,
    U.user_email
FROM public.conversations_users CU
INNER JOIN public.users U ON CU.user_id = U.id
WHERE U.user_email = 'aeplager@qkss.com' 
  AND CU.conversation_type_id = 3
ORDER BY CU.created_at DESC
LIMIT 10;

-- 2. Check conversations_users for Tavus entries (conversation_type_id=1)
SELECT 
    'conversations_users (Tavus)' as source,
    CU.id, 
    CU.user_id, 
    CU.tavus_conversation_id, 
    CU.conversation_type_id,
    CU.created_at AT TIME ZONE 'America/Chicago' AS created_cst,
    U.user_email
FROM public.conversations_users CU
INNER JOIN public.users U ON CU.user_id = U.id
WHERE U.user_email = 'aeplager@qkss.com' 
  AND CU.conversation_type_id = 1
ORDER BY CU.created_at DESC
LIMIT 10;

-- 3. Check conversations table for Vapi (type 3)
SELECT 
    'conversations (Vapi)' as source,
    C.id,
    C.user_id,
    C.tavus_conversation_id,
    C.conversation_type_id,
    C.created_at AT TIME ZONE 'America/Chicago' AS created_cst
FROM public.conversations C
WHERE C.conversation_type_id = 3
ORDER BY C.created_at DESC
LIMIT 10;

-- 4. Check conversations table for Tavus (type 1)
SELECT 
    'conversations (Tavus)' as source,
    C.id,
    C.user_id,
    C.tavus_conversation_id,
    C.conversation_type_id,
    C.created_at AT TIME ZONE 'America/Chicago' AS created_cst
FROM public.conversations C
WHERE C.conversation_type_id = 1
ORDER BY C.created_at DESC
LIMIT 10;

-- 5. CRITICAL: Check if tavus_conversation_id matches between tables (Vapi)
SELECT 
    'VAPI ID MATCH CHECK' as check_type,
    CU.tavus_conversation_id as conversations_users_id,
    C.tavus_conversation_id as conversations_id,
    CASE 
        WHEN CU.tavus_conversation_id = C.tavus_conversation_id THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status
FROM public.conversations_users CU
FULL OUTER JOIN public.conversations C 
    ON CU.tavus_conversation_id = C.tavus_conversation_id
    AND CU.conversation_type_id = 3
    AND C.conversation_type_id = 3
WHERE CU.conversation_type_id = 3 OR C.conversation_type_id = 3
ORDER BY CU.created_at DESC
LIMIT 20;

-- 6. Check conversation_turns for Vapi conversations
SELECT 
    'conversation_turns (Vapi)' as source,
    CT.id,
    CT.conversation_id,
    C.tavus_conversation_id,
    CT.ordinal,
    CT.role,
    LEFT(CT.content::text, 100) as content_preview,
    CT.created_at AT TIME ZONE 'America/Chicago' AS created_cst
FROM public.conversation_turns CT
INNER JOIN public.conversations C ON CT.conversation_id = C.id
WHERE C.conversation_type_id = 3
ORDER BY CT.created_at DESC
LIMIT 20;