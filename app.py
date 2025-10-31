import os, requests
from flask import Flask, jsonify, request
import logging
from flask_cors import CORS
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import uuid
import json
import jwt
from functools import wraps

app = Flask(__name__)

# Align Flask app logger with Gunicorn and ensure INFO-level visibility
gunicorn_logger = logging.getLogger('gunicorn.error')
if gunicorn_logger.handlers:
    app.logger.handlers = gunicorn_logger.handlers
    app.logger.setLevel(gunicorn_logger.level)
else:
    logging.basicConfig(level=logging.INFO)
    app.logger.setLevel(logging.INFO)

TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID")
TAVUS_CALLBACK_URL = os.getenv("TAVUS_CALLBACK_URL", "")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
TAVUS_BASE = "https://tavusapi.com/v2"

# Database Configuration
DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")
# Strip SQLAlchemy-style prefix if present (e.g., postgresql+psycopg2://)
if DB_CONNECTION_STRING and "+psycopg2://" in DB_CONNECTION_STRING:
    DB_CONNECTION_STRING = DB_CONNECTION_STRING.replace("postgresql+psycopg2://", "postgresql://")
    app.logger.info("Converted SQLAlchemy-style connection string to psycopg2 format")
COMPANY_ID = os.getenv("COMPANY_ID", "1")

# Custom LLM Configuration
CUSTOM_LLM_BASE_URL = os.getenv("CUSTOM_LLM_BASE_URL")
CUSTOM_LLM_API_KEY = os.getenv("CUSTOM_LLM_API_KEY")
CUSTOM_LLM_PERSONA_ID = os.getenv("CUSTOM_LLM_PERSONA_ID")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_EXP_HOURS = int(os.getenv("JWT_EXP_HOURS", "12"))

# Tavus Pre-warming Configuration
TAVUS_CUSTOM_LLM_ENABLE = os.getenv("TAVUS_CUSTOM_LLM_ENABLE", "false").lower() == "true"

# Log environment variables at startup (sanitized)
app.logger.info("=" * 60)
app.logger.info("ENVIRONMENT VARIABLES AT STARTUP")
app.logger.info("=" * 60)
app.logger.info(f"TAVUS_API_KEY: {'SET' if TAVUS_API_KEY else 'NOT SET'}")
app.logger.info(f"TAVUS_REPLICA_ID: {TAVUS_REPLICA_ID or 'NOT SET'}")
app.logger.info(f"TAVUS_PERSONA_ID: {TAVUS_PERSONA_ID or 'NOT SET'}")
app.logger.info(f"CORS_ORIGINS: {CORS_ORIGINS}")
app.logger.info(f"COMPANY_ID: {COMPANY_ID}")
app.logger.info(f"CUSTOM_LLM_BASE_URL: {CUSTOM_LLM_BASE_URL or 'NOT SET'}")
app.logger.info(f"CUSTOM_LLM_API_KEY: {'SET' if CUSTOM_LLM_API_KEY else 'NOT SET'}")
app.logger.info(f"CUSTOM_LLM_PERSONA_ID: {CUSTOM_LLM_PERSONA_ID or 'NOT SET'}")
app.logger.info(f"JWT_SECRET: {'SET' if JWT_SECRET and JWT_SECRET != 'your-secret-key-change-in-production' else 'NOT SET'}")
app.logger.info(f"JWT_EXP_HOURS: {JWT_EXP_HOURS}")
app.logger.info(f"TAVUS_CUSTOM_LLM_ENABLE: {TAVUS_CUSTOM_LLM_ENABLE}")
if DB_CONNECTION_STRING:
    # Sanitize connection string for logging
    sanitized = DB_CONNECTION_STRING.split('@')[1] if '@' in DB_CONNECTION_STRING else 'MALFORMED'
    app.logger.info(f"DB_CONNECTION_STRING: postgresql://***:***@{sanitized}")
else:
    app.logger.info("DB_CONNECTION_STRING: NOT SET")
