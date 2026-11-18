# Dependency policy

## Trusted repositories

Install third-party libraries only from:

| Ecosystem | Registry |
|---|---|
| Python | `https://pypi.org/simple` |
| Node.js | `https://registry.npmjs.org/` |

Do not use unofficial mirrors, GitHub tarball URLs, or unpinned `git+` installs.

Direct libraries are listed in `sbom/inventory.json`. Transitive libraries are locked by `frontend/package-lock.json` and the pinned Python requirements.

## Update and remediation time frames

| Severity | Maximum time to update or mitigate |
|---|---|
| Critical | 7 days |
| High | 30 days |
| Medium | 90 days |
| Low / inventory refresh | 90 days |

`sbom/inventory.json` `last_reviewed` must be no older than 90 days. Refresh it after dependency upgrades or security reviews.

## How to refresh the inventory

```bash
python3 scripts/generate_sbom.py
python3 scripts/check_sbom.py
```
