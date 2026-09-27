import os
import sys
import math
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

app = Flask(__name__)

# Request-size limit (1 MB default) and payload caps
app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get("MAX_CONTENT_LENGTH", 1024 * 1024))
MAX_EXPERIENCES = int(os.environ.get("MAX_EXPERIENCES", 100))
MAX_USER_VIBES = int(os.environ.get("MAX_USER_VIBES", 50))

MODEL_NAME = "all-MiniLM-L6-v2"
model = None
model_load_error = None

try:
    from sentence_transformers import SentenceTransformer, util
    model = SentenceTransformer(MODEL_NAME)
    print(f"[OK] SentenceTransformer model '{MODEL_NAME}' loaded successfully.")
except Exception as e:
    model_load_error = str(e)
    print(f"[WARNING] Could not load SentenceTransformer model '{MODEL_NAME}': {e}", file=sys.stderr)

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        "success": False,
        "message": "Request payload exceeds maximum allowed size limit (1MB)"
    }), 413

@app.errorhandler(400)
def bad_request(error):
    msg = getattr(error, 'description', 'Bad Request')
    return jsonify({
        "success": False,
        "message": str(msg)
    }), 400

@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({
        "success": False,
        "message": "An unexpected error occurred in the recommendation service"
    }), 500

def experience_text(experience):
    if not isinstance(experience, dict):
        return ""
    name = experience.get("name") or experience.get("title") or ""
    vibes = experience.get("vibes") or experience.get("vibe") or []
    if not isinstance(vibes, list):
        vibes = [str(vibes)]
    description = experience.get("description") or ""
    return f"{name}. Vibe keywords: {', '.join([str(v) for v in vibes])}. Description: {description}"

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dLon / 2) * math.sin(dLon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def get_coords(exp):
    if not isinstance(exp, dict):
        return None
    try:
        if "latitude" in exp and "longitude" in exp:
            if exp["latitude"] is not None and exp["longitude"] is not None:
                return float(exp["latitude"]), float(exp["longitude"])
        if "lat" in exp and "lon" in exp:
            if exp["lat"] is not None and exp["lon"] is not None:
                return float(exp["lat"]), float(exp["lon"])
        if "lat" in exp and "lng" in exp:
            if exp["lat"] is not None and exp["lng"] is not None:
                return float(exp["lat"]), float(exp["lng"])
    except (ValueError, TypeError):
        return None
    return None

def parse_time(time_str):
    try:
        return datetime.strptime(str(time_str).strip(), "%I:%M %p")
    except (ValueError, TypeError):
        return datetime.strptime("09:00 AM", "%I:%M %p")

@app.route("/health", methods=["GET"])
def health():
    if model is None:
        return jsonify({
            "status": "degraded",
            "service": "HiddenGemsAI ML Service",
            "model_loaded": False,
            "error": model_load_error or "SentenceTransformer model not loaded"
        }), 500
    return jsonify({
        "status": "ok",
        "service": "HiddenGemsAI ML Service",
        "model_loaded": True,
        "model": MODEL_NAME
    }), 200

@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"success": False, "message": "ML model unavailable"}), 503

    if not request.is_json:
        return jsonify({"success": False, "message": "Invalid JSON payload format"}), 400

    payload = request.get_json(silent=True)
    if payload is None or not isinstance(payload, dict):
        return jsonify({"success": False, "message": "Invalid JSON payload structure"}), 400

    if "experiences" not in payload or not isinstance(payload["experiences"], list):
        return jsonify({"success": False, "message": "Field 'experiences' must be an array"}), 400

    if "user_vibes" in payload and not isinstance(payload["user_vibes"], list):
        return jsonify({"success": False, "message": "Field 'user_vibes' must be an array"}), 400

    experiences = payload.get("experiences", [])
    if len(experiences) > MAX_EXPERIENCES:
        return jsonify({
            "success": False,
            "message": f"Too many experiences provided (maximum allowed: {MAX_EXPERIENCES})"
        }), 400

    user_vibes = payload.get("user_vibes", [])
    if len(user_vibes) > MAX_USER_VIBES:
        return jsonify({
            "success": False,
            "message": f"Too many user_vibes provided (maximum allowed: {MAX_USER_VIBES})"
        }), 400

    try:
        start_time_str = payload.get("start_time", "09:00 AM")
        try:
            time_available_hours = float(payload.get("time_available_hours", 5))
        except (ValueError, TypeError):
            time_available_hours = 5.0

        try:
            budget_limit = float(payload.get("budget_limit", 1500))
        except (ValueError, TypeError):
            budget_limit = 1500.0

        # Filter out non-dict items from experiences safely
        experiences = [exp for exp in experiences if isinstance(exp, dict)]
        
        start_time = parse_time(start_time_str)
        end_time = start_time + timedelta(hours=time_available_hours)
        
        preference_text = "User vibe preferences: " + ", ".join([str(v) for v in user_vibes])
        texts = [preference_text] + [experience_text(exp) for exp in experiences]
        
        if len(experiences) > 0:
            embeddings = model.encode(texts, convert_to_tensor=True, normalize_embeddings=True)
            similarities = util.cos_sim(embeddings[0], embeddings[1:])[0].tolist()
        else:
            similarities = []
            
        for idx, exp in enumerate(experiences):
            exp["vibe_score"] = float(similarities[idx]) * 100
            
        itinerary = []
        total_spent = 0
        current_time = start_time
        current_location = None
        available_candidates = [exp for exp in experiences]
        
        while True:
            best_candidate = None
            best_score = -float("inf")
            best_distance = 0
            best_travel_time = 0
            
            for exp in available_candidates:
                try:
                    cost = float(exp.get("cost", 0) or 0)
                except (ValueError, TypeError):
                    cost = 0.0

                if total_spent + cost > budget_limit:
                    continue
                    
                coords = get_coords(exp)
                if current_location is None or coords is None:
                    distance_km = 0
                else:
                    distance_km = haversine(current_location[0], current_location[1], coords[0], coords[1])
                    
                travel_hours = (distance_km / 20) + 0.15 if current_location is not None else 0
                try:
                    duration_hours = float(exp.get("duration_hours", 1.0) or 1.0)
                except (ValueError, TypeError):
                    duration_hours = 1.0

                if current_time + timedelta(hours=travel_hours + duration_hours) > end_time:
                    continue
                    
                combined_score = exp.get("vibe_score", 0) - (distance_km * 0.05)
                
                if combined_score > best_score:
                    best_score = combined_score
                    best_candidate = exp
                    best_distance = distance_km
                    best_travel_time = travel_hours
                    
            if best_candidate is None:
                break
                
            try:
                cost = float(best_candidate.get("cost", 0) or 0)
            except (ValueError, TypeError):
                cost = 0.0

            total_spent += cost
            arrival_time = current_time + timedelta(hours=best_travel_time)
            try:
                cand_duration = float(best_candidate.get("duration_hours", 1.0) or 1.0)
            except (ValueError, TypeError):
                cand_duration = 1.0

            departure_time = arrival_time + timedelta(hours=cand_duration)
            time_slot = f"{arrival_time.strftime('%I:%M %p')} - {departure_time.strftime('%I:%M %p')}"
            
            itinerary.append({
                "id": best_candidate.get("id"),
                "timeSlot": time_slot,
                "placeName": best_candidate.get("name") or best_candidate.get("title") or "Unknown",
                "dlVibeMatch": round(best_candidate.get("vibe_score", 0), 1),
                "cost": cost,
                "description": best_candidate.get("description", ""),
                "duration_hours": best_candidate.get("duration_hours"),
                "distance": f"{round(best_distance, 1)} km",
                "image": best_candidate.get("image", ""),
                "kind": best_candidate.get("kind", ""),
                "fit": round(best_candidate.get("vibe_score", 0), 1),
                "match": round(best_candidate.get("vibe_score", 0), 1),
                "duration": best_candidate.get("duration", ""),
                "travel": f"{int(best_travel_time * 60)} min",
                "budget": best_candidate.get("budget", "$")
            })
            
            current_time = departure_time
            coords = get_coords(best_candidate)
            if coords is not None:
                current_location = coords
            available_candidates.remove(best_candidate)
            
        return jsonify({
            "itinerary": itinerary,
            "totalSpent": total_spent,
            "budgetLimit": budget_limit,
            "startTime": start_time.strftime("%I:%M %p"),
            "endTime": current_time.strftime("%I:%M %p"),
            "experiences": experiences
        })
    except Exception as err:
        print(f"Error in /predict: {err}", file=sys.stderr)
        return jsonify({"success": False, "message": "Failed to compute recommendations"}), 500

if __name__ == "__main__":
    host = os.environ.get("PYTHON_HOST", "127.0.0.1")
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(host=host, port=port)
