# backend/core/views.py
import json, os, urllib.parse
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import redirect
from django.views.decorators.http import require_GET
from django.core.signing import dumps, loads, BadSignature, SignatureExpired

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from .models import GoogleAccount

# ---- Scopes (NO coursework scope needed) ----
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
]

def _client_config():
    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "project_id": "uniplan-local",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            "javascript_origins": ["http://127.0.0.1:5173", "http://localhost:5173"],
        }
    }

# ---- signed token helpers (demo) ----
def _sign(email: str) -> str:
    return dumps({"sub": email}, salt="uniplan", key=settings.SECRET_KEY)

def _unsign(token: str):
    try:
        return loads(token, salt="uniplan", key=settings.SECRET_KEY, max_age=60 * 60 * 8)["sub"]
    except (BadSignature, SignatureExpired, KeyError):
        return None

def _creds_for(email: str):
    try:
        acc = GoogleAccount.objects.get(pk=email)
    except GoogleAccount.DoesNotExist:
        return None
    return Credentials.from_authorized_user_info(acc.credentials, SCOPES)

@require_GET
def hello(request):
    return JsonResponse({"ok": True})

# ---- OAuth ----
@require_GET
def google_login(request):
    flow = Flow.from_client_config(
        _client_config(), scopes=SCOPES, redirect_uri=settings.GOOGLE_REDIRECT_URI
    )
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return JsonResponse({"auth_url": auth_url})

@require_GET
def google_callback(request):
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing code")

    flow = Flow.from_client_config(
        _client_config(), scopes=SCOPES, redirect_uri=settings.GOOGLE_REDIRECT_URI
    )
    flow.fetch_token(code=code)
    creds: Credentials = flow.credentials

    oauth2 = build("oauth2", "v2", credentials=creds)
    me = oauth2.userinfo().get().execute()
    email = me.get("email")
    name = me.get("name", "")
    picture = me.get("picture", "")

    GoogleAccount.objects.update_or_create(
        email=email,
        defaults={"credentials": json.loads(creds.to_json()), "name": name, "picture": picture},
    )

    token = _sign(email)
    frontend_redirect = os.getenv("FRONTEND_REDIRECT", "http://localhost:5173")

    qs = urllib.parse.urlencode({"token": token, "email": email, "name": name, "picture": picture})
    return redirect(f"{frontend_redirect}?{qs}")

# ---- auth guard ----
def _require_auth(request):
    authz = request.META.get("HTTP_AUTHORIZATION", "")
    if not authz.startswith("Bearer "):
        return None, JsonResponse({"detail": "Missing bearer token"}, status=401)

    email = _unsign(authz.split(" ", 1)[1])
    if not email:
        return None, JsonResponse({"detail": "Invalid/expired token"}, status=401)

    creds = _creds_for(email)
    if not creds:
        return None, JsonResponse({"detail": "No Google credentials stored"}, status=401)

    # refresh if needed and persist
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        try:
            acc = GoogleAccount.objects.get(pk=email)
            acc.credentials = json.loads(creds.to_json())
            acc.save(update_fields=["credentials"])
        except GoogleAccount.DoesNotExist:
            pass

    return (email, creds), None

# ---- Classroom API ----
@require_GET
def list_courses(request):
    """Return ACTIVE courses only."""
    auth, err = _require_auth(request)
    if err: return err
    _, creds = auth

    classroom = build("classroom", "v1", credentials=creds)
    data = classroom.courses().list(pageSize=50, courseStates=["ACTIVE"]).execute()
    return JsonResponse(data)

@require_GET
def list_active_submissions(request, course_id: str):
    """
    Return *my* active (pending) submissions for a given course.
    Active states: NEW, CREATED, RECLAIMED_BY_STUDENT
    """
    auth, err = _require_auth(request)
    if err: return err
    _, creds = auth

    classroom = build("classroom", "v1", credentials=creds)
    data = classroom.courses().courseWork().studentSubmissions().list(
        courseId=course_id,
        courseWorkId="-",  # across all coursework in the course
        pageSize=100,
        states=["NEW", "CREATED", "RECLAIMED_BY_STUDENT"],
    ).execute()
    return JsonResponse(data)

@require_GET
def summary(request):
    """Small summary for the header."""
    auth, err = _require_auth(request)
    if err: return err
    email, creds = auth

    classroom = build("classroom", "v1", credentials=creds)
    courses = classroom.courses().list(pageSize=50, courseStates=["ACTIVE"]).execute().get("courses", [])
    return JsonResponse({
        "email": email,
        "courseCount": len(courses),
        "courses": [{"id": c.get("id"), "name": c.get("name"), "section": c.get("section")} for c in courses],
    })