app.logger.info("=" * 60)

# Database Connection Pool
db_pool = None
if DB_CONNECTION_STRING:
    try:
        app.logger.info("Attempting to create database connection pool...")
        db_pool = psycopg2.pool.SimpleConnectionPool(1, 10, DB_CONNECTION_STRING)
        app.logger.info("✅ Database connection pool created successfully")
    except Exception as e:
        app.logger.error(f"❌ Failed to create database connection pool: {e}")
        app.logger.error(f"Error type: {type(e).__name__}")
else:
    app.logger.warning("⚠️  DB_CONNECTION_STRING not set - database endpoints will not work")

HEADERS = {"Content-Type": "application/json"}
if TAVUS_API_KEY:
    HEADERS["x-api-key"] = TAVUS_API_KEY

CORS(
    app,
    resources={
        r"/*": {"origins": CORS_ORIGINS},
    },
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],  # Allow Authorization header for JWT
    supports_credentials=True,  # Enable for auth
)

@app.before_request
def _log_request():
    try:
        app.logger.info("request %s %s", request.method, request.path)
    except Exception:
        pass

# ============================================================================
# JWT HELPER FUNCTIONS
# ============================================================================
def create_jwt_token(user_id: str, email: str, company_id: str = None) -> str:
    """Create a JWT token for authentication"""
    payload = {
        "sub": user_id,
        "email": email,
        "company_id": company_id,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXP_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_jwt_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")

def jwt_required(optional=False):
    """
    Decorator to require JWT authentication
    If optional=True, doesn't fail if token is missing but still decodes if present
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = None
            auth_header = request.headers.get('Authorization')
            
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
            
            if not token:
                if not optional:
                    app.logger.warning("jwt:missing_token endpoint=%s", request.path)
                    return jsonify({"error": "unauthorized", "message": "No token provided"}), 401
                # Optional: continue without user info
                return f(None, *args, **kwargs)
            
            try:
                payload = decode_jwt_token(token)
                app.logger.info("jwt:valid user_id=%s email=%s", payload.get('sub'), payload.get('email'))
                return f(payload, *args, **kwargs)
            except ValueError as e:
                if not optional:
                    app.logger.warning("jwt:invalid_token error=%s", str(e))
                    return jsonify({"error": "unauthorized", "message": str(e)}), 401
                # Optional: continue without user info
                return f(None, *args, **kwargs)
        return decorated_function
    return decorator

# ============================================================================
# REUSABLE CUSTOM LLM FUNCTION
# ============================================================================
def call_custom_llm(user_message: str, conversation_id: str = None, max_tokens: int = 512, stream: bool = False):
    """
    Call the custom LLM hosted on Azure Container Apps.
    
    Args:
        user_message: The user's question/prompt
        conversation_id: Optional conversation UUID (generates new one if not provided)
        max_tokens: Maximum tokens in response (default 512)
        stream: If True, returns streaming response (SSE)
    
    Returns:
        dict: Response from the LLM with structure:
            {
                "choices": [{"message": {"content": "..."}}],
                "usage": {...},
                "error": "..." (if error occurs)
            }
    
    Raises:
        ValueError: If custom LLM is not configured
        requests.RequestException: If HTTP request fails
    """
    if not all([CUSTOM_LLM_BASE_URL, CUSTOM_LLM_API_KEY, CUSTOM_LLM_PERSONA_ID]):
        raise ValueError("Custom LLM not fully configured. Check CUSTOM_LLM_BASE_URL, CUSTOM_LLM_API_KEY, and CUSTOM_LLM_PERSONA_ID")
    
    # Generate a random conversation_id if not provided
    if not conversation_id:
        conversation_id = str(uuid.uuid4())
    
    url = f"{CUSTOM_LLM_BASE_URL}/v1/chat/completions"
    
    payload = {
        "model": "custom-llm-gc",
        "conversation_id": conversation_id,
        "persona_id": CUSTOM_LLM_PERSONA_ID,
        "max_tokens": max_tokens,
        "stream": stream,
        "messages": [
            {"role": "user", "content": user_message}
        ]
    }
    
    headers = {
        "Content-Type": "application/json",
        "x-api-key": CUSTOM_LLM_API_KEY
    }
    
    app.logger.info(f"🤖 custom_llm:call conversation_id={conversation_id}")
    app.logger.info(f"🤖 custom_llm:prompt_length={len(user_message)} chars")
    
    try:
        if stream:
            # For streaming, return the response object for the caller to handle
            app.logger.info("🤖 custom_llm:streaming=True")
            resp = requests.post(url, json=payload, headers=headers, stream=True, verify=False, timeout=60)
            resp.raise_for_status()
            return resp
        else:
            # Non-streaming: return parsed JSON
            app.logger.info("🤖 custom_llm:streaming=False")
            resp = requests.post(url, json=payload, headers=headers, verify=False, timeout=60)
            resp.raise_for_status()
            result = resp.json()
            
            # Log response metadata
            if "choices" in result and len(result["choices"]) > 0:
                content = result["choices"][0].get("message", {}).get("content", "")
                app.logger.info(f"✅ custom_llm:response_length={len(content)} chars")
            
            if "usage" in result:
                app.logger.info(f"✅ custom_llm:usage={result['usage']}")
            
            return result
            
    except requests.exceptions.RequestException as e:
        app.logger.error(f"❌ custom_llm:error {type(e).__name__}: {e}")
        raise

def prewarm_custom_llm():
    """
    Pre-warm the custom LLM by calling /healthz endpoint
    This reduces cold-start latency for the first Tavus conversation
    """
    if not TAVUS_CUSTOM_LLM_ENABLE or not CUSTOM_LLM_BASE_URL:
        app.logger.info("⏭️  custom_llm:prewarm:skipped (not enabled)")
        return {"skipped": True, "reason": "not_enabled"}
    
    try:
        healthz_url = f"{CUSTOM_LLM_BASE_URL}/healthz"
        app.logger.info(f"🔥 custom_llm:prewarm:start url={healthz_url}")
        start_time = datetime.utcnow()
        
        resp = requests.get(healthz_url, timeout=20, verify=True)
        
        duration = (datetime.utcnow() - start_time).total_seconds()
        app.logger.info(f"✅ custom_llm:prewarm:success status={resp.status_code} duration={duration:.2f}s")
        
        return {
            "success": True,
            "status_code": resp.status_code,
            "duration_sec": round(duration, 2)
        }
    except Exception as e:
        app.logger.warning(f"⚠️  custom_llm:prewarm:failed error={type(e).__name__}: {e}")
        return {
            "success": False,
            "error": str(e)
        }

def resolve_system_user_id(email: str):
    """
    Resolve system user ID from email by querying public.users table
    """
    if not db_pool:
        return None
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT id FROM public.users WHERE user_email = %s', (email,))
            result = cur.fetchone()
            if result:
                app.logger.info(f"✅ resolve_user:found email={email} user_id={result['id']}")
                return str(result['id'])
            app.logger.warning(f"⚠️  resolve_user:not_found email={email}")
            return None
    except Exception as e:
        app.logger.error(f"❌ resolve_user:error {e}")
        return None
    finally:
        if conn:
            db_pool.putconn(conn)

# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/tavus/start")
@jwt_required(optional=True)
def tavus_start(user_payload):
    """
    Start a Tavus conversation with optional JWT authentication and database tracking
    """
    debug_info = {}
    
    if not (TAVUS_API_KEY and TAVUS_REPLICA_ID and TAVUS_PERSONA_ID):
        return jsonify({"error": "server_misconfigured", "debug": debug_info}), 500

    # Extract user info from JWT (optional)
    user_email = None
    jwt_user_id = None
    if user_payload:
        user_email = user_payload.get('email')
        jwt_user_id = user_payload.get('sub')
        debug_info['jwt_user_id'] = jwt_user_id
        debug_info['jwt_email'] = user_email
        app.logger.info(f"📧 tavus:start:authenticated email={user_email} jwt_user_id={jwt_user_id}")
    else:
        app.logger.info("📧 tavus:start:unauthenticated (optional JWT not provided)")
    
    # Pre-warm custom LLM if enabled
    prewarm_result = prewarm_custom_llm()
    debug_info['prewarm'] = prewarm_result

    # Build Tavus API request
    # Sanitize email for Tavus conversation name (remove special characters)
    if user_email:
        sanitized_email = user_email.replace('@', '_at_').replace('.', '_')
        conversation_name = f"Conversation - {sanitized_email}"
    else:
        conversation_name = "Conversation - Guest"
    
    body = {
        "replica_id": TAVUS_REPLICA_ID,
        "conversation_name": conversation_name,
        "persona_id": TAVUS_PERSONA_ID,
        "properties": {"enable_closed_captions": False, "enable_recording": False},
    }
    
    # Only include callback_url if it's a valid public URL (not localhost)
    if TAVUS_CALLBACK_URL and TAVUS_CALLBACK_URL.startswith("https://"):
        body["callback_url"] = TAVUS_CALLBACK_URL
    
    try:
        app.logger.info("🎥 tavus:start:request %s", {"url": f"{TAVUS_BASE}/conversations", "body": body})
        r = requests.post(f"{TAVUS_BASE}/conversations", headers=HEADERS, json=body, timeout=30)
        app.logger.info("🎥 tavus:start:response status=%s", r.status_code)
        
        try:
            tavus_response = r.json()
            app.logger.info("🎥 tavus:start:response:json %s", tavus_response)
            
            # Log each key field explicitly for debugging
            app.logger.info("=" * 80)
            app.logger.info("📹 TAVUS RESPONSE DETAILS")
            app.logger.info("=" * 80)
            app.logger.info("conversation_id: %s", tavus_response.get("conversation_id"))
            app.logger.info("conversation_name: %s", tavus_response.get("conversation_name"))
            app.logger.info("conversation_url: %s", tavus_response.get("conversation_url"))
            app.logger.info("status: %s", tavus_response.get("status"))
            app.logger.info("callback_url: %s", tavus_response.get("callback_url"))
            app.logger.info("created_at: %s", tavus_response.get("created_at"))
            app.logger.info("=" * 80)
        except ValueError:
            app.logger.warning("🎥 tavus:start:response:non_json body_len=%s", len(r.text or ""))
            raise
        
        r.raise_for_status()
        
        # Extract conversation details
        conversation_url = tavus_response.get("conversation_url")
        tavus_conversation_id = tavus_response.get("conversation_id")
        
        if not tavus_conversation_id and conversation_url:
            # Extract from URL as fallback
            tavus_conversation_id = conversation_url.split('/')[-1]
        
        debug_info['tavus_conversation_id'] = tavus_conversation_id
        debug_info['conversation_url'] = conversation_url
        
        # Track conversation in database if user is authenticated
        if user_email and db_pool and tavus_conversation_id:
            try:
                # Resolve system user ID from email
                system_user_id = resolve_system_user_id(user_email)
                if not system_user_id:
                    # Fallback to JWT sub if email lookup fails
                    system_user_id = jwt_user_id
                
                debug_info['system_user_id'] = system_user_id
                
                if system_user_id:
                    conn = db_pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO public.conversations_users 
                                (user_id, tavus_conversation_id, conversation_type_id, created_at)
                                VALUES (%s, %s, 1, (now() at time zone 'utc'))
                                """,
                                (system_user_id, tavus_conversation_id)
                            )
                            conn.commit()
                            app.logger.info(f"✅ tavus:db:tracked conversation_id={tavus_conversation_id} user_id={system_user_id}")
                            debug_info['db_tracking'] = 'success'
                    except Exception as db_err:
                        conn.rollback()
                        app.logger.error(f"❌ tavus:db:error {db_err}")
                        debug_info['db_tracking'] = f'failed: {str(db_err)}'
                    finally:
                        db_pool.putconn(conn)
                else:
                    app.logger.warning("⚠️  tavus:db:skipped (no system_user_id)")
                    debug_info['db_tracking'] = 'skipped: no_user_id'
            except Exception as e:
                app.logger.error(f"❌ tavus:db:tracking_error {e}")
                debug_info['db_tracking'] = f'error: {str(e)}'
        else:
            debug_info['db_tracking'] = 'skipped: unauthenticated or missing data'
        
        response_data = tavus_response.copy()
        response_data['debug'] = debug_info
        
        return jsonify(response_data), 200
        
    except requests.exceptions.RequestException as e:
        status = getattr(getattr(e, "response", None), "status_code", 500) or 500
        app.logger.exception("❌ tavus:start:error %s", str(e))
        debug_info['error'] = str(e)
        return jsonify({"error": "tavus_start_failed", "message": str(e), "debug": debug_info}), status

