# backend/core/views.py
import json
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_GET
from django.core.signing import dumps, loads, BadSignature, SignatureExpired

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from .models import GoogleAccount

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

def _sign(email: str) -> str:
    return dumps({"sub": email}, salt="uniplan", key=settings.SECRET_KEY)

def _unsign(token: str):
    try:
        return loads(token, salt="uniplan", key=settings.SECRET_KEY, max_age=60*60*8)["sub"]
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

@require_GET
def google_login(request):
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=settings.GOOGLE_REDIRECT_URI)
    auth_url, _ = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    return JsonResponse({"auth_url": auth_url})

@require_GET
def google_callback(request):
    code = request.GET.get("code")
    if not code:
        return HttpResponseBadRequest("Missing code")

    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=settings.GOOGLE_REDIRECT_URI)
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
    return JsonResponse({"token": token, "user": {"email": email, "name": name, "picture": picture}})

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
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # persist refreshed creds
        from .models import GoogleAccount as GA
        acc = GA.objects.get(pk=email)
        acc.credentials = json.loads(creds.to_json())
        acc.save(update_fields=["credentials"])
    return (email, creds), None

@require_GET
def list_courses(request):
    auth, err = _require_auth(request)
    if err: return err
    _, creds = auth
    classroom = build("classroom", "v1", credentials=creds)
    data = classroom.courses().list(pageSize=50).execute()
    return JsonResponse(data)

@require_GET
def summary(request):
    auth, err = _require_auth(request)
    if err: return err
    email, creds = auth
    classroom = build("classroom", "v1", credentials=creds)
    courses = classroom.courses().list(pageSize=50).execute().get("courses", [])
    out = {"email": email, "courseCount": len(courses),
           "courses": [{"id": c.get("id"), "name": c.get("name"), "section": c.get("section")} for c in courses]}
    return JsonResponse(out)
