import os, requests
from flask import Flask, jsonify, request
import logging
from flask_cors import CORS
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta, timezone
import uuid
import json
import jwt
from functools import wraps
import threading
from genetic_web_scraper import search_all_sources

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

# Tavus Recording Configuration (optional)
TAVUS_ENABLE_RECORDING = os.getenv("TAVUS_ENABLE_RECORDING", "false").lower() == "true"
TAVUS_RECORDING_S3_BUCKET_NAME = os.getenv("TAVUS_RECORDING_S3_BUCKET_NAME")
TAVUS_RECORDING_S3_BUCKET_REGION = os.getenv("TAVUS_RECORDING_S3_BUCKET_REGION")
TAVUS_AWS_ASSUME_ROLE_ARN = os.getenv("TAVUS_AWS_ASSUME_ROLE_ARN")

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
app.logger.info(f"TAVUS_ENABLE_RECORDING: {TAVUS_ENABLE_RECORDING}")
if TAVUS_ENABLE_RECORDING:
    app.logger.info(f"TAVUS_RECORDING_S3_BUCKET_NAME: {TAVUS_RECORDING_S3_BUCKET_NAME or 'NOT SET'}")
    app.logger.info(f"TAVUS_RECORDING_S3_BUCKET_REGION: {TAVUS_RECORDING_S3_BUCKET_REGION or 'NOT SET'}")
    app.logger.info(f"TAVUS_AWS_ASSUME_ROLE_ARN: {'SET' if TAVUS_AWS_ASSUME_ROLE_ARN else 'NOT SET'}")
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
        app.logger.info("✅ Database connection pool created successfully (min=1, max=10)")
    except Exception as e:
        app.logger.error(f"❌ Failed to create database connection pool: {e}")
        app.logger.error(f"Error type: {type(e).__name__}")
else:
    app.logger.warning("⚠️  DB_CONNECTION_STRING not set - database endpoints will not work")

def log_pool_status():
    """Log current connection pool statistics for debugging"""
    if not db_pool:
        return
    try:
        # Note: SimpleConnectionPool doesn't expose metrics directly, but we can log attempts
        app.logger.debug("📊 Connection pool status requested")
    except Exception as e:
        app.logger.error(f"Error checking pool status: {e}")

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
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
        "iat": datetime.now(timezone.utc)
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
        start_time = datetime.now(timezone.utc)
        
        resp = requests.get(healthz_url, timeout=20, verify=True)
        
        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
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

@app.get("/healthz")
def healthz():
    """
    Health check endpoint that also warms up the custom LLM
    Called by frontend on page load to reduce cold-start latency
    Returns immediately - warmup happens asynchronously
    """
    app.logger.info("🏥 healthz:request")
    
    # Always return backend healthy immediately
    response = {
        "status": "healthy",
        "backend": "ok",
        "llm_warmup": {"status": "initiated", "note": "warmup running in background"}
    }
    
    # Trigger LLM warmup in background thread (non-blocking)
    if TAVUS_CUSTOM_LLM_ENABLE and CUSTOM_LLM_BASE_URL:
        def async_warmup():
            try:
                prewarm_result = prewarm_custom_llm()
                app.logger.info(f"🔥 Background LLM warmup completed: {prewarm_result}")
            except Exception as e:
                app.logger.error(f"❌ Background LLM warmup failed: {e}")
        
        warmup_thread = threading.Thread(target=async_warmup, daemon=True)
        warmup_thread.start()
        app.logger.info("🔥 LLM warmup started in background thread")
    else:
        response["llm_warmup"] = {"skipped": True, "reason": "not_enabled"}
    
    app.logger.info(f"✅ healthz:response (instant) {response}")
    return jsonify(response), 200

@app.get("/db-health")
def db_health():
    """
    Dedicated database health check endpoint to diagnose DB performance issues
    Tests connection acquisition and simple query execution
    """
    start_time = datetime.now(timezone.utc)
    app.logger.info("🔍 db-health:start - Testing database performance")
    
    if not db_pool:
        return jsonify({
            "status": "error",
            "error": "database_not_configured",
            "message": "DB_CONNECTION_STRING not set"
        }), 500
    
    conn = None
    timings = {}
    
    try:
        # Step 1: Test connection acquisition
        conn_start = datetime.now(timezone.utc)
        conn = db_pool.getconn()
        conn_time = (datetime.now(timezone.utc) - conn_start).total_seconds()
        timings['connection_acquisition_ms'] = round(conn_time * 1000, 2)
        app.logger.info(f"🔍 db-health: Connection acquired in {timings['connection_acquisition_ms']}ms")
        
        # Step 2: Test simple query
        query_start = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute("SELECT 1 as test")
            result = cur.fetchone()
        query_time = (datetime.now(timezone.utc) - query_start).total_seconds()
        timings['simple_query_ms'] = round(query_time * 1000, 2)
        app.logger.info(f"🔍 db-health: Simple query executed in {timings['simple_query_ms']}ms")
        
        # Step 3: Test realistic query (count users)
        realistic_start = datetime.now(timezone.utc)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM public.users")
            count = cur.fetchone()[0]
        realistic_time = (datetime.now(timezone.utc) - realistic_start).total_seconds()
        timings['realistic_query_ms'] = round(realistic_time * 1000, 2)
        timings['user_count'] = count
        app.logger.info(f"🔍 db-health: Realistic query executed in {timings['realistic_query_ms']}ms (found {count} users)")
        
        # Step 4: Return connection to pool
        return_start = datetime.now(timezone.utc)
        db_pool.putconn(conn)
        conn = None  # Mark as returned
        return_time = (datetime.now(timezone.utc) - return_start).total_seconds()
        timings['connection_return_ms'] = round(return_time * 1000, 2)
        
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        timings['total_ms'] = round(total_time * 1000, 2)
        
        app.logger.info(f"✅ db-health: SUCCESS - Total time {timings['total_ms']}ms")
        
        # Performance assessment
        assessment = "excellent"
        if timings['connection_acquisition_ms'] > 2000:
            assessment = "poor - connection acquisition very slow (>2s)"
        elif timings['connection_acquisition_ms'] > 500:
            assessment = "fair - connection acquisition slow (>500ms)"
        elif timings['simple_query_ms'] > 500:
            assessment = "poor - query execution slow (>500ms)"
        elif timings['total_ms'] > 3000:
            assessment = "fair - total time slow (>3s)"
        
        return jsonify({
            "status": "healthy",
            "database": "ok",
            "timings": timings,
            "assessment": assessment,
            "note": "If connection_acquisition_ms > 2000ms, issue is likely network latency to Azure Postgres"
        }), 200
        
    except Exception as e:
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        timings['total_ms'] = round(total_time * 1000, 2)
        app.logger.exception(f"❌ db-health: FAILED after {timings['total_ms']}ms - {e}")
        return jsonify({
            "status": "error",
            "error": str(e),
            "timings": timings
        }), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.get("/tavus/start")
