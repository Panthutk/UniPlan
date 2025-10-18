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
from rest_framework import viewsets, permissions
from .models import Subject, TimetableEntry, Task, Reminder, ClassroomCourse, ClassroomAssignment, OAuthAccount
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from rest_framework import mixins
from .serializers import (
    SubjectSerializer,
    TimetableEntrySerializer,
    TaskSerializer,
    ReminderSerializer,
    ClassroomCourseSerializer,
    ClassroomAssignmentSerializer,
    OAuthAccountSerializer,
    ReminderIntakeSerializer,  # <-- add this here
)


# ---- Scopes----
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me",
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
    Return *my* active (pending) submissions for a given course,
    augmented with coursework title/due/link.
    Active states: NEW, CREATED, RECLAIMED_BY_STUDENT
    """
    auth, err = _require_auth(request)
    if err:
        return err
    _, creds = auth

    classroom = build("classroom", "v1", credentials=creds)

    # fetch my active submissions
    data = classroom.courses().courseWork().studentSubmissions().list(
        courseId=course_id,
        courseWorkId="-",  # all coursework in the course
        pageSize=100,
        states=["NEW", "CREATED", "RECLAIMED_BY_STUDENT"],
    ).execute()

    subs = data.get("studentSubmissions", [])
    if not subs:
        return JsonResponse({"studentSubmissions": []})

    # fetch coursework objects once per ID (so we can attach title/due/link)
    cw_ids = sorted({s.get("courseWorkId") for s in subs if s.get("courseWorkId")})
    cw_map = {}
    for cw_id in cw_ids:
        try:
            cw_map[cw_id] = classroom.courses().courseWork().get(
                courseId=course_id, id=cw_id
            ).execute()
        except Exception:
            pass  # ignore if missing

    # merge coursework info into each submission
    for s in subs:
        cw = cw_map.get(s.get("courseWorkId"))
        if not cw:
            continue
        if cw.get("title"):
            s["title"] = cw["title"]
        if cw.get("alternateLink"):
            s["alternateLink"] = cw["alternateLink"]
        if cw.get("dueDate"):
            s["dueDate"] = cw["dueDate"]       # {year, month, day}
        if cw.get("dueTime"):
            s["dueTime"] = cw["dueTime"]       # {hours, minutes}

    return JsonResponse({"studentSubmissions": subs})

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

@api_view(["GET"])
@permission_classes([permissions.AllowAny])  # it will return id: null if not logged in
def echo_auth(request):
    return Response({
        "auth_meta": request.META.get("HTTP_AUTHORIZATION"),
        "auth_header": request.headers.get("Authorization"),  # DRF’s header helper
        "is_authenticated": bool(getattr(request.user, "is_authenticated", False)),
        "user": getattr(request.user, "username", None),
    })

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def whoami(request):
    u = request.user
    if not u.is_authenticated:
        return Response({"id": None})
    return Response({"id": u.id, "email": u.email, "username": u.username})

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.none()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # only the caller's subjects
        return Subject.objects.filter(user=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)
        
class TimetableEntryViewSet(viewsets.ModelViewSet):
    queryset = TimetableEntry.objects.none()
    serializer_class = TimetableEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TimetableEntry.objects.filter(user=self.request.user).order_by("day_of_week", "start_time")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.none()            # <-- add this
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).order_by("-created_at")
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ReminderViewSet(viewsets.ModelViewSet):
    queryset = Reminder.objects.none()        # <-- add this
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return (Reminder.objects
                .filter(task__user=self.request.user)
                .select_related("task")
                .order_by("-notify_at"))



class ClassroomCourseViewSet(viewsets.ModelViewSet):
    queryset = ClassroomCourse.objects.all()
    serializer_class = ClassroomCourseSerializer

class ClassroomAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ClassroomAssignment.objects.all()
    serializer_class = ClassroomAssignmentSerializer

class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id

class OAuthAccountViewSet(viewsets.ModelViewSet):
    queryset = OAuthAccount.objects.all() 
    serializer_class = OAuthAccountSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        # only their own accounts
        return OAuthAccount.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        
        
class ReminderIntakeViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    POST /api/reminders/intake/
    Body: { assignmentId, courseName?, title, dueISO, remindAtISO, offsetDays?, link? }
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReminderIntakeSerializer
    queryset = Reminder.objects.none()  # <-- instead of []

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
