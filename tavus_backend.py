import os
import requests
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv


load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/tavus/*": {"origins": "*"}})

TAVUS_API_KEY = os.environ.get("TAVUS_API_KEY")
if not TAVUS_API_KEY:
    raise RuntimeError("Missing TAVUS_API_KEY in environment.")

TAVUS_REPLICA_ID = os.environ.get("TAVUS_REPLICA_ID", "r4317e64d25a")
TAVUS_PERSONA_ID = os.environ.get("TAVUS_PERSONA_ID", "p92464cdb59e")

TAVUS_BASE = "https://tavusapi.com/v2"
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": TAVUS_API_KEY,
}


def _recording_props():
    bucket = os.environ.get("TAVUS_RECORDING_S3_BUCKET_NAME")
    region = os.environ.get("TAVUS_RECORDING_S3_BUCKET_REGION")
    role_arn = os.environ.get("TAVUS_AWS_ASSUME_ROLE_ARN")
    if bucket and region and role_arn:
        return {
            "enable_recording": True,
            "recording_s3_bucket_name": bucket,
            "recording_s3_bucket_region": region,
            "aws_assume_role_arn": role_arn,
        }
    return {"enable_recording": False}


@app.route("/tavus/start", methods=["GET"])
def tavus_start():
    body = {
        "replica_id": TAVUS_REPLICA_ID,
        "conversation_name": "Legacy Forever",
        "persona_id": TAVUS_PERSONA_ID,
        "custom_greeting": "Hello, Welcome to Legacy Forever",
        "conversational_context": (
            "You are StorySeeker, an engaging, empathetic AI host whose job is to learn "
            "about each guest’s life story, passions, and proudest achievements."
        ),
        "properties": {
            "enable_closed_captions": False,
            **_recording_props(),
        },
    }
    try:
        resp = requests.post(f"{TAVUS_BASE}/conversations", headers=HEADERS, json=body, timeout=20)
        resp.raise_for_status()
        return jsonify(resp.json()), 200
    except requests.exceptions.RequestException as e:
        status = getattr(getattr(e, "response", None), "status_code", 500) or 500
        return jsonify({"error": "tavus_start_failed", "message": str(e)}), status


if __name__ == "__main__":
    app.run(port=8081, debug=True)