@jwt_required(optional=True)
def tavus_start(user_payload):
    """
    Start a Tavus conversation with optional JWT authentication and database tracking
    Supports continuing existing conversations via ?continue_conversation_id=xxx
    """
    debug_info = {}
    
    # Check if we should continue an existing conversation
    continue_conversation_id = request.args.get('continue_conversation_id')
    if continue_conversation_id:
        app.logger.info(f"🔄 tavus:start: Continuing conversation {continue_conversation_id}")
        debug_info['continuing_conversation'] = continue_conversation_id
    
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
    
    # Note: LLM pre-warming is handled by frontend on page load (QAScreen.tsx)
    # No need to block here - frontend already warmed up via /healthz
    app.logger.info("⏭️  Skipping backend LLM pre-warm (frontend already handles this)")

    # Fetch user's genetic information from database to provide context to AI counselor
    genetic_context = None
    custom_greeting = None
    if jwt_user_id and db_pool:
        conn = None
        try:
            conn = db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Fetch base information and analysis
                cur.execute('''
                    SELECT 
                        bi.gene,
                        bi.mutation,
                        ct.classification_type,
                        bi.cached_analysis_basic
                    FROM gencom.base_information bi
                    LEFT JOIN gencom.classification_type ct 
                        ON bi.classification_type_id = ct.classification_type_id
                    WHERE bi.user_id = %s
                ''', (jwt_user_id,))
                
                result = cur.fetchone()
                if result:
                    gene = result.get("gene", "").strip()
                    mutation = result.get("mutation", "").strip()
                    classification = result.get("classification_type", "").strip()
                    
                    # Parse cached analysis for condition and description
                    condition = None
                    description = None
                    if result.get("cached_analysis_basic"):
                        try:
                            cached = json.loads(result["cached_analysis_basic"])
                            condition = cached.get("condition")
                            description = cached.get("description")
                        except json.JSONDecodeError:
                            pass
                    
                    # If cache is empty, generate condition & description on-the-fly
                    if not condition or not description:
                        app.logger.info("🔄 Cache empty - generating condition & description for greeting...")
                        
                        # Build prompt for basic analysis
                        basic_prompt = f"""You are a professional genetic counselor providing educational information about genetic test results. 

Given the following genetic information:
- Gene: {gene}
- Variant/Mutation: {mutation}
- Classification: {classification}

Please provide a BRIEF initial analysis in the following JSON format:

{{
  "condition": "Primary condition name associated with this gene variant",
  "riskLevel": "High/Moderate/Low",
  "description": "A clear, patient-friendly 2-3 sentence description of what this variant means"
}}

CRITICAL: Respond ONLY with the JSON object, no additional text."""
                        
                        try:
                            llm_response = call_custom_llm(
                                user_message=basic_prompt,
                                max_tokens=512,
                                stream=False
                            )
                            
                            if "choices" in llm_response and len(llm_response["choices"]) > 0:
                                ai_content = llm_response["choices"][0].get("message", {}).get("content", "")
                                
                                # Parse JSON from LLM response
                                cleaned_content = ai_content.strip()
                                if cleaned_content.startswith("```json"):
                                    cleaned_content = cleaned_content[7:]
                                if cleaned_content.startswith("```"):
                                    cleaned_content = cleaned_content[3:]
                                if cleaned_content.endswith("```"):
                                    cleaned_content = cleaned_content[:-3]
                                cleaned_content = cleaned_content.strip()
                                
                                basic_data = json.loads(cleaned_content)
                                condition = basic_data.get("condition")
                                description = basic_data.get("description")
                                
                                # Cache the result for future use
                                cache_json = json.dumps(basic_data)
                                cur.execute('''
                                    UPDATE gencom.base_information
                                    SET cached_analysis_basic = %s,
                                        analysis_cached_at = (now() at time zone 'utc')
                                    WHERE user_id = %s
                                ''', (cache_json, jwt_user_id))
                                conn.commit()
                                
                                app.logger.info(f"✅ Generated and cached basic analysis: condition={condition}")
                        except Exception as llm_error:
                            app.logger.error(f"❌ Failed to generate basic analysis: {llm_error}")
                            # Continue without greeting rather than failing the whole request
                    
                    # Build custom greeting for Tavus conversation
                    if condition and description:
                        custom_greeting = f"Hi I understand you're here to talk about the results of your genetic testing. From what I can gather you are talking about {condition}. {description} I know these kinds of results can bring up questions or uncertainties. I'm here to help you understand them fully, so please feel free to ask any questions or share any concerns you have."
                        app.logger.info(f"👋 Custom greeting created for condition: {condition}")
                    else:
                        app.logger.info("⚠️  Skipping custom greeting - condition or description not available")
                    
                    # Build context string for Tavus AI counselor
                    context_parts = [f"""Patient Genetic Information:
- Gene: {gene}
- Variant/Mutation: {mutation}
- Classification: {classification}
- Condition: {condition or 'Pending analysis'}
- Description: {description or 'Analysis in progress'}

Please use this information to provide personalized genetic counseling to the patient."""]
                    
                    # Add continuation context if resuming a previous conversation
                    if continue_conversation_id:
                        context_parts.append(f"\n\nIMPORTANT: This is a continuation of a previous conversation (ID: {continue_conversation_id}). Please reference and build upon the previous discussion context when appropriate.")
                    
                    genetic_context = "\n".join(context_parts)
                    
                    app.logger.info(f"🧬 Genetic context loaded for user {jwt_user_id}: gene={gene}, mutation={mutation}")
                else:
                    app.logger.warning(f"⚠️  No genetic data found for user {jwt_user_id}")
        except Exception as e:
            app.logger.error(f"❌ Error fetching genetic context: {e}")
        finally:
            if conn:
                db_pool.putconn(conn)

    # Build Tavus API request
    # Sanitize email for Tavus conversation name (remove special characters)
    if user_email:
        sanitized_email = user_email.replace('@', '_at_').replace('.', '_')
        conversation_name = f"Conversation - {sanitized_email}"
    else:
        conversation_name = "Conversation - Guest"
    
    # Build properties with conditional recording configuration
    properties = {
        "enable_closed_captions": False,
        "enable_recording": TAVUS_ENABLE_RECORDING
    }
    
    # Add S3 recording config if recording is enabled
    if TAVUS_ENABLE_RECORDING:
        if TAVUS_RECORDING_S3_BUCKET_NAME:
            properties["recording_s3_bucket_name"] = TAVUS_RECORDING_S3_BUCKET_NAME
        if TAVUS_RECORDING_S3_BUCKET_REGION:
            properties["recording_s3_bucket_region"] = TAVUS_RECORDING_S3_BUCKET_REGION
        if TAVUS_AWS_ASSUME_ROLE_ARN:
            properties["aws_assume_role_arn"] = TAVUS_AWS_ASSUME_ROLE_ARN
        
        app.logger.info(f"📹 Recording enabled with S3 bucket: {TAVUS_RECORDING_S3_BUCKET_NAME}")
    else:
        app.logger.info("📹 Recording disabled")
    
    body = {
        "replica_id": TAVUS_REPLICA_ID,
        "conversation_name": conversation_name,
        "persona_id": TAVUS_PERSONA_ID,
        "properties": properties,
    }
    
    # Add genetic context if available (provides personalized patient info to AI counselor)
    if genetic_context:
        body["conversational_context"] = genetic_context
        app.logger.info("🧬 Added genetic context to Tavus conversation")
    
    # Add custom greeting if available (personalized opening message)
    if custom_greeting:
        body["custom_greeting"] = custom_greeting
        app.logger.info(f"👋 Added custom greeting to Tavus conversation: {custom_greeting[:50]}...")
    
    # Only include callback_url if it's a valid public URL (not localhost)
    if TAVUS_CALLBACK_URL and TAVUS_CALLBACK_URL.startswith("https://"):
        body["callback_url"] = TAVUS_CALLBACK_URL
    
    # Log the complete Tavus API request payload for verification
    app.logger.info("=" * 80)
    app.logger.info("📤 TAVUS API REQUEST PAYLOAD")
    app.logger.info("=" * 80)
    app.logger.info("URL: %s", f"{TAVUS_BASE}/conversations")
    app.logger.info("replica_id: %s", body.get("replica_id"))
    app.logger.info("persona_id: %s", body.get("persona_id"))
    app.logger.info("conversation_name: %s", body.get("conversation_name"))
    app.logger.info("callback_url: %s", body.get("callback_url", "NOT SET"))
    app.logger.info("-" * 80)
    app.logger.info("📹 PROPERTIES (Recording Configuration):")
    for key, value in body.get("properties", {}).items():
        app.logger.info("  %s: %s", key, value)
    app.logger.info("-" * 80)
    if "conversational_context" in body:
        context_preview = body["conversational_context"][:100] + "..." if len(body["conversational_context"]) > 100 else body["conversational_context"]
        app.logger.info("conversational_context: %s", context_preview)
    if "custom_greeting" in body:
        greeting_preview = body["custom_greeting"][:100] + "..." if len(body["custom_greeting"]) > 100 else body["custom_greeting"]
        app.logger.info("custom_greeting: %s", greeting_preview)
    app.logger.info("=" * 80)
    app.logger.info("FULL PAYLOAD (JSON):")
    app.logger.info("%s", json.dumps(body, indent=2))
    app.logger.info("=" * 80)
    
    try:
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

