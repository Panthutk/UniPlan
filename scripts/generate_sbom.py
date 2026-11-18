#!/usr/bin/env python3
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRUSTED = {
    "pypi": "https://pypi.org/simple",
    "npm": "https://registry.npmjs.org/",
}


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "utf-16"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def python_components():
    items = []
    for line in read_text(ROOT / "backend/requirements.txt").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, version = (line.split("==", 1) + [""])[:2]
        items.append({
            "name": name.strip(),
            "version": version.strip() or None,
            "ecosystem": "pypi",
            "purl": f"pkg:pypi/{name.strip().lower()}@{version.strip()}" if version.strip() else f"pkg:pypi/{name.strip().lower()}",
            "source": TRUSTED["pypi"],
        })
    return items


def npm_components():
    pkg = json.loads((ROOT / "frontend/package.json").read_text())
    items = []
    for section, kind in (("dependencies", "runtime"), ("devDependencies", "development")):
        for name, spec in (pkg.get(section) or {}).items():
            version = spec.lstrip("^~")
            items.append({
                "name": name,
                "version": version,
                "ecosystem": "npm",
                "scope": kind,
                "purl": f"pkg:npm/{name}@{version}",
                "source": TRUSTED["npm"],
            })
    return items


def main():
    inventory = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "last_reviewed": date.today().isoformat(),
        "trusted_repositories": TRUSTED,
        "remediation_sla_days": {"critical": 7, "high": 30, "medium": 90, "inventory_refresh": 90},
        "components": python_components() + npm_components(),
    }
    out = ROOT / "sbom/inventory.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(inventory, indent=2) + "\n")
    print(f"Wrote {out} ({len(inventory['components'])} components)")


if __name__ == "__main__":
    main()
