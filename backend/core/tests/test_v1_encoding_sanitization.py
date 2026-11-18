import json
from pathlib import Path
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from core.models import Subject, Task
from core.authorization import ensure_consumer_grants


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="v1user", email="v1@example.com", password="pw")
    ensure_consumer_grants(user)
    client = APIClient()
    client.login(username="v1user", password="pw")
    return client, user


def test_v1_2_3_json_output_encoding_prevents_js_and_json_injection(auth_client):
    """
    ASVS V1.2.3: Verify that output encoding or escaping is used when dynamically
    building JavaScript content (including JSON), to avoid changing the message
    or document structure (to avoid JavaScript and JSON injection).
    """
    client, _ = auth_client
    malicious_title = '</script><script>alert("xss")</script>","is_admin":true,"x":"'
    malicious_source = 'manual","injected":1'

    resp = client.post(
        "/api/tasks/",
        {
            "title": malicious_title,
            "source": malicious_source,
            "assignment_alt_link": "https://classroom.google.com/c/123",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp["Content-Type"].startswith("application/json")

    # Raw JSON bytes must parse cleanly as a single JSON object without injected keys
    parsed = json.loads(resp.content.decode("utf-8"))
    assert "is_admin" not in parsed
    assert "injected" not in parsed
    assert parsed["title"] == malicious_title
    assert parsed["source"] == malicious_source


def test_v1_2_2_and_v1_2_3_rejects_unsafe_url_protocols(auth_client):
    """
    Verify that unsafe URL protocols such as javascript: or data: are rejected.
    """
    client, _ = auth_client
    resp = client.post(
        "/api/tasks/",
        {
            "title": "Bad Link Task",
            "assignment_alt_link": "javascript:alert(1)",
        },
        format="json",
    )
    assert resp.status_code == 400


def test_v1_2_4_orm_parameterized_queries_prevent_sql_injection(auth_client):
    """
    ASVS V1.2.4: Verify that data selection or database queries use parameterized
    queries, ORMs, or are otherwise protected from SQL Injection.
    """
    client, user = auth_client
    other_user = User.objects.create_user(username="other", email="other@example.com", password="pw")
    ensure_consumer_grants(other_user)
    Task.objects.create(user=user, title="My Safe Task", source="manual")
    Task.objects.create(user=other_user, title="Secret Other Task", source="classroom")

    # Attempt SQL injection via query parameter ?source=
    sqli_payload = "manual' OR '1'='1' -- "
    resp = client.get("/api/tasks/", {"source": sqli_payload})
    assert resp.status_code == 200
    assert resp.json() == []

    # Attempt SQL injection via model field creation
    subj_resp = client.post(
        "/api/subjects/",
        {
            "name": "Math'); DROP TABLE core_subject; --",
            "code": "math-101",
            "color_hex": "#1f2937",
        },
        format="json",
    )
    assert subj_resp.status_code == 201
    assert Subject.objects.filter(user=user).count() == 1


def test_v1_2_4_no_raw_sql_in_core_app():
    """
    ASVS V1.2.4: Static verification that no raw SQL execution methods
    (.raw(), .extra(), cursor.execute()) are used in backend/core.
    """
    core_dir = Path(__file__).resolve().parent.parent
    forbidden_patterns = [".raw(", ".extra(", "cursor.execute(", "RawSQL("]

    for py_file in core_dir.rglob("*.py"):
        if "tests" in py_file.parts or "migrations" in py_file.parts:
            continue
        source = py_file.read_text(encoding="utf-8")
        for pat in forbidden_patterns:
            assert pat not in source, f"Forbidden raw SQL pattern '{pat}' found in {py_file}"
