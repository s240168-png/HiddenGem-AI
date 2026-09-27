import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parent
recommendation = ROOT / "recommendation.py"
procfile = ROOT / "Procfile"
dockerfile = ROOT / "Dockerfile"

tree = ast.parse(recommendation.read_text(encoding="utf-8"))
source = recommendation.read_text(encoding="utf-8")
proc = procfile.read_text(encoding="utf-8")
docker = dockerfile.read_text(encoding="utf-8")

assert any(isinstance(node, ast.Assign) and any(
    isinstance(target, ast.Name) and target.id == "app" for target in node.targets
) for node in tree.body), "Flask app object is missing"

assert '@app.route("/health"' in source
assert '@app.route("/predict"' in source
assert 'os.environ.get("PYTHON_HOST", "127.0.0.1")' in source
assert "recommendation:app" in proc
assert "--workers 1" in proc
assert "gunicorn" in docker
assert "--workers\", \"1\"" in docker

print("Python deployment smoke checks: 6/6 passed.")
