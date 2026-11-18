# backend/core/views.py
import csv
import io
import re
import json, os, secrets, time, urllib.parse
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse
from django.shortcuts import redirect
from django.views.decorators.http import require_GET
from django.utils import timezone

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from .models import GoogleAccount
from rest_framework import viewsets
from .models import Subject, TimetableEntry, Task, Reminder, ClassroomCourse, ClassroomAssignment, OAuthAccount
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django.core.mail import send_mail
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
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from .authorization import (
    FunctionAuthorizedMixin,
    HasFunctionPermission,
    ensure_consumer_grants,
    user_has_function_permission,
)
from .tokens import issue_session_token, verify_session_token, decode_session_token

from django.core.files.uploadedfile import UploadedFile

import logging
logger = logging.getLogger("security")


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

# ---- V7.2.3 / V14.2.1: Signed token helpers ----
def _sign(email: str) -> str:
    """Create a signed session token with ≥128 bits of entropy (V7.2.3)."""
    return issue_session_token(email)

def _unsign(token: str):
    """
    Verify and decode a signed token.
    Returns (email, issued_at_timestamp) or (None, None).
    Also checks V7.4.2: reject tokens issued before account's token_valid_after.
    """
    return decode_session_token(token)

def _creds_for(email: str):
    try:
        acc = GoogleAccount.objects.get(pk=email)
    except GoogleAccount.DoesNotExist:
        return None
    return Credentials.from_authorized_user_info(acc.credentials, SCOPES)


# ---- V3.3.1 / V14.2.1: Cookie helpers ----

def _set_auth_cookie(response, token):
    """Set a secure, HttpOnly auth cookie (V3.3.1, V3.3.4, V14.2.1)."""
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        max_age=settings.AUTH_COOKIE_MAX_AGE,
        httponly=settings.AUTH_COOKIE_HTTPONLY,  # V3.3.4
        secure=settings.AUTH_COOKIE_SECURE,      # V3.3.1
        samesite=settings.AUTH_COOKIE_SAMESITE,  # V3.3.2
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
    )
    return response

def _clear_auth_cookie(response):
    """Clear the auth cookie on logout (V14.3.1)."""
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path=settings.AUTH_COOKIE_PATH,
        domain=settings.AUTH_COOKIE_DOMAIN,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )
    return response

def _get_token_from_request(request):
    """
    Read the auth token from (1) HttpOnly cookie or (2) Authorization header.
    Cookie is preferred (V14.2.1); header kept for backward compatibility.
    """
    # Try cookie first
    token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
    if token:
        return token

    # Fallback: Authorization header (for API clients / mobile)
    authz = request.META.get("HTTP_AUTHORIZATION", "")
    if authz.startswith("Bearer "):
        return authz.split(" ", 1)[1].strip()

    return None


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
    """
    OAuth callback — V14.2.1: No longer passes token/email/name in URL.
    Sets an HttpOnly cookie with the signed token and passes only non-sensitive
    user info via a short-lived query param.
    """
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

    User = get_user_model()
    user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
    if user.email != email:
        user.email = email
        user.save(update_fields=["email"])
    ensure_consumer_grants(user)

    # V14.2.1 — Token goes into HttpOnly cookie, NOT in URL
    token = issue_session_token(email)
    frontend_url = getattr(settings, "FRONTEND_URL", os.getenv("FRONTEND_REDIRECT", "http://localhost:5173"))

    # Only pass non-sensitive display info via URL (name & picture are public profile data)
    qs = urllib.parse.urlencode({"login": "success", "name": name, "picture": picture})
    response = redirect(f"{frontend_url}?{qs}")
    _set_auth_cookie(response, token)

    logger.info("Successful OAuth login for %s", email)
    return response


# ---- V7.4.2 + V14.3.1: Logout endpoint ----
@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """
    Logout: invalidate token (V7.4.2) + clear client storage (V14.3.1).
    """
    token = _get_token_from_request(request)
    if token:
        email, _ = _unsign(token)
        if email:
            # V7.4.2 — Invalidate all tokens issued before now
            try:
                acc = GoogleAccount.objects.get(pk=email)
                acc.token_valid_after = timezone.now()
                acc.save(update_fields=["token_valid_after"])
                logger.info("Logout: invalidated all sessions for %s", email)
            except GoogleAccount.DoesNotExist:
                pass

    response = Response({"detail": "Logged out"})

    # V14.3.1 — Clear auth cookie
    _clear_auth_cookie(response)

    # V14.3.1 — Clear-Site-Data header to wipe browser storage
    response["Clear-Site-Data"] = '"cookies", "storage"'

    return response


