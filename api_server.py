import os, json
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

LOG_FILE = r"I:\ML Training\LLM Training\training_log.json"

@app.route("/api/status")
def status():
    if not os.path.exists(LOG_FILE):
        return jsonify({"status": "not_started"})
    with open(LOG_FILE, "r") as f:
        return jsonify(json.load(f))

@app.route("/api/health")
def health():
    return jsonify({"ok": True})

if __name__ == "__main__":
    print("Training API server running at http://localhost:5050")
    app.run(host="0.0.0.0", port=5050, debug=False)