@app.get("/vapi/start")
@jwt_required(optional=True)
def vapi_start(user_payload):
    """
    Prepare Vapi audio consultation with personalized greeting
    Similar to /tavus/start but for audio-only consultations via Vapi.ai
    """
    app.logger.info("🎙️ vapi:start:request")
    
    # Extract user info from JWT (optional)
    user_email = None
    jwt_user_id = None
    if user_payload:
        user_email = user_payload.get('email')
        jwt_user_id = user_payload.get('sub')
        app.logger.info(f"📧 vapi:start:authenticated email={user_email} jwt_user_id={jwt_user_id}")
    else:
        app.logger.info("📧 vapi:start:unauthenticated (optional JWT not provided)")
    
    # Fetch user's genetic information from database to create personalized greeting
    custom_greeting = None
    genetic_context = None
    
    if jwt_user_id and db_pool:
        conn = None
        try:
            conn = db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Fetch base information and analysis
                cur.execute('''
                    SELECT 
                        bi.gene,
                        bi.mutation,
                        ct.classification_type,
                        bi.cached_analysis_basic
                    FROM gencom.base_information bi
                    LEFT JOIN gencom.classification_type ct 
                        ON bi.classification_type_id = ct.classification_type_id
                    WHERE bi.user_id = %s
                ''', (jwt_user_id,))
                
                result = cur.fetchone()
                if result:
                    gene = result.get("gene", "").strip()
                    mutation = result.get("mutation", "").strip()
                    classification = result.get("classification_type", "").strip()
                    
                    # Parse cached analysis for condition and description
                    condition = None
                    description = None
                    if result.get("cached_analysis_basic"):
                        try:
                            cached = json.loads(result["cached_analysis_basic"])
                            condition = cached.get("condition")
                            description = cached.get("description")
                        except json.JSONDecodeError:
                            pass
                    
                    # If cache is empty, generate condition & description on-the-fly
                    if not condition or not description:
                        app.logger.info("🔄 vapi: Cache empty - generating condition & description for greeting...")
                        
                        # Build prompt for basic analysis
                        basic_prompt = f"""You are a professional genetic counselor providing educational information about genetic test results. 

Given the following genetic information:
- Gene: {gene}
- Variant/Mutation: {mutation}
- Classification: {classification}

Please provide a BRIEF initial analysis in the following JSON format:

{{
  "condition": "Primary condition name associated with this gene variant",
  "riskLevel": "High/Moderate/Low",
  "description": "A clear, patient-friendly 2-3 sentence description of what this variant means"
}}

CRITICAL: Respond ONLY with the JSON object, no additional text."""
                        
                        try:
                            llm_response = call_custom_llm(
                                user_message=basic_prompt,
                                max_tokens=512,
                                stream=False
                            )
                            
                            if "choices" in llm_response and len(llm_response["choices"]) > 0:
                                ai_content = llm_response["choices"][0].get("message", {}).get("content", "")
                                
                                # Parse JSON from LLM response
                                cleaned_content = ai_content.strip()
                                if cleaned_content.startswith("```json"):
                                    cleaned_content = cleaned_content[7:]
                                if cleaned_content.startswith("```"):
                                    cleaned_content = cleaned_content[3:]
                                if cleaned_content.endswith("```"):
                                    cleaned_content = cleaned_content[:-3]
                                cleaned_content = cleaned_content.strip()
                                
                                basic_data = json.loads(cleaned_content)
                                condition = basic_data.get("condition")
                                description = basic_data.get("description")
                                
                                # Cache the result for future use
                                cache_json = json.dumps(basic_data)
                                cur.execute('''
                                    UPDATE gencom.base_information
                                    SET cached_analysis_basic = %s,
                                        analysis_cached_at = (now() at time zone 'utc')
                                    WHERE user_id = %s
                                ''', (cache_json, jwt_user_id))
                                conn.commit()
                                
                                app.logger.info(f"✅ vapi: Generated and cached basic analysis: condition={condition}")
                        except Exception as llm_error:
                            app.logger.error(f"❌ vapi: Failed to generate basic analysis: {llm_error}")
                    
                    # Build custom greeting for Vapi conversation (same format as Tavus)
                    if condition and description:
                        custom_greeting = f"Hi I understand you're here to talk about the results of your genetic testing. From what I can gather you are talking about {condition}. {description} I know these kinds of results can bring up questions or uncertainties. I'm here to help you understand them fully, so please feel free to ask any questions or share any concerns you have."
                        app.logger.info(f"👋 vapi: Custom greeting created for condition: {condition}")
                    else:
                        # Fallback to generic greeting if no genetic data
                        custom_greeting = "Hi, I'm here to help you understand your genetic testing results. Please feel free to ask any questions or share any concerns you have."
                        app.logger.info("⚠️  vapi: Using generic greeting - condition or description not available")
                    
                    # Build context string for Vapi AI counselor
                    genetic_context = f"""Patient Genetic Information:
- Gene: {gene}
- Variant/Mutation: {mutation}
- Classification: {classification}
- Condition: {condition or 'Pending analysis'}
- Description: {description or 'Analysis in progress'}

Please use this information to provide personalized genetic counseling to the patient."""
                    
                    app.logger.info(f"🧬 vapi: Genetic context loaded for user {jwt_user_id}: gene={gene}, mutation={mutation}")
                else:
                    app.logger.warning(f"⚠️  vapi: No genetic data found for user {jwt_user_id}")
                    custom_greeting = "Hi, I'm here to help you understand your genetic testing results. Please feel free to ask any questions or share any concerns you have."
        except Exception as e:
            app.logger.error(f"❌ vapi: Error fetching genetic context: {e}")
            custom_greeting = "Hi, I'm here to help you understand your genetic testing results. Please feel free to ask any questions or share any concerns you have."
        finally:
            if conn:
                db_pool.putconn(conn)
    else:
        # Unauthenticated user - use generic greeting
        custom_greeting = "Hi, I'm here to help you understand your genetic testing results. Please feel free to ask any questions or share any concerns you have."
        app.logger.info("👋 vapi: Using generic greeting for unauthenticated user")
    
    # Return configuration for frontend to use
    response = {
        "greeting": custom_greeting,
        "genetic_context": genetic_context,
        "user_email": user_email,
        "authenticated": bool(jwt_user_id)
    }
    
    app.logger.info(f"✅ vapi:start:success greeting_length={len(custom_greeting)} authenticated={bool(jwt_user_id)}")
    return jsonify(response), 200

