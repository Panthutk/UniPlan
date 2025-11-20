import io, csv
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
import pytest
from django.contrib.auth.models import User
from core.models import TimetableEntry, Subject

@pytest.fixture
def auth_client(db):
    u = User.objects.create_user(username="u", email="u@x.com", password="pw")
    c = APIClient()
    c.login(username="u", password="pw")
    return c, u

def make_csv(rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["subject","day_of_week","start_time","end_time","room"])
    for r in rows: w.writerow(r)
    return buf.getvalue().encode("utf-8")

def test_import_rejects_non_csv(auth_client):
    c, _ = auth_client
    f = SimpleUploadedFile("video.mp4", b"\x00\x00\x00\x18ftypmp42", content_type="video/mp4")
    url = reverse("timetable-import")  # DRF router name: <basename>-import
    resp = c.post(url, {"file": f}, format="multipart")
    assert resp.status_code in (400, 415)

def test_import_valid_csv_creates_entries(auth_client):
    c, u = auth_client
    data = make_csv([
        ["Math", 1, "08:00", "09:00", "R101"],
        ["Physics", 3, "10:00", "11:00", ""],
    ])
    f = SimpleUploadedFile("timetable.csv", data, content_type="text/csv")
    url = reverse("timetable-import")
    resp = c.post(url, {"file": f}, format="multipart")
    assert resp.status_code == 200
    assert resp.json()["replaced"] == 2
    assert TimetableEntry.objects.filter(user=u).count() == 2
    assert Subject.objects.filter(user=u).count() == 2

def test_import_rejects_bad_header(auth_client):
    c, _ = auth_client
    bad = io.BytesIO(b"foo,bar,baz\n1,2,3\n")
    f = SimpleUploadedFile("timetable.csv", bad.read(), content_type="text/csv")
    url = reverse("timetable-import")
    resp = c.post(url, {"file": f}, format="multipart")
    assert resp.status_code == 400
    assert "Missing required columns" in resp.json()["detail"]

def test_export_round_trip(auth_client):
    c, _ = auth_client
    # seed through import
    data = make_csv([["Math", 1, "08:00", "09:00", "R101"]])
    c.post(reverse("timetable-import"),
           {"file": SimpleUploadedFile("t.csv", data, content_type="text/csv")},
           format="multipart")
    r = c.get(reverse("timetable-export"))
    assert r.status_code == 200
    assert r["Content-Type"].startswith("text/csv")
    content = r.content.decode()
    assert "subject,day_of_week,start_time,end_time,room" in content.splitlines()[0]
    assert "Math" in content
