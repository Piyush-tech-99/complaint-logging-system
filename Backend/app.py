# backend/app.py
import os
import json
from datetime import datetime
from math import radians, cos, sin, asin, sqrt

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "sanitation_db")

app = Flask(__name__, static_folder="../frontend/public", static_url_path="/")
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
complaints = db.complaints

# Helpers
def serialize_doc(doc):
    doc["_id"] = str(doc["_id"])
    # ensure datetime serialization
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc

def haversine(lat1, lon1, lat2, lon2):
    # Returns km between two lat/lon points
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    c = 2*asin(sqrt(a))
    km = 6371* c
    return km

# Routes
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/manager")
def manager_page():
    return send_from_directory(app.static_folder, "manager.html")

@app.route("/api/complaints", methods=["POST"])
def create_complaint():
    data = request.json or {}
    # Required: title, description, location {lat, lng} ideally
    title = data.get("title", "Untitled complaint")
    description = data.get("description", "")
    priority = data.get("priority", "medium")  # low, medium, high
    reporter = data.get("reporter", "anonymous")
    location = data.get("location", {})  # {lat, lng}
    status = "new"
    created_at = datetime.utcnow()

    doc = {
        "title": title,
        "description": description,
        "priority": priority,
        "reporter": reporter,
        "location": {"lat": float(location.get("lat", 0)), "lng": float(location.get("lng", 0))},
        "status": status,
        "assigned_to": None,
        "created_at": created_at
    }
    res = complaints.insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    doc["created_at"] = created_at.isoformat()

    # notify via socket
    socketio.emit("new_complaint", serialize_doc(doc))

    return jsonify({"success": True, "complaint": doc}), 201

@app.route("/api/complaints", methods=["GET"])
def list_complaints():
    # optional query params: status, priority, sort
    q = {}
    status = request.args.get("status")
    priority = request.args.get("priority")
    if status:
        q["status"] = status
    if priority:
        q["priority"] = priority

    docs = list(complaints.find(q).sort([("priority", -1), ("created_at", 1)]))
    docs = [serialize_doc(d) for d in docs]
    return jsonify({"complaints": docs})

@app.route("/api/complaint/<cid>", methods=["GET"])
def get_complaint(cid):
    doc = complaints.find_one({"_id": ObjectId(cid)})
    if not doc:
        return jsonify({"error": "not found"}), 404
    return jsonify(serialize_doc(doc))

@app.route("/api/complaint/<cid>/status", methods=["POST"])
def update_status(cid):
    data = request.json or {}
    new_status = data.get("status")
    assigned_to = data.get("assigned_to")  # optional
    update = {}
    if new_status:
        update["status"] = new_status
    if assigned_to is not None:
        update["assigned_to"] = assigned_to
    update["updated_at"] = datetime.utcnow()
    res = complaints.update_one({"_id": ObjectId(cid)}, {"$set": update})
    if res.matched_count == 0:
        return jsonify({"error": "not found"}), 404
    doc = complaints.find_one({"_id": ObjectId(cid)})
    doc = serialize_doc(doc)
    socketio.emit("status_update", doc)
    return jsonify({"success": True, "complaint": doc})

@app.route("/api/compute_route", methods=["POST"])
def compute_route():
    """
    Accepts JSON: { "start": {"lat": , "lng": }, "complaint_ids": [id1, id2, ...] }
    Returns ordered list by greedy nearest neighbor starting from start.
    """
    data = request.json or {}
    start = data.get("start", {"lat": 0, "lng": 0})
    ids = data.get("complaint_ids", [])
    docs = []
    for cid in ids:
        d = complaints.find_one({"_id": ObjectId(cid)})
        if d:
            docs.append(serialize_doc(d))

    # greedy nearest neighbor
    order = []
    cur = {"lat": float(start.get("lat", 0)), "lng": float(start.get("lng", 0))}
    remaining = docs.copy()
    while remaining:
        # find nearest
        nearest = min(remaining, key=lambda x: haversine(cur["lat"], cur["lng"],
                                                         x["location"]["lat"], x["location"]["lng"]))
        order.append(nearest)
        cur = nearest["location"]
        remaining.remove(nearest)
    return jsonify({"route": order})

# Simple health
@app.route("/api/health")
def health():
    return jsonify({"ok": True})

# Socket handlers (optional)
@socketio.on("connect")
def on_connect():
    emit("connected", {"msg": "connected to backend"})

if __name__ == "__main__":
    # for production you'd use an async worker or configure properly
    port = int(os.getenv("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=True)