@app.get("/tavus/conversation-id/recent")
@jwt_required()
def get_recent_tavus_conversation(user_payload):
    """
    Fetch the most recent tavus_conversation_id for the authenticated user
    Used to continue existing conversations instead of starting new ones
    """
    user_email = user_payload.get('email')
    
    if not user_email:
        app.logger.warning("⚠️  recent-conversation: No email in JWT")
        return jsonify({"error": "No email in JWT"}), 400
    
    if not db_pool:
        app.logger.error("❌ recent-conversation: Database not configured")
        return jsonify({"error": "Database not configured"}), 500
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch most recent conversation_id using the provided SQL
            cur.execute("""
                SELECT C.tavus_conversation_id, CU.created_at
                FROM public.conversations C 
                INNER JOIN public.conversation_turns CT ON C.id = CT.conversation_id 
                INNER JOIN public.conversations_users CU ON C.tavus_conversation_id = CU.tavus_conversation_id
                INNER JOIN public.users U ON CU.user_id = U.id
                WHERE U.user_email = %s
                ORDER BY CU.created_at DESC 
                LIMIT 1
            """, (user_email,))
            
            result = cur.fetchone()
            
            if result:
                conversation_id = result['tavus_conversation_id']
                created_at = result['created_at']
                app.logger.info(f"✅ recent-conversation: Found {conversation_id} for {user_email} (created: {created_at})")
                
                return jsonify({
                    "conversation_id": conversation_id,
                    "created_at": created_at.isoformat() if created_at else None,
                    "found": True
                }), 200
            else:
                app.logger.info(f"ℹ️  recent-conversation: No previous conversation found for {user_email}")
                return jsonify({
                    "found": False
                }), 200
            
    except Exception as e:
        app.logger.error(f"❌ recent-conversation: Error fetching: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.get("/conversations/recent-transcript")
@jwt_required()
def get_recent_transcript(user_payload):
    """
    Fetch recent conversation transcript for authenticated user (last 2 hours by default)
    OR fetch a specific conversation by tavus_conversation_id if provided
    Used by both Tavus video and Vapi audio to display live transcripts.
    The custom LLM automatically stores all conversation turns in the database.
    
    Query Parameters:
    - conversation_id (optional): Fetch transcript for a specific Tavus conversation ID
    """
    user_email = user_payload.get('email')
    conversation_id = request.args.get('conversation_id', None)
    
    if not user_email:
        app.logger.warning("⚠️  transcript: No email in JWT")
        return jsonify({"error": "No email in JWT"}), 400
    
    if not db_pool:
        app.logger.error("❌ transcript: Database not configured")
        return jsonify({"error": "Database not configured"}), 500
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch transcript using conversations_users table (for Tavus)
            # This matches the user's SQL query structure
            
            if conversation_id:
                # Fetch specific conversation (regardless of age)
                # Sort by created_at DESC so most recent messages appear first
                app.logger.info(f"📋 transcript: Fetching specific conversation {conversation_id} for {user_email}")
                cur.execute("""
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
                    WHERE U.user_email = %s
                      AND C.tavus_conversation_id = %s
                    ORDER BY CT.created_at DESC
                    LIMIT 10000
                """, (user_email, conversation_id))
            else:
                # Fetch recent conversations (last 2 hours)
                # Sort by created_at DESC so most recent messages appear first
                app.logger.info(f"📋 transcript: Fetching recent (2h) conversations for {user_email}")
                cur.execute("""
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
                    WHERE U.user_email = %s
                      AND CT.created_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '2 hours'
                    ORDER BY CT.created_at DESC
                    LIMIT 10000
                """, (user_email,))
            
            turns = cur.fetchall()
            
            app.logger.info(f"✅ transcript: Fetched {len(turns)} turns for {user_email}")
            
            return jsonify({
                "turns": [dict(t) for t in turns],
                "count": len(turns),
                "conversation_id": conversation_id
            }), 200
            
    except Exception as e:
        app.logger.error(f"❌ transcript: Error fetching: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.post("/conversations/turn-feedback")
@jwt_required()
def save_turn_feedback(user_payload):
    """
    Save feedback for a conversation turn.
    Expects: { "conversation_id": int, "ordinal": int, "feedback_status": int (1=thumbs up, 2=thumbs down), "feedback": str (optional) }
    """
    user_email = user_payload.get('email')
    
    if not user_email:
        app.logger.warning("⚠️  feedback: No email in JWT")
        return jsonify({"error": "No email in JWT"}), 400
    
    if not db_pool:
        app.logger.error("❌ feedback: Database not configured")
        return jsonify({"error": "Database not configured"}), 500
    
    data = request.get_json()
    
    # Defensive type conversion
    try:
        # conversation_id might be a UUID string or an integer ID
        conversation_id = data.get('conversation_id')
        ordinal = int(data.get('ordinal'))
        feedback_status = int(data.get('feedback_status', 0))
    except (TypeError, ValueError) as e:
        app.logger.warning(f"⚠️  feedback: Invalid data types in request: {e}")
        return jsonify({"error": "ordinal and feedback_status must be integers"}), 400
        
    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400
        
    feedback = data.get('feedback', '')
    
    if feedback_status not in [0, 1, 2]:
        return jsonify({"error": "feedback_status must be 0, 1, or 2"}), 400
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Verify that this turn belongs to the user
            # We use a simpler check: does the conversation belong to the user?
            app.logger.info(f"🔍 feedback: Verifying ownership for conv={conversation_id} user={user_email}")
            cur.execute("""
                SELECT 1
                FROM public.conversations C
                INNER JOIN public.conversations_users CU ON C.tavus_conversation_id = CU.tavus_conversation_id
                INNER JOIN public.users U ON CU.user_id = U.id
                WHERE C.id = %s AND U.user_email = %s
            """, (conversation_id, user_email))
            
            if not cur.fetchone():
                app.logger.warning(f"⚠️  feedback: Conversation {conversation_id} not found or not owned by {user_email}")
                return jsonify({"error": "Unauthorized: You do not own this conversation"}), 403
            
            # Update feedback
            app.logger.info(f"💾 feedback: Updating turn {conversation_id}-{ordinal} with status={feedback_status}")
            cur.execute("""
                UPDATE public.conversation_turns
                SET feedback_status = %s, feedback = %s
                WHERE conversation_id = %s AND ordinal = %s
            """, (feedback_status, feedback, conversation_id, ordinal))
            
            if cur.rowcount == 0:
                app.logger.warning(f"⚠️  feedback: No rows updated for turn {conversation_id}-{ordinal}")
                return jsonify({"error": "Turn not found"}), 404
                
            conn.commit()
            app.logger.info(f"✅ feedback: Successfully saved for {user_email}")
            
            return jsonify({"success": True, "conversation_id": conversation_id, "ordinal": ordinal}), 200
            
    except Exception as e:
        if conn:
            conn.rollback()
        app.logger.error(f"❌ feedback: Error saving: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

# Database Endpoints
@app.get("/persona-test-types")
def get_persona_test_types():
    start_time = datetime.now(timezone.utc)
    app.logger.info("⏱️ persona-test-types:start")
    
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    conn = None
    try:
        db_start = datetime.now(timezone.utc)
        conn = db_pool.getconn()
        db_conn_time = (datetime.now(timezone.utc) - db_start).total_seconds()
        
        query_start = datetime.now(timezone.utc)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT persona_test_type_id, persona_test_type
                FROM gencom.persona_test_type
                ORDER BY persona_test_type
            ''')
            results = cur.fetchall()
        query_time = (datetime.now(timezone.utc) - query_start).total_seconds()
        
        # Transform snake_case keys to PascalCase for frontend compatibility
        transformed_results = [
            {
                "PersonaTestTypeID": row["persona_test_type_id"],
                "PersonaTestType": row["persona_test_type"]
            }
            for row in results
        ]
        
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        app.logger.info(f"✅ persona-test-types:success conn={db_conn_time:.3f}s query={query_time:.3f}s total={total_time:.3f}s")
        
        return jsonify(transformed_results), 200
    except Exception as e:
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        app.logger.exception(f"❌ get_persona_test_types:error {str(e)} total={total_time:.3f}s")
        return jsonify({"error": "database_query_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.get("/classification-types")
def get_classification_types():
    start_time = datetime.now(timezone.utc)
    app.logger.info("⏱️ classification-types:start")
    
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    conn = None
    try:
        db_start = datetime.now(timezone.utc)
        conn = db_pool.getconn()
        db_conn_time = (datetime.now(timezone.utc) - db_start).total_seconds()
        
        query_start = datetime.now(timezone.utc)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT classification_type_id, classification_type
                FROM gencom.classification_type
                ORDER BY classification_type
            ''')
            results = cur.fetchall()
        query_time = (datetime.now(timezone.utc) - query_start).total_seconds()
        
        # Transform snake_case keys to PascalCase for frontend compatibility
        transformed_results = [
            {
                "ClassificationTypeID": row["classification_type_id"],
                "ClassificationType": row["classification_type"]
            }
            for row in results
        ]
        
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        app.logger.info(f"✅ classification-types:success conn={db_conn_time:.3f}s query={query_time:.3f}s total={total_time:.3f}s")
        
        return jsonify(transformed_results), 200
    except Exception as e:
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        app.logger.exception(f"❌ get_classification_types:error {str(e)} total={total_time:.3f}s")
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
            check_sql = 'SELECT user_id FROM gencom.base_information WHERE user_id = %s'
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
                # Update existing record and clear cached analysis (will regenerate on next visit)
                update_sql = '''UPDATE gencom.base_information
                    SET persona_test_type_id = %s,
                        classification_type_id = %s,
                        uploaded = %s::bit(1),
                        gene = %s,
                        mutation = %s,
                        modified_date = %s,
                        cached_analysis_basic = NULL,
                        cached_analysis_detailed = NULL,
                        analysis_cached_at = NULL,
                        source_document = NULL,
                        source_url = NULL,
                        source_retrieved_at = NULL
                    WHERE user_id = %s
                    RETURNING user_id'''
                update_params = (persona_test_type_id, classification_type_id, uploaded_bit, gene, mutation, now, user_id)
                
                app.logger.info("🗑️  Clearing cached analysis - genetic data changed")
                
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
                # Insert new record (cache fields will be NULL, analysis will generate on first visit)
                insert_sql = '''INSERT INTO gencom.base_information
                    (user_id, persona_test_type_id, classification_type_id, uploaded, gene, mutation, insert_date, modified_date)
                    VALUES (%s, %s, %s, %s::bit(1), %s, %s, %s, %s)
                    RETURNING user_id'''
                insert_params = (user_id, persona_test_type_id, classification_type_id, uploaded_bit, gene, mutation, now, now)
                
                app.logger.info("ℹ️  Cache will be generated on first visit to /conditions page")
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
            
            # Fetch classification type name for the background job
            cur.execute('''
                SELECT classification_type
                FROM gencom.classification_type
                WHERE classification_type_id = %s
            ''', (classification_type_id,))
            classification_row = cur.fetchone()
            classification_name = classification_row["classification_type"] if classification_row else "Unknown"
            
            # Trigger async background job to pre-generate basic analysis
            # This way, by the time user navigates to /conditions, cache is ready!
            # Capture variables in the closure
            saved_gene = gene
            saved_mutation = mutation
            saved_classification = classification_name
            saved_user_id = user_id
            
            def async_generate_full_analysis():
                try:
                    app.logger.info(f"🔄 Background: Starting web scraping + analysis generation for user {saved_user_id}")
                    
                    # STEP 0: Fetch web sources (ClinVar + MedlinePlus)
                    app.logger.info(f"🌐 Background: Fetching ClinVar and MedlinePlus data for {saved_gene} {saved_mutation}")
                    try:
                        web_results = search_all_sources(saved_gene, saved_mutation)
                        
                        # Extract URLs
                        urls = []
                        if "error" not in web_results.get("clinvar", {}):
                            urls.append(web_results["clinvar"]["url"])
                        if "error" not in web_results.get("medlineplus", {}):
                            urls.append(web_results["medlineplus"]["url"])
                        
                        source_url = "; ".join(urls) if urls else None
                        source_document = web_results.get("combined_text") if urls else None
                        
                        # Store web sources in database
                        if source_document:
                            bg_conn_web = db_pool.getconn()
                            try:
                                with bg_conn_web.cursor() as bg_cur_web:
                                    bg_cur_web.execute('''
                                        UPDATE gencom.base_information
                                        SET source_document = %s,
                                            source_url = %s,
                                            source_retrieved_at = (now() at time zone 'utc')
                                        WHERE user_id = %s
                                    ''', (source_document, source_url, saved_user_id))
                                    bg_conn_web.commit()
                                app.logger.info(f"✅ Background: Stored web sources for user {saved_user_id} from {', '.join(web_results['sources_used'])}")
                            finally:
                                db_pool.putconn(bg_conn_web)
                        else:
                            app.logger.warning(f"⚠️ Background: No web sources fetched for {saved_gene} {saved_mutation}")
                    
                    except Exception as web_error:
                        app.logger.error(f"❌ Background: Web scraping failed: {web_error}")
                        # Continue with LLM analysis even if web scraping fails
                    
                    # STEP 1: Generate BASIC analysis (condition, risk, description)
                    basic_prompt = f"""You are a professional genetic counselor providing educational information about genetic test results. 

Given the following genetic information:
- Gene: {saved_gene}
- Variant/Mutation: {saved_mutation}
- Classification: {saved_classification}

Please provide a BRIEF initial analysis in the following JSON format:

{{
  "condition": "Primary condition name associated with this gene variant",
  "riskLevel": "High/Moderate/Low",
  "description": "A clear, patient-friendly 2-3 sentence description of what this variant means"
}}

CRITICAL: Respond ONLY with the JSON object, no additional text."""
                    
                    llm_response = call_custom_llm(
                        user_message=basic_prompt,
                        max_tokens=512,
                        stream=False
                    )
                    
                    basic_data = None
                    if "choices" in llm_response and len(llm_response["choices"]) > 0:
                        ai_content = llm_response["choices"][0].get("message", {}).get("content", "")
                        
                        # Parse JSON from LLM response
                        cleaned_content = ai_content.strip()
                        if cleaned_content.startswith("```json"):
                            cleaned_content = cleaned_content[7:]
                        if cleaned_content.startswith("```"):
                            cleaned_content = cleaned_content[3:]
                        if cleaned_content.endswith("```"):
                            cleaned_content = cleaned_content[:-3]
                        cleaned_content = cleaned_content.strip()
                        
                        basic_data = json.loads(cleaned_content)
                        
                        # Cache basic result
                        basic_json = json.dumps(basic_data)
                        bg_conn = db_pool.getconn()
                        try:
                            with bg_conn.cursor() as bg_cur:
                                bg_cur.execute('''
                                    UPDATE gencom.base_information
                                    SET cached_analysis_basic = %s,
                                        analysis_cached_at = (now() at time zone 'utc')
                                    WHERE user_id = %s
                                ''', (basic_json, saved_user_id))
                                bg_conn.commit()
                            
                            app.logger.info(f"✅ Background: Cached basic analysis for user {saved_user_id}: condition={basic_data.get('condition')}")
                        finally:
                            db_pool.putconn(bg_conn)
                    
                    # STEP 2: Generate DETAILED analysis (implications, recommendations, resources)
                    app.logger.info(f"🔄 Background: Starting detailed analysis generation for user {saved_user_id}")
                    
                    detailed_prompt = f"""You are a professional genetic counselor providing educational information about genetic test results. 

Given the following genetic information:
- Gene: {saved_gene}
- Variant/Mutation: {saved_mutation}
- Classification: {saved_classification}

Please provide DETAILED guidance in the following JSON format:

{{
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

CRITICAL: Respond ONLY with the JSON object, no additional text."""
                    
                    llm_response_detailed = call_custom_llm(
                        user_message=detailed_prompt,
                        max_tokens=1024,
                        stream=False
                    )
                    
                    if "choices" in llm_response_detailed and len(llm_response_detailed["choices"]) > 0:
                        ai_content_detailed = llm_response_detailed["choices"][0].get("message", {}).get("content", "")
                        
                        # Parse JSON from LLM response
                        cleaned_detailed = ai_content_detailed.strip()
                        if cleaned_detailed.startswith("```json"):
                            cleaned_detailed = cleaned_detailed[7:]
                        if cleaned_detailed.startswith("```"):
                            cleaned_detailed = cleaned_detailed[3:]
                        if cleaned_detailed.endswith("```"):
                            cleaned_detailed = cleaned_detailed[:-3]
                        cleaned_detailed = cleaned_detailed.strip()
                        
                        detailed_data = json.loads(cleaned_detailed)
                        
                        # Cache detailed result
                        detailed_json = json.dumps(detailed_data)
                        bg_conn_detailed = db_pool.getconn()
                        try:
                            with bg_conn_detailed.cursor() as bg_cur_detailed:
                                bg_cur_detailed.execute('''
                                    UPDATE gencom.base_information
                                    SET cached_analysis_detailed = %s
                                    WHERE user_id = %s
                                ''', (detailed_json, saved_user_id))
                                bg_conn_detailed.commit()
                            
                            app.logger.info(f"✅ Background: Cached detailed analysis for user {saved_user_id}")
                            app.logger.info(f"🎉 Background: FULL analysis complete for user {saved_user_id} - /conditions will be instant!")
                        finally:
                            db_pool.putconn(bg_conn_detailed)
                    
                except Exception as bg_error:
                    app.logger.error(f"❌ Background: Failed to generate analysis: {bg_error}")
            
            # Start background thread (non-blocking)
            analysis_thread = threading.Thread(target=async_generate_full_analysis, daemon=True)
            analysis_thread.start()
            app.logger.info("🚀 Triggered background FULL analysis generation (basic + detailed)")
            
            return jsonify({"success": True, "userId": result["user_id"]}), 200
            
    except Exception as e:
        if conn:
            conn.rollback()
        app.logger.exception("save_base_information:error %s", str(e))
        return jsonify({"error": "database_save_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.get("/base-information/<user_id>")
def get_base_information(user_id):
    """
    Fetch existing BaseInformation for a user to pre-populate the introduction form
    """
    start_time = datetime.now(timezone.utc)
    app.logger.info(f"⏱️ base-information:start user_id={user_id}")
    
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    # Validate user_id is a valid UUID format
    try:
        uuid.UUID(str(user_id))
    except ValueError:
        app.logger.error(f"Invalid UUID format for user_id: {user_id}")
        return jsonify({"error": "invalid_user_id", "message": "user_id must be a valid UUID"}), 400
    
    conn = None
    try:
        db_start = datetime.now(timezone.utc)
        conn = db_pool.getconn()
        db_conn_time = (datetime.now(timezone.utc) - db_start).total_seconds()
        
        query_start = datetime.now(timezone.utc)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch user's existing data with joined table info
            cur.execute('''
                SELECT 
                    bi.user_id,
                    bi.persona_test_type_id,
                    bi.classification_type_id,
                    bi.gene,
                    bi.mutation,
                    bi.uploaded,
                    bi.cached_analysis,
                    bi.analysis_cached_at,
                    ptt.persona_test_type,
                    ct.classification_type
                FROM gencom.base_information bi
                INNER JOIN gencom.persona_test_type ptt 
                    ON bi.persona_test_type_id = ptt.persona_test_type_id
                INNER JOIN gencom.classification_type ct 
                    ON bi.classification_type_id = ct.classification_type_id
                WHERE bi.user_id = %s
                LIMIT 1
            ''', (user_id,))
            
            result = cur.fetchone()
        query_time = (datetime.now(timezone.utc) - query_start).total_seconds()
            
        if not result:
            total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            app.logger.info(f"ℹ️  base-information:not_found user_id={user_id} conn={db_conn_time:.3f}s query={query_time:.3f}s total={total_time:.3f}s")
            return jsonify({"exists": False}), 200
        
        # Convert result to JSON-friendly format
        data = {
            "exists": True,
            "userId": result["user_id"],
            "personaTestTypeId": result["persona_test_type_id"],
            "personaTestType": result["persona_test_type"],
            "classificationTypeId": result["classification_type_id"],
            "classificationType": result["classification_type"],
            "gene": result["gene"],
            "mutation": result["mutation"],
            "uploaded": bool(result["uploaded"]) if result["uploaded"] is not None else None,
            "cachedAnalysis": result["cached_analysis"],
            "analysisCachedAt": result["analysis_cached_at"].isoformat() if result["analysis_cached_at"] else None
        }
        
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        app.logger.info(f"✅ base-information:success persona={data['personaTestType']}, gene={data['gene']} conn={db_conn_time:.3f}s query={query_time:.3f}s total={total_time:.3f}s")
        
        return jsonify(data), 200
            
    except Exception as e:
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        app.logger.exception(f"❌ get_base_information:error {type(e).__name__}: {e} total={total_time:.3f}s")
        return jsonify({"error": "database_fetch_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

# Authentication Endpoints
@app.post("/auth/login")
def auth_login():
    start_time = datetime.now(timezone.utc)
    app.logger.info("⏱️ auth:login:start")
    
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
        # Time: Getting DB connection
        db_start = datetime.now(timezone.utc)
        conn = db_pool.getconn()
        db_conn_time = (datetime.now(timezone.utc) - db_start).total_seconds()
        app.logger.info(f"⏱️ auth:login:db_connection took {db_conn_time:.3f}s")
        
        # Time: Database query
        query_start = datetime.now(timezone.utc)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT id, user_email, display_name, company_id
                FROM public.users
                WHERE user_email = %s AND user_password = %s
            ''', (email, password))
            user = cur.fetchone()
        query_time = (datetime.now(timezone.utc) - query_start).total_seconds()
        app.logger.info(f"⏱️ auth:login:db_query took {query_time:.3f}s")
            
        if user:
            user_id = str(user['id'])
            company_id = str(user['company_id']) if user['company_id'] else None
            
            # Time: JWT token creation
            jwt_start = datetime.now(timezone.utc)
            token = create_jwt_token(user_id, email, company_id)
            jwt_time = (datetime.now(timezone.utc) - jwt_start).total_seconds()
            app.logger.info(f"⏱️ auth:login:jwt_creation took {jwt_time:.3f}s")
            
            total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            app.logger.info(f"✅ auth:login:success email={email} user_id={user_id} total_time={total_time:.3f}s")
            
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
            total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            app.logger.warning(f"❌ auth:login:failed email={email} total_time={total_time:.3f}s")
            return jsonify({"error": "invalid_credentials", "message": "Invalid email or password"}), 401
                
    except Exception as e:
        total_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        app.logger.exception(f"❌ auth:login:error {str(e)} total_time={total_time:.3f}s")
        return jsonify({"error": "auth_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

# Condition Analysis Endpoints (Progressive Loading)
@app.get("/condition-analysis/<user_id>/basic")
def get_condition_analysis_basic(user_id):
    """
    FAST endpoint - Returns only condition, riskLevel, and description
    Used for immediate page rendering (Part 1 of 2)
    """
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    app.logger.info(f"⚡ condition_analysis:basic:request user_id={user_id}")
    
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
                    bi.gene,
                    bi.mutation,
                    ct.classification_type
                FROM gencom.base_information bi
                JOIN gencom.classification_type ct 
                    ON bi.classification_type_id = ct.classification_type_id
                WHERE bi.user_id = %s
            ''', (user_id,))
            
            result = cur.fetchone()
            
            if not result:
                app.logger.warning(f"⚠️  No base information found for user_id={user_id}")
                return jsonify({"error": "no_genetic_data_found", "message": "Please complete the introductory screen first"}), 404
            
            gene = result["gene"]
            mutation = result["mutation"]
            classification = result["classification_type"]
            
            # Check if required fields are present
            if not gene or not mutation:
                app.logger.warning(f"⚠️  Incomplete genetic data for user_id={user_id}")
                return jsonify({"error": "incomplete_genetic_data", "message": "Gene and Mutation are required"}), 400
            
            app.logger.info(f"📊 Retrieved: gene={gene}, mutation={mutation}, classification={classification}")
            
            # Check cache for basic info
            cur.execute('''
                SELECT cached_analysis_basic, analysis_cached_at
                FROM gencom.base_information
                WHERE user_id = %s 
                  AND cached_analysis_basic IS NOT NULL
            ''', (user_id,))
            
            cached_result = cur.fetchone()
            
            # Use cache if it exists and is less than 7 days old
            if cached_result and cached_result.get("cached_analysis_basic"):
                cached_at = cached_result.get("analysis_cached_at")
                
                # Check if cache is still valid (less than 7 days old)
                cache_valid = False
                if cached_at:
                    cache_age = datetime.now(timezone.utc) - cached_at
                    cache_valid = cache_age < timedelta(days=7)
                    app.logger.info(f"📦 Found cached basic analysis (age: {cache_age.days} days)")
                
                if cache_valid:
                    try:
                        cached_data = json.loads(cached_result["cached_analysis_basic"])
                        app.logger.info("✅ Returning cached basic analysis (fast path)")
                        return jsonify(cached_data), 200
                    except json.JSONDecodeError:
                        app.logger.warning("⚠️ Invalid cached JSON, regenerating...")
            
            # No valid cache - generate new basic analysis
            app.logger.info("🤖 Calling custom LLM for BASIC condition analysis...")
            
            # PART 1: Basic prompt (fast response - only condition, risk, description)
            prompt = f"""You are a professional genetic counselor providing educational information about genetic test results. 

Given the following genetic information:
- Gene: {gene}
- Variant/Mutation: {mutation}
- Classification: {classification}

Please provide a BRIEF initial analysis in the following JSON format:

{{
  "condition": "Primary condition name associated with this gene variant",
  "riskLevel": "High/Moderate/Low",
  "description": "A clear, patient-friendly 2-3 sentence description of what this variant means"
}}

Important guidelines:
- Use clear, non-technical language suitable for patients
- Base risk level on the classification: Pathogenic/Likely Pathogenic = High, VUS = Moderate, Benign/Likely Benign = Low
- Be compassionate and supportive in tone
- Provide specific, evidence-based information

CRITICAL: Respond ONLY with the JSON object, no additional text."""

            try:
                # Call custom LLM with smaller max_tokens for faster response
                llm_response = call_custom_llm(
                    user_message=prompt,
                    max_tokens=384,  # Smaller for basic response
                    stream=False
                )
                
                # Extract the assistant's message
                if "choices" in llm_response and len(llm_response["choices"]) > 0:
                    ai_content = llm_response["choices"][0].get("message", {}).get("content", "")
                    app.logger.info(f"✅ Custom LLM basic response received: {len(ai_content)} chars")
                    
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
                        
                        # Cache the basic analysis
                        try:
                            cache_json = json.dumps(condition_data)
                            cur.execute('''
                                UPDATE gencom.base_information
                                SET cached_analysis_basic = %s,
                                    analysis_cached_at = (now() at time zone 'utc')
                                WHERE user_id = %s
                            ''', (cache_json, user_id))
                            conn.commit()
                            app.logger.info("💾 Basic analysis cached to database")
                        except Exception as cache_error:
                            app.logger.warning(f"⚠️ Failed to cache basic analysis (non-fatal): {cache_error}")
                        
                        app.logger.info(f"✅ condition_analysis:basic:success condition={condition_data.get('condition')}")
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
        app.logger.exception(f"❌ condition_analysis:basic:error {type(e).__name__}: {e}")
        return jsonify({"error": "analysis_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

@app.get("/condition-analysis/<user_id>/detailed")
def get_condition_analysis_detailed(user_id):
    """
    DETAILED endpoint - Returns implications, recommendations, and resources
    Called after page renders with basic info (Part 2 of 2)
    """
    if not db_pool:
        return jsonify({"error": "database_not_configured"}), 500
    
    app.logger.info(f"📋 condition_analysis:detailed:request user_id={user_id}")
    
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
                    bi.gene,
                    bi.mutation,
                    ct.classification_type
                FROM gencom.base_information bi
                JOIN gencom.classification_type ct 
                    ON bi.classification_type_id = ct.classification_type_id
                WHERE bi.user_id = %s
            ''', (user_id,))
            
            result = cur.fetchone()
            
            if not result:
                app.logger.warning(f"⚠️  No base information found for user_id={user_id}")
                return jsonify({"error": "no_genetic_data_found", "message": "Please complete the introductory screen first"}), 404
            
            gene = result["gene"]
            mutation = result["mutation"]
            classification = result["classification_type"]
            
            app.logger.info(f"📊 Retrieved: gene={gene}, mutation={mutation}, classification={classification}")
            
            # Check cache for detailed info
            cur.execute('''
                SELECT cached_analysis_detailed
                FROM gencom.base_information
                WHERE user_id = %s 
                  AND cached_analysis_detailed IS NOT NULL
            ''', (user_id,))
            
            cached_result = cur.fetchone()
            
            # Use cache if it exists
            if cached_result and cached_result.get("cached_analysis_detailed"):
                try:
                    cached_data = json.loads(cached_result["cached_analysis_detailed"])
                    app.logger.info("✅ Returning cached detailed analysis (fast path)")
                    return jsonify(cached_data), 200
                except json.JSONDecodeError:
                    app.logger.warning("⚠️ Invalid cached JSON, regenerating...")
            
            # No valid cache - generate new detailed analysis
            app.logger.info("🤖 Calling custom LLM for DETAILED condition analysis...")
            
            # PART 2: Detailed prompt (implications, recommendations, resources)
            prompt = f"""You are a professional genetic counselor providing educational information about genetic test results. 

Given the following genetic information:
- Gene: {gene}
- Variant/Mutation: {mutation}
- Classification: {classification}

Please provide DETAILED guidance in the following JSON format:

{{
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
- Focus on actionable information
- Include both risks and positive steps they can take
- Be compassionate and supportive in tone
- Provide specific, evidence-based information

CRITICAL: Respond ONLY with the JSON object, no additional text."""

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
                    app.logger.info(f"✅ Custom LLM detailed response received: {len(ai_content)} chars")
                    
                    # Parse the JSON response
                    try:
                        # Clean the response
                        cleaned_content = ai_content.strip()
                        if cleaned_content.startswith("```json"):
                            cleaned_content = cleaned_content[7:]
                        if cleaned_content.startswith("```"):
                            cleaned_content = cleaned_content[3:]
                        if cleaned_content.endswith("```"):
                            cleaned_content = cleaned_content[:-3]
                        cleaned_content = cleaned_content.strip()
                        
                        condition_data = json.loads(cleaned_content)
                        
                        # Cache the detailed analysis
                        try:
                            cache_json = json.dumps(condition_data)
                            cur.execute('''
                                UPDATE gencom.base_information
                                SET cached_analysis_detailed = %s
                                WHERE user_id = %s
                            ''', (cache_json, user_id))
                            conn.commit()
                            app.logger.info("💾 Detailed analysis cached to database")
                        except Exception as cache_error:
                            app.logger.warning(f"⚠️ Failed to cache detailed analysis (non-fatal): {cache_error}")
                        
                        app.logger.info(f"✅ condition_analysis:detailed:success")
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
                app.logger.error(f"❌ Custom LLM configuration error: {ve}")
                return jsonify({"error": "llm_not_configured", "message": str(ve)}), 500
            except Exception as llm_error:
                app.logger.exception(f"❌ Error calling custom LLM: {llm_error}")
                return jsonify({"error": "llm_call_failed", "message": str(llm_error)}), 500
            
    except Exception as e:
        app.logger.exception(f"❌ condition_analysis:detailed:error {type(e).__name__}: {e}")
        return jsonify({"error": "analysis_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

# Condition Analysis Endpoint (Legacy - Full Response)
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
                    bi.gene,
                    bi.mutation,
                    ct.classification_type
                FROM gencom.base_information bi
                JOIN gencom.classification_type ct 
                    ON bi.classification_type_id = ct.classification_type_id
                WHERE bi.user_id = %s
            ''', (user_id,))
            
            result = cur.fetchone()
            
            if not result:
                app.logger.warning(f"⚠️  No base information found for user_id={user_id}")
                return jsonify({"error": "no_genetic_data_found", "message": "Please complete the introductory screen first"}), 404
            
            gene = result["gene"]
            mutation = result["mutation"]
            classification = result["classification_type"]
            
            # Check if required fields are present
            if not gene or not mutation:
                app.logger.warning(f"⚠️  Incomplete genetic data for user_id={user_id}")
                return jsonify({"error": "incomplete_genetic_data", "message": "Gene and Mutation are required"}), 400
            
            app.logger.info(f"📊 Retrieved: gene={gene}, mutation={mutation}, classification={classification}")
            
            # Check if we have cached analysis for this gene/mutation combo
            cur.execute('''
                SELECT cached_analysis, analysis_cached_at
                FROM gencom.base_information
                WHERE user_id = %s 
                  AND cached_analysis IS NOT NULL
            ''', (user_id,))
            
            cached_result = cur.fetchone()
            
            # Use cache if it exists and is less than 7 days old
            if cached_result and cached_result.get("cached_analysis"):
                cached_at = cached_result.get("analysis_cached_at")
                
                # Check if cache is still valid (less than 7 days old)
                cache_valid = False
                if cached_at:
                    cache_age = datetime.now(timezone.utc) - cached_at
                    cache_valid = cache_age < timedelta(days=7)
                    app.logger.info(f"📦 Found cached analysis (age: {cache_age.days} days)")
                
                if cache_valid:
                    try:
                        cached_data = json.loads(cached_result["cached_analysis"])
                        app.logger.info("✅ Returning cached analysis (fast path)")
                        return jsonify(cached_data), 200
                    except json.JSONDecodeError:
                        app.logger.warning("⚠️ Invalid cached JSON, regenerating...")
            
            # No valid cache - generate new analysis
            app.logger.info("🤖 Calling custom LLM for condition analysis...")
            
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
                        
                        # Cache the analysis in the database for future requests
                        try:
                            cache_json = json.dumps(condition_data)
                            cur.execute('''
                                UPDATE gencom.base_information
                                SET cached_analysis = %s,
                                    analysis_cached_at = (now() at time zone 'utc')
                                WHERE user_id = %s
                            ''', (cache_json, user_id))
                            conn.commit()
                            app.logger.info("💾 Analysis cached to database for faster future access")
                        except Exception as cache_error:
                            app.logger.warning(f"⚠️ Failed to cache analysis (non-fatal): {cache_error}")
                            # Continue anyway - caching failure shouldn't break the response
                        
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

@app.get("/source-documentation")
@jwt_required()
def get_source_documentation(user_payload):
    """
    Fetch source documentation (ClinVar + MedlinePlus) for the authenticated user
    Returns markdown-formatted text from the database
    """
    user_id = user_payload.get('sub')
    if not user_id:
        return jsonify({"error": "unauthorized", "message": "User ID not found in token"}), 401
    
    conn = None
    try:
        conn = db_pool.getconn()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch source documentation and metadata
            cur.execute('''
                SELECT 
                    bi.gene,
                    bi.mutation,
                    ct.classification_type,
                    bi.source_document,
                    bi.source_url,
                    bi.source_retrieved_at
                FROM gencom.base_information bi
                LEFT JOIN gencom.classification_type ct 
                    ON bi.classification_type_id = ct.classification_type_id
                WHERE bi.user_id = %s
            ''', (user_id,))
            
            result = cur.fetchone()
            
            if not result:
                return jsonify({
                    "error": "not_found",
                    "message": "No genetic information found for this user"
                }), 404
            
            source_document = result.get("source_document")
            
            if not source_document:
                return jsonify({
                    "error": "no_documentation",
                    "message": "Source documentation has not been fetched yet. Please save your genetic data first.",
                    "gene": result.get("gene"),
                    "mutation": result.get("mutation")
                }), 404
            
            app.logger.info(f"📚 source_documentation:fetched user_id={user_id} doc_length={len(source_document)}")
            
            return jsonify({
                "gene": result.get("gene"),
                "mutation": result.get("mutation"),
                "classification": result.get("classification_type"),
                "source_document": source_document,
                "source_url": result.get("source_url"),
                "source_retrieved_at": result.get("source_retrieved_at").isoformat() if result.get("source_retrieved_at") else None
            }), 200
            
    except Exception as e:
        app.logger.exception(f"❌ source_documentation:error {type(e).__name__}: {e}")
        return jsonify({"error": "fetch_failed", "message": str(e)}), 500
    finally:
        if conn:
            db_pool.putconn(conn)

if __name__ == "__main__":
    app.run(port=8081, debug=True)


