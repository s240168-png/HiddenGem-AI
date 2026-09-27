"""Long-lived SentenceTransformer worker used by the Express recommendation API."""

import json
import sys

from sentence_transformers import SentenceTransformer, util


MODEL_NAME = "all-MiniLM-L6-v2"
model = SentenceTransformer(MODEL_NAME)


def experience_text(experience):
    name = experience.get("name") or experience.get("title") or ""
    vibes = experience.get("vibes") or experience.get("vibe") or []
    if not isinstance(vibes, list):
        vibes = [str(vibes)]
    description = experience.get("description") or ""
    return f"{name}. Vibe keywords: {', '.join(vibes)}. Description: {description}"


def score(payload):
    user_vibes = payload.get("user_vibes") or []
    experiences = payload.get("experiences") or []
    preference_text = "User vibe preferences: " + ", ".join(user_vibes)
    texts = [preference_text] + [experience_text(experience) for experience in experiences]
    embeddings = model.encode(texts, convert_to_tensor=True, normalize_embeddings=True)
    similarities = util.cos_sim(embeddings[0], embeddings[1:])[0].tolist() if experiences else []
    return {"scores": [round(float(score), 6) for score in similarities]}


for line in sys.stdin:
    try:
        request = json.loads(line)
        print(json.dumps(score(request)), flush=True)
    except Exception as error:  # Keep the worker alive so one bad request is isolated.
        print(json.dumps({"error": str(error)}), flush=True)
