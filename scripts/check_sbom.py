#!/usr/bin/env python3
import json
import sys
from datetime import date, datetime
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from generate_sbom import ROOT, read_text

INVENTORY = ROOT / "sbom/inventory.json"
MAX_REVIEW_AGE_DAYS = 90
TRUSTED_SOURCES = {
    "https://pypi.org/simple",
    "https://registry.npmjs.org/",
}


def declared_python():
    names = set()
    for line in read_text(ROOT / "backend/requirements.txt").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        names.add(line.split("==", 1)[0].strip().lower())
    return names


def declared_npm():
    pkg = json.loads((ROOT / "frontend/package.json").read_text())
    names = set()
    for section in ("dependencies", "devDependencies"):
        names.update(pkg.get(section) or {})
    return names


def main():
    if not INVENTORY.exists():
        print("sbom/inventory.json is missing. Run scripts/generate_sbom.py")
        sys.exit(1)

    data = json.loads(INVENTORY.read_text())
    reviewed = datetime.strptime(data["last_reviewed"], "%Y-%m-%d").date()
    age = (date.today() - reviewed).days
    if age > data.get("remediation_sla_days", {}).get("inventory_refresh", MAX_REVIEW_AGE_DAYS):
        print(f"SBOM last_reviewed is {age} days old; refresh required.")
        sys.exit(1)

    components = data.get("components") or []
    py_inv = {c["name"].lower() for c in components if c["ecosystem"] == "pypi"}
    npm_inv = {c["name"] for c in components if c["ecosystem"] == "npm"}
    missing_py = declared_python() - py_inv
    missing_npm = declared_npm() - npm_inv
    untrusted = [c for c in components if c.get("source") not in TRUSTED_SOURCES]
    unpinned = [c for c in components if c["ecosystem"] == "pypi" and not c.get("version")]

    errors = []
    if missing_py:
        errors.append(f"Python packages missing from SBOM: {sorted(missing_py)}")
    if missing_npm:
        errors.append(f"npm packages missing from SBOM: {sorted(missing_npm)}")
    if untrusted:
        errors.append(f"Components from untrusted sources: {[c['name'] for c in untrusted]}")
    if unpinned:
        errors.append(f"Unpinned Python packages: {[c['name'] for c in unpinned]}")

    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print(f"SBOM OK: {len(components)} components, last_reviewed={data['last_reviewed']}")


if __name__ == "__main__":
    main()