@app.post("/tavus/end/<conversation_id>")
def tavus_end(conversation_id: str):
    if not TAVUS_API_KEY:
        return jsonify({"error": "server_misconfigured"}), 500
    try:
        app.logger.info("tavus:end:request %s", {"url": f"{TAVUS_BASE}/conversations/{conversation_id}/end"})
        r = requests.post(f"{TAVUS_BASE}/conversations/{conversation_id}/end", headers=HEADERS, timeout=15)
        app.logger.info("tavus:end:response status=%s", r.status_code)
        try:
            app.logger.info("tavus:end:response:json %s", r.json())
            return jsonify({"ok": r.ok, "tavus": r.json()}), r.status_code
        except ValueError:
            app.logger.warning("tavus:end:response:non_json body_len=%s", len(r.text or ""))
            return jsonify({"ok": r.ok, "status": r.status_code}), r.status_code
    except requests.exceptions.RequestException as e:
        status = getattr(getattr(e, "response", None), "status_code", 500) or 500
        app.logger.exception("tavus:end:error %s", str(e))
        return jsonify({"error": "tavus_end_failed", "message": str(e)}), status

# Database Endpoints
@app.get("/persona-test-types")
def get_persona_test_types():
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT "PersonaTestTypeID", "PersonaTestType"
                FROM "GenCom"."PersonaTestType"
                ORDER BY "PersonaTestType"
            ''')
            results = cur.fetchall()
            return jsonify([dict(row) for row in results]), 200
    except Exception as e:
        app.logger.exception("get_persona_test_types:error %s", str(e))
        return jsonify({"error": "database_query_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.get("/classification-types")
def get_classification_types():
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT "ClassificationTypeID", "ClassificationType"
                FROM "GenCom"."ClassificationType"
                ORDER BY "ClassificationType"
            ''')
            results = cur.fetchall()
            return jsonify([dict(row) for row in results]), 200
    except Exception as e:
        app.logger.exception("get_classification_types:error %s", str(e))
        return jsonify({"error": "database_query_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.post("/base-information")
def save_base_information():
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "no_data_provided"}), 400
    
    user_id = data.get("userId")
    persona_test_type_id = data.get("personaTestTypeId")
    classification_type_id = data.get("classificationTypeId")
    uploaded = data.get("uploaded", False)
    gene = data.get("gene")
    mutation = data.get("mutation")
    
    if not user_id or not persona_test_type_id or not classification_type_id:
        return jsonify({"error": "missing_required_fields"}), 400
    
    # Validate userId is a valid UUID format
    try:
        import uuid
        uuid.UUID(str(user_id))
    except ValueError:
        app.logger.error(f"Invalid UUID format for userId: {user_id}")
        return jsonify({"error": "invalid_user_id", "message": "userId must be a valid UUID"}), 400
    
    # Log the incoming payload BEFORE database operations
    app.logger.info("=" * 80)
    app.logger.info("📝 SAVE BASE INFORMATION - INCOMING REQUEST")
    app.logger.info("=" * 80)
    app.logger.info("Full payload received: %s", data)
    app.logger.info("UserID: %s (type: %s)", user_id, type(user_id).__name__)
    app.logger.info("PersonaTestTypeID: %s (type: %s)", persona_test_type_id, type(persona_test_type_id).__name__)
    app.logger.info("ClassificationTypeID: %s (type: %s)", classification_type_id, type(classification_type_id).__name__)
    app.logger.info("Uploaded (raw): %s (type: %s)", uploaded, type(uploaded).__name__)
    app.logger.info("Gene: %s", gene)
    app.logger.info("Mutation: %s", mutation)
    app.logger.info("=" * 80)
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if record exists
            check_sql = 'SELECT "UserID" FROM "GenCom"."BaseInformation" WHERE "UserID" = %s'
            app.logger.info("🔍 CHECK SQL: %s", check_sql)
            app.logger.info("🔍 CHECK PARAMS: (%s,)", user_id)
            
            cur.execute(check_sql, (user_id,))
            exists = cur.fetchone()
            app.logger.info("🔍 Record exists: %s", bool(exists))
            
            now = datetime.utcnow()
            
            # Convert boolean to bit(1) format: '1' for true, '0' for false
            uploaded_bit = '1' if uploaded else '0'
            app.logger.info("🔄 Converted uploaded %s -> bit value '%s'", uploaded, uploaded_bit)
            
            if exists:
                # Update existing record
                update_sql = '''UPDATE "GenCom"."BaseInformation"
                    SET "PersonaTestTypeID" = %s,
                        "ClassificationTypeID" = %s,
                        "Uploaded" = %s::bit(1),
                        "Gene" = %s,
                        "Mutation" = %s,
                        "ModifiedDate" = %s
                    WHERE "UserID" = %s
                    RETURNING "UserID"'''
                update_params = (persona_test_type_id, classification_type_id, uploaded_bit, gene, mutation, now, user_id)
                
                app.logger.info("=" * 80)
                app.logger.info("🔄 EXECUTING UPDATE")
                app.logger.info("=" * 80)
                app.logger.info("SQL: %s", update_sql.strip())
                app.logger.info("PARAMS: %s", update_params)
                app.logger.info("PARAMS BREAKDOWN:")
                app.logger.info("  - PersonaTestTypeID: %s", persona_test_type_id)
                app.logger.info("  - ClassificationTypeID: %s", classification_type_id)
                app.logger.info("  - Uploaded (bit): '%s'", uploaded_bit)
                app.logger.info("  - Gene: %s", gene)
                app.logger.info("  - Mutation: %s", mutation)
                app.logger.info("  - ModifiedDate: %s", now)
                app.logger.info("  - UserID: %s", user_id)
                app.logger.info("=" * 80)
                
                cur.execute(update_sql, update_params)
                app.logger.info("✅ base_information:updated user_id=%s gene=%s uploaded=%s", user_id, gene, uploaded_bit)
            else:
                # Insert new record
                insert_sql = '''INSERT INTO "GenCom"."BaseInformation"
                    ("UserID", "PersonaTestTypeID", "ClassificationTypeID", "Uploaded", "Gene", "Mutation", "InsertDate", "ModifiedDate")
                    VALUES (%s, %s, %s, %s::bit(1), %s, %s, %s, %s)
                    RETURNING "UserID"'''
                insert_params = (user_id, persona_test_type_id, classification_type_id, uploaded_bit, gene, mutation, now, now)
                
                app.logger.info("=" * 80)
                app.logger.info("➕ EXECUTING INSERT")
                app.logger.info("=" * 80)
                app.logger.info("SQL: %s", insert_sql.strip())
                app.logger.info("PARAMS: %s", insert_params)
                app.logger.info("PARAMS BREAKDOWN:")
                app.logger.info("  - UserID: %s", user_id)
                app.logger.info("  - PersonaTestTypeID: %s", persona_test_type_id)
                app.logger.info("  - ClassificationTypeID: %s", classification_type_id)
                app.logger.info("  - Uploaded (bit): '%s'", uploaded_bit)
                app.logger.info("  - Gene: %s", gene)
                app.logger.info("  - Mutation: %s", mutation)
                app.logger.info("  - InsertDate: %s", now)
                app.logger.info("  - ModifiedDate: %s", now)
                app.logger.info("=" * 80)
                
                cur.execute(insert_sql, insert_params)
                app.logger.info("✅ base_information:inserted user_id=%s gene=%s uploaded=%s", user_id, gene, uploaded_bit)
            
            conn.commit()
            result = cur.fetchone()
            return jsonify({"success": True, "userId": result["UserID"]}), 200
            
    except Exception as e:
        if conn:
            conn.rollback()
        app.logger.exception("save_base_information:error %s", str(e))
        return jsonify({"error": "database_save_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

# Authentication Endpoints
@app.post("/auth/login")
def auth_login():
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "no_data_provided"}), 400
    
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "missing_credentials"}), 400
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Query user by email
            cur.execute('''
                SELECT id, user_email, display_name, company_id
                FROM public.users
                WHERE user_email = %s AND user_password = %s
            ''', (email, password))
            user = cur.fetchone()
            
            if user:
                user_id = str(user['id'])
                company_id = str(user['company_id']) if user['company_id'] else None
                
                # Create JWT token
                token = create_jwt_token(user_id, email, company_id)
                
                app.logger.info("auth:login:success email=%s user_id=%s", email, user_id)
                return jsonify({
                    "success": True,
                    "token": token,
                    "user": {
                        "id": user_id,
                        "email": user['user_email'],
                        "displayName": user['display_name'],
                        "companyId": company_id
                    }
                }), 200
            else:
                app.logger.warning("auth:login:failed email=%s", email)
                return jsonify({"error": "invalid_credentials", "message": "Invalid email or password"}), 401
                
    except Exception as e:
        app.logger.exception("auth:login:error %s", str(e))
        return jsonify({"error": "auth_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

# Condition Analysis Endpoint
@app.get("/condition-analysis/<user_id>")
def get_condition_analysis(user_id):
    """
    Fetch user's gene/mutation/classification and generate AI analysis using custom LLM
    """
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    app.logger.info(f"🔬 condition_analysis:request user_id={user_id}")
    
    conn = None
    try:
        # Validate user_id is a valid UUID
        try:
            uuid.UUID(str(user_id))
        except ValueError:
            app.logger.error(f"Invalid UUID format for user_id: {user_id}")
            return jsonify({"error": "invalid_user_id"}), 400
        
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch user's saved genetic information
            cur.execute('''
                SELECT 
                    bi."Gene",
                    bi."Mutation",
                    ct."ClassificationType"
                FROM "GenCom"."BaseInformation" bi
                JOIN "GenCom"."ClassificationType" ct 
                    ON bi."ClassificationTypeID" = ct."ClassificationTypeID"
                WHERE bi."UserID" = %s
            ''', (user_id,))
            
            result = cur.fetchone()
            
            if not result:
                app.logger.warning(f"⚠️  No base information found for user_id={user_id}")
                return jsonify({"error": "no_genetic_data_found", "message": "Please complete the introductory screen first"}), 404
            
            gene = result["Gene"]
            mutation = result["Mutation"]
            classification = result["ClassificationType"]
            
            # Check if required fields are present
            if not gene or not mutation:
                app.logger.warning(f"⚠️  Incomplete genetic data for user_id={user_id}")
                return jsonify({"error": "incomplete_genetic_data", "message": "Gene and Mutation are required"}), 400
            
            app.logger.info(f"📊 Retrieved: gene={gene}, mutation={mutation}, classification={classification}")
            
            # Construct the AI prompt for genetic counseling
            prompt = f"""You are a professional genetic counselor providing educational information about genetic test results. 

Given the following genetic information:
- Gene: {gene}
- Variant/Mutation: {mutation}
- Classification: {classification}

Please provide a comprehensive analysis in the following JSON format:

{{
  "condition": "Primary condition name associated with this gene variant",
  "riskLevel": "High/Moderate/Low",
  "description": "A clear, patient-friendly 2-3 sentence description of what this variant means",
  "implications": [
    "First health implication",
    "Second health implication",
    "Third health implication",
    "Fourth health implication"
  ],
  "recommendations": [
    "First recommended action",
    "Second recommended action",
    "Third recommended action",
    "Fourth recommended action"
  ],
  "resources": [
    "First educational resource name",
    "Second educational resource name",
    "Third educational resource name",
    "Fourth educational resource name"
  ]
}}

Important guidelines:
- Use clear, non-technical language suitable for patients
- Base risk level on the classification: Pathogenic/Likely Pathogenic = High, VUS = Moderate, Benign/Likely Benign = Low
- Focus on actionable information
- Include both risks and positive steps they can take
- Be compassionate and supportive in tone
- Provide specific, evidence-based information

CRITICAL: Respond ONLY with the JSON object, no additional text."""

            app.logger.info("🤖 Calling custom LLM for condition analysis...")
            
            try:
                # Call custom LLM
                llm_response = call_custom_llm(
                    user_message=prompt,
                    max_tokens=1024,
                    stream=False
                )
                
                # Extract the assistant's message
                if "choices" in llm_response and len(llm_response["choices"]) > 0:
                    ai_content = llm_response["choices"][0].get("message", {}).get("content", "")
                    app.logger.info(f"✅ Custom LLM response received: {len(ai_content)} chars")
                    
                    # Parse the JSON response
                    try:
                        # Clean the response (remove markdown code blocks if present)
                        cleaned_content = ai_content.strip()
                        if cleaned_content.startswith("```json"):
                            cleaned_content = cleaned_content[7:]
                        if cleaned_content.startswith("```"):
                            cleaned_content = cleaned_content[3:]
                        if cleaned_content.endswith("```"):
                            cleaned_content = cleaned_content[:-3]
                        cleaned_content = cleaned_content.strip()
                        
                        condition_data = json.loads(cleaned_content)
                        
                        # Add the gene, mutation, and classification to the response
                        condition_data["gene"] = gene
                        condition_data["variant"] = mutation
                        condition_data["classification"] = classification
                        
                        app.logger.info(f"✅ condition_analysis:success condition={condition_data.get('condition')}")
                        return jsonify(condition_data), 200
                        
                    except json.JSONDecodeError as je:
                        app.logger.error(f"❌ Failed to parse LLM response as JSON: {je}")
                        app.logger.error(f"Raw response (first 500 chars): {ai_content[:500]}")
                        return jsonify({
                            "error": "invalid_llm_response", 
                            "message": "The AI returned an invalid format",
                            "raw": ai_content[:500]
                        }), 500
                else:
                    app.logger.error("❌ No choices in LLM response")
                    return jsonify({"error": "empty_llm_response", "message": "The AI did not return a response"}), 500
                    
            except ValueError as ve:
                # Custom LLM not configured
                app.logger.error(f"❌ Custom LLM configuration error: {ve}")
                return jsonify({"error": "llm_not_configured", "message": str(ve)}), 500
            except Exception as llm_error:
                app.logger.exception(f"❌ Error calling custom LLM: {llm_error}")
                return jsonify({"error": "llm_call_failed", "message": str(llm_error)}), 500
            
    except Exception as e:
        app.logger.exception(f"❌ condition_analysis:error {type(e).__name__}: {e}")
        return jsonify({"error": "analysis_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

if __name__ == "__main__":
    app.run(port=8081, debug=True)