# ---- auth guard (for non-DRF views) ----
def _require_auth(request):
    token = _get_token_from_request(request)
    if not token:
        return None, JsonResponse({"detail": "Missing authentication"}, status=401)

    email = verify_session_token(token)
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


def _require_function_permission(email, permission_code):
    User = get_user_model()
    user = User.objects.filter(username=email).first() or User.objects.filter(email=email).first()
    if user is None or not user_has_function_permission(user, permission_code):
        return JsonResponse(
            {"detail": "You do not have permission to perform this function."},
            status=403,
        )
    return None

# ---- Classroom API ----
@require_GET
def list_courses(request):
    """Return ACTIVE courses only."""
    auth, err = _require_auth(request)
    if err: return err
    email, creds = auth
    denied = _require_function_permission(email, "classroom.read")
    if denied:
        return denied

    classroom = build("classroom", "v1", credentials=creds)
    data = classroom.courses().list(pageSize=50, courseStates=["ACTIVE"]).execute()
    courses = [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "section": c.get("section"),
        }
        for c in data.get("courses", [])
    ]
    return JsonResponse({"courses": courses})

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
    email, creds = auth
    denied = _require_function_permission(email, "classroom.read")
    if denied:
        return denied

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

    trimmed = []
    for s in subs:
        trimmed.append({
            "id": s.get("id"),
            "courseId": s.get("courseId"),
            "courseWorkId": s.get("courseWorkId"),
            "title": s.get("title"),
            "alternateLink": s.get("alternateLink"),
            "state": s.get("state"),
            "dueDate": s.get("dueDate"),
            "dueTime": s.get("dueTime"),
            "updateTime": s.get("updateTime"),
            "creationTime": s.get("creationTime"),
        })
    return JsonResponse({"studentSubmissions": trimmed})

@require_GET
def summary(request):
    """Small summary for the header."""
    auth, err = _require_auth(request)
    if err: return err
    email, creds = auth
    denied = _require_function_permission(email, "classroom.read")
    if denied:
        return denied

    classroom = build("classroom", "v1", credentials=creds)
    courses = classroom.courses().list(pageSize=50, courseStates=["ACTIVE"]).execute().get("courses", [])
    return JsonResponse({
        "email": email,
        "courseCount": len(courses),
        "courses": [{"id": c.get("id"), "name": c.get("name"), "section": c.get("section")} for c in courses],
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated, HasFunctionPermission("debug.read")])
def echo_auth(request):
    return Response({
        "is_authenticated": bool(getattr(request.user, "is_authenticated", False)),
        "user": getattr(request.user, "username", None),
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated, HasFunctionPermission("account.read")])
def whoami(request):
    u = request.user
    return Response({"id": u.id, "email": u.email, "username": u.username})

class SubjectViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.none()
    serializer_class = SubjectSerializer
    read_permission = "subjects.read"
    write_permission = "subjects.write"

    def get_queryset(self):
        return Subject.objects.filter(user=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)
        
class TimetableEntryViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = TimetableEntry.objects.none()
    serializer_class = TimetableEntrySerializer
    read_permission = "timetable.read"
    write_permission = "timetable.write"
    function_permissions = {
        "export_csv": "timetable.read",
        "import_csv": "timetable.write",
    }

    def get_queryset(self):
        return TimetableEntry.objects.filter(user=self.request.user).order_by("day_of_week", "start_time")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="export", url_name="export")
    def export_csv(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)

        rows = (
            TimetableEntry.objects
            .filter(user=user)
            .select_related("subject")
            .order_by("day_of_week", "start_time")
        )

        # build CSV
        resp = HttpResponse(content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="timetable.csv"'
        writer = csv.writer(resp)
        # headers — keep simple and stable
        writer.writerow(["subject", "day_of_week", "start_time", "end_time", "room"])
        for r in rows:
            writer.writerow([
                r.subject.name if r.subject else "",
                r.day_of_week,                 # backend 0=Sun..6=Sat
                r.start_time.strftime("%H:%M:%S"),
                r.end_time.strftime("%H:%M:%S"),
                r.room or "",
            ])
        return resp

    @action(detail=False, methods=["post"], url_path="import", url_name="import")
    def import_csv(self, request):
        MAX_BYTES = 1_000_000  # 1 MB
        ALLOWED_MIMES = {"text/csv", "application/csv", "application/vnd.ms-excel"}  # browsers vary
        TIME_RE = re.compile(r"^\d{2}:\d{2}(:\d{2})?$")

        user = request.user
        if not user or not user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)

        f: UploadedFile | None = request.FILES.get("file")
        if not f:
            return Response({"detail": "No file uploaded (field name must be 'file')."}, status=400)

        # 1) quick guards
        name = (f.name or "").lower()
        ctype = (f.content_type or "").lower()
        if not name.endswith(".csv"):
            return Response({"detail": "Only .csv files are accepted."}, status=400)
        if ctype and ctype not in ALLOWED_MIMES:
            return Response({"detail": f"Unsupported content-type '{ctype}'."}, status=415)
        if f.size and f.size > MAX_BYTES:
            return Response({"detail": f"File too large (> {MAX_BYTES//1000} KB)."}, status=413)

        # 2) decode (tolerate BOM)
        raw = f.read()
        try:
            text = raw.decode("utf-8-sig")
        except Exception:
            try:
                text = raw.decode("utf-8")
            except Exception:
                return Response({"detail": "File is not valid UTF-8 text."}, status=400)

        # 3) sniff CSV
        sample = text[:4096]
        if "," not in sample and ";" not in sample and "\t" not in sample:
            return Response({"detail": "Not a CSV-like text file."}, status=400)

        # 4) dialect + reader
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except Exception:
            dialect = csv.excel
            dialect.delimiter = ","

        reader = csv.DictReader(io.StringIO(text), dialect=dialect)

        required_any = {"subject", "subject_name"}
        required_all = {"day_of_week", "start_time", "end_time"}  # 'room' optional

        header = {h.strip().lower() for h in (reader.fieldnames or [])}
        if not header:
            return Response({"detail": "CSV has no header row."}, status=400)
        if header.isdisjoint(required_any) or not required_all.issubset(header):
            return Response({"detail": "Missing required columns. Need: subject(or subject_name), day_of_week, start_time, end_time."}, status=400)

        # 5) validate rows first (collect errors; do NOT write yet)
        errors = []
        rows = []
        day_map = {"sun":0,"sunday":0,"mon":1,"monday":1,"tue":2,"tuesday":2,"wed":3,"wednesday":3,"thu":4,"thursday":4,"fri":5,"friday":5,"sat":6,"saturday":6}

        def norm_time(s):
            s = (s or "").strip()
            if not s or not TIME_RE.match(s): return None
            return s if len(s) == 8 else s + ":00"  # HH:MM -> HH:MM:SS

        for i, row in enumerate(reader, start=2):  # data starts at line 2
            subj = (row.get("subject") or row.get("subject_name") or "").strip()
            dow_raw = (row.get("day_of_week") or "").strip()
            st = norm_time(row.get("start_time"))
            et = norm_time(row.get("end_time"))
            rm = (row.get("room") or "").strip()

            if not subj:
                errors.append(f"Line {i}: subject empty"); continue
            if dow_raw == "":
                errors.append(f"Line {i}: day_of_week empty"); continue
            try:
                dow = int(dow_raw)
            except ValueError:
                dow = day_map.get(dow_raw.lower())
            if dow is None or not (0 <= dow <= 6):
                errors.append(f"Line {i}: invalid day_of_week '{dow_raw}'"); continue
            if not st or not et:
                errors.append(f"Line {i}: invalid time (use HH:MM or HH:MM:SS)"); continue

            rows.append((subj, dow, st, et, rm))

        if errors:
            return Response({"detail": "CSV validation failed.", "errors": errors[:50]}, status=400)

        # 6) apply (replace)
        Subject = self.serializer_class.Meta.model._meta.apps.get_model("core", "Subject")
        TimetableEntry = self.serializer_class.Meta.model

        TimetableEntry.objects.filter(user=user).delete()
        created = 0
        for subj_name, dow, st, et, rm in rows:
            subj, _ = Subject.objects.get_or_create(
                user=user,
                name=subj_name,
                defaults={"code": subj_name.lower().replace(" ", "-")[:30], "color_hex": "#888888"},
            )
            TimetableEntry.objects.create(
                user=user, subject=subj, day_of_week=dow, start_time=st, end_time=et, room=rm
            )
            created += 1

        return Response({"replaced": created}, status=200)


class TaskViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = Task.objects.none()
    serializer_class = TaskSerializer
    read_permission = "tasks.read"
    write_permission = "tasks.write"
    function_permissions = {
        "archive": "tasks.write",
        "unarchive": "tasks.write",
    }
    
    
    def get_queryset(self):
        qs = (
            Task.objects
            .filter(user=self.request.user)
            .select_related("subject")
            .order_by("due_at", "priority")
        )
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)

        open_only = self.request.query_params.get("open", "true").lower() == "true"
        if open_only:
            qs = qs.exclude(status="COMPLETED")

        # Special case: allow archived tasks for unarchive action
        if getattr(self, "action", None) == "unarchive":
            return qs  # don't hide archived ones

        # Hide archived tasks by default unless ?archived=true
        show_archived = self.request.query_params.get("archived", "false").lower() == "true"
        if not show_archived:
            qs = qs.filter(is_archived=False)

        return qs


    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    #  Archive endpoint
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        task = self.get_object()
        task.is_archived = True
        task.save(update_fields=["is_archived"])
        return Response({"success": True, "id": task.id, "is_archived": True})

    #  Unarchive endpoint
    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        task = self.get_object()
        task.is_archived = False
        task.save(update_fields=["is_archived"])
        return Response({"success": True, "id": task.id, "is_archived": False})

class ReminderViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = Reminder.objects.none()        # <-- add this
    serializer_class = ReminderSerializer
    read_permission = "reminders.read"
    write_permission = "reminders.write"
    def get_queryset(self):
        return (Reminder.objects
                .filter(task__user=self.request.user)
                .select_related("task")
                .order_by("-notify_at"))

class ClassroomCourseViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = ClassroomCourse.objects.none()
    serializer_class = ClassroomCourseSerializer
    read_permission = "classroom.read"
    write_permission = "classroom.write"

    def get_queryset(self):
        return ClassroomCourse.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ClassroomAssignmentViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = ClassroomAssignment.objects.none()
    serializer_class = ClassroomAssignmentSerializer
    read_permission = "classroom.read"
    write_permission = "classroom.write"

    def get_queryset(self):
        return ClassroomAssignment.objects.filter(
            classroom_course__user=self.request.user
        )

class OAuthAccountViewSet(FunctionAuthorizedMixin, viewsets.ModelViewSet):
    queryset = OAuthAccount.objects.none()
    serializer_class = OAuthAccountSerializer
    read_permission = "oauth.read"
    write_permission = "oauth.write"

    def get_queryset(self):
        # only their own accounts
        return OAuthAccount.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        
        
class ReminderIntakeViewSet(FunctionAuthorizedMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    POST /api/reminders/intake/
    Body: { assignmentId, courseName?, title, dueISO, remindAtISO, offsetDays?, link? }
    """
    write_permission = "reminders.write"
    serializer_class = ReminderIntakeSerializer
    queryset = Reminder.objects.none()  # <-- instead of []

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx


@api_view(["POST"])
@permission_classes([IsAuthenticated, HasFunctionPermission("email.send")])
def send_test_email(request):
    """
    Sends a test email to the currently logged-in user.
    """
    user = request.user
    if not user.email:
        return Response({"detail": "User has no email"}, status=400)

    subject = "UniPlan Test Email"
    message = f"Hello {user.username or user.email},\n\nThis is a test email from UniPlan!"
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
    return Response({"detail": f"Email sent to {user.email}!"})

@api_view(["GET"])
@permission_classes([IsAuthenticated, HasFunctionPermission("reminders.read")])
def reminders_summary(request):
    qs = (Reminder.objects
          .select_related("task")
          .filter(task__user=request.user,
                  delivered_at__isnull=True,
                  status__in=["", "pending"]))
    data = {}
    for r in qs:
        ext = r.task.external_id
        if not ext:
            continue
        offset = None
        if r.task.due_at:
            offset = max(0, (r.task.due_at.date() - r.notify_at.date()).days)
        # keep earliest reminder if multiple
        prev = data.get(ext)
        if not prev or r.notify_at < prev["notify_at"]:
            data[ext] = {
                "notify_at": r.notify_at.isoformat(),
                "offset_days": offset,
            }
    return Response(data)