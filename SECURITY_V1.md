# OWASP ASVS Chapter V1 — Encoding and Sanitization

This document summarizes the security controls implemented and verified in **UniPlan** for **OWASP ASVS v5.0 Chapter V1 (Encoding and Sanitization)**.

---

## V1.2 Injection Prevention

### V1.2.1 — Output Encoding for HTTP, HTML, and XML Responses
- **Control**: React JSX automatically escapes rendered text nodes on the frontend (no `dangerouslySetInnerHTML` usage), and Django templates have auto-escaping enabled by default in `backend/mysite/settings.py`.

### V1.2.2 — Safe URL Construction & Protocol Validation
- **Control**:
  - Backend OAuth callback query strings are constructed using `urllib.parse.urlencode()` (`backend/core/views.py`).
  - Frontend URL path segments use `encodeURIComponent()` (`frontend/src/TableAndTask.jsx`) and `URLSearchParams` (`frontend/src/Login.jsx`).
  - External URLs (`assignment_alt_link`) are validated on the backend via `TaskSerializer.validate_assignment_alt_link` (`backend/core/serializers.py`) and on the frontend via `safeExternalUrl()` (`frontend/src/utils/api.js`) to permit only `http://` and `https://` schemes, disallowing `javascript:` and `data:` URLs.

### V1.2.3 — Output Encoding for JavaScript and JSON Content
- **Requirement**: *Verify that output encoding or escaping is used when dynamically building JavaScript content (including JSON), to avoid changing the message or document structure (to avoid JavaScript and JSON injection).*
- **Control & Evidence**:
  - **Backend**: All API responses are serialized exclusively through Django REST Framework's `JSONRenderer` (`DEFAULT_RENDERER_CLASSES = ["rest_framework.renderers.JSONRenderer"]` in `backend/mysite/settings.py`), `django.http.JsonResponse`, and `json.loads`/`json.dumps`. DRF's `JSONRenderer` escapes special characters (quotes, backslashes, control characters, and Unicode line/paragraph separators `\u2028` and `\u2029`) so untrusted data cannot break out of JSON strings or alter document structure.
  - **Frontend**: All JSON request payloads in `frontend/src/utils/api.js` (`post`, `patch`) and `localStorage` serialization in `frontend/src/Login.jsx` are constructed exclusively with `JSON.stringify()` and parsed with `JSON.parse()` — never via string concatenation or template interpolation.
  - **Verification**: Tested in `backend/core/tests/test_v1_encoding_sanitization.py` (`test_v1_2_3_json_output_encoding_prevents_js_and_json_injection`).

### V1.2.4 — Parameterized Queries & ORM Protection Against SQL Injection
- **Requirement**: *Verify that data selection or database queries (e.g., SQL, HQL, NoSQL, Cypher) use parameterized queries, ORMs, entity frameworks, or are otherwise protected from SQL Injection and other database injection attacks.*
- **Control & Evidence**:
  - **Backend**: All database queries across `SubjectViewSet`, `TimetableEntryViewSet`, `TaskViewSet`, `ReminderViewSet`, `OAuthAccountViewSet`, `GoogleAccount`, and `send_reminders` management command exclusively use the **Django ORM** (`filter()`, `exclude()`, `get_or_create()`, `update_or_create()`, `create()`), which uses parameterized SQL queries via the MySQL database driver.
  - No raw SQL functions (`.raw()`, `.extra()`, `cursor.execute()`, `RawSQL`) or stored procedures are used anywhere in the codebase.
  - **Verification**: Tested in `backend/core/tests/test_v1_encoding_sanitization.py` (`test_v1_2_4_orm_parameterized_queries_prevent_sql_injection` and `test_v1_2_4_no_raw_sql_in_core_app`).

### V1.2.5 — OS Command Injection Prevention
- **Control**: No `os.system()`, `subprocess`, `popen()`, or shell execution calls are used anywhere in the application.

---

## V1.3 Sanitization

### V1.3.2 — Dynamic Code Execution Avoidance
- **Control**: Neither `eval()`, `exec()`, `Function()`, nor dynamic expression evaluation is used in the backend Python or frontend JavaScript codebase.
