import io
import csv
from datetime import timedelta
import pytest
from django.urls import reverse
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from core.models import Subject, Task
from core.authorization import ensure_consumer_grants


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="v2user", email="v2@example.com", password="pw")
    ensure_consumer_grants(user)
    client = APIClient()
    client.login(username="v2user", password="pw")
    return client, user


def test_v2_subject_color_hex_validation(auth_client):
    client, _ = auth_client
    bad_resp = client.post(
        "/api/subjects/",
        {"name": "Algorithms", "code": "cs-101", "color_hex": "not-a-hex"},
        format="json",
    )
    assert bad_resp.status_code == 400
    assert "color_hex" in bad_resp.json()

    ok_resp = client.post(
        "/api/subjects/",
        {"name": "Algorithms", "code": "cs-101", "color_hex": "#1f2937"},
        format="json",
    )
    assert ok_resp.status_code == 201


def test_v2_timetable_time_order_and_overlap_validation(auth_client):
    client, user = auth_client
    subj = Subject.objects.create(user=user, name="Networks", code="net-1", color_hex="#123456")

    # End time before start time -> rejected
    bad_order = client.post(
        "/api/timetable/",
        {"subject": subj.id, "day_of_week": 1, "start_time": "10:00:00", "end_time": "09:00:00"},
        format="json",
    )
    assert bad_order.status_code == 400

    # Valid entry -> accepted
    first = client.post(
        "/api/timetable/",
        {"subject": subj.id, "day_of_week": 1, "start_time": "09:00:00", "end_time": "11:00:00"},
        format="json",
    )
    assert first.status_code == 201

    # Overlapping entry on same day -> rejected
    overlap = client.post(
        "/api/timetable/",
        {"subject": subj.id, "day_of_week": 1, "start_time": "10:00:00", "end_time": "12:00:00"},
        format="json",
    )
    assert overlap.status_code == 400


def test_v2_task_and_reminder_validation(auth_client):
    client, user = auth_client

    # Invalid priority enum -> rejected
    bad_prio = client.post(
        "/api/tasks/",
        {"title": "HW 1", "priority": "ultra-urgent"},
        format="json",
    )
    assert bad_prio.status_code == 400

    # Reminder for task with due date in the past -> rejected
    past_task = Task.objects.create(
        user=user,
        title="Past HW",
        due_at=timezone.now() - timedelta(days=2),
    )
    bad_rem = client.post(
        "/api/reminders/",
        {"task": past_task.id, "channel": "email", "days_before": 1},
        format="json",
    )
    assert bad_rem.status_code == 400


def test_v2_csv_import_rejects_invalid_time_range(auth_client):
    client, _ = auth_client
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["subject", "day_of_week", "start_time", "end_time", "room"])
    writer.writerow(["Security", 2, "14:00", "13:00", "B201"])

    f = SimpleUploadedFile("timetable.csv", buf.getvalue().encode("utf-8"), content_type="text/csv")
    resp = client.post(reverse("timetable-import"), {"file": f}, format="multipart")
    assert resp.status_code == 400
    assert any("end_time must be after start_time" in e for e in resp.json().get("errors", []))
