import logging
from django.conf import settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from rest_framework.test import APIClient, APIRequestFactory
import pytest
from core.views import _sign
from core.exceptions import security_exception_handler


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="v16user@example.com", email="v16user@example.com", password="pw")
    client = APIClient()
    client.login(username="v16user@example.com", password="pw")
    return client, user


def test_v16_1_1_structured_logging_configuration_exists():
    """
    ASVS V16.1.1: Verify structured logging configuration is defined in settings.LOGGING.
    """
    assert hasattr(settings, "LOGGING")
    loggers = settings.LOGGING.get("loggers", {})
    assert "security.auth" in loggers
    assert "security.errors" in loggers
    assert "security_structured" in settings.LOGGING.get("formatters", {})


def test_v16_3_1_logs_successful_and_failed_token_authentication(db, caplog):
    """
    ASVS V16.3.1: Verify that all authentication operations are logged,
    including successful and unsuccessful attempts, with auth_type metadata
    and without leaking raw tokens.
    """
    client = APIClient()

    # 1) Successful Bearer token authentication
    valid_token = _sign("student@uniplan.edu")
    with caplog.at_level(logging.INFO, logger="security.auth"):
        resp = client.get("/api/subjects/", HTTP_AUTHORIZATION=f"Bearer {valid_token}")
    assert resp.status_code == 200
    assert any(
        "event=auth_success" in rec.message
        and "user=student@uniplan.edu" in rec.message
        and "auth_type=bearer_signed_token" in rec.message
        for rec in caplog.records
    )

    caplog.clear()

    # 2) Failed Bearer token authentication (tampered token)
    bad_token = "tampered.secret.token.value"
    with caplog.at_level(logging.WARNING, logger="security.auth"):
        resp_bad = client.get("/api/subjects/", HTTP_AUTHORIZATION=f"Bearer {bad_token}")
    assert resp_bad.status_code in (401, 403)
    assert any(
        "event=token_validation_failed" in rec.message and "reason=bad_signature" in rec.message
        for rec in caplog.records
    )
    assert any(
        "event=auth_failure" in rec.message and "auth_type=bearer_signed_token" in rec.message
        for rec in caplog.records
    )
    # Ensure the raw secret token itself is never logged
    for rec in caplog.records:
        assert bad_token not in rec.message


def test_v16_3_1_logs_oauth_callback_missing_code(caplog):
    """
    ASVS V16.3.1: Verify failed OAuth callback without code logs a warning.
    """
    client = APIClient()
    with caplog.at_level(logging.WARNING, logger="security.auth"):
        resp = client.get("/api/auth/google/callback")
    assert resp.status_code == 400
    assert any(
        "event=oauth_callback_failure" in rec.message and "reason=missing_code" in rec.message
        for rec in caplog.records
    )


def test_v16_3_4_logs_security_control_failures_and_unexpected_errors(auth_client, caplog):
    """
    ASVS V16.3.4: Verify that security control failures (e.g., rejected file upload)
    and unexpected errors are logged to security.errors.
    """
    client, _ = auth_client

    # 1) Security control failure on CSV import (invalid extension)
    bad_file = SimpleUploadedFile("exploit.exe", b"MZ\x90\x00", content_type="application/octet-stream")
    with caplog.at_level(logging.WARNING, logger="security.errors"):
        resp = client.post(reverse("timetable-import"), {"file": bad_file}, format="multipart")
    assert resp.status_code == 400
    assert any(
        "event=csv_import_rejected" in rec.message and "reason=invalid_extension" in rec.message
        for rec in caplog.records
    )

    caplog.clear()

    # 2) Unexpected unhandled exception logged by security_exception_handler
    factory = APIRequestFactory()
    request = factory.get("/api/tasks/")
    with caplog.at_level(logging.ERROR, logger="security.errors"):
        err_resp = security_exception_handler(
            RuntimeError("Simulated backend TLS failure"),
            {"request": request, "view": None},
        )
    assert err_resp.status_code == 500
    assert err_resp.data == {"detail": "An unexpected server error occurred."}
    assert any(
        "event=unhandled_exception" in rec.message and "Simulated backend TLS failure" in rec.message
        for rec in caplog.records
    )
