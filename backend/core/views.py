# backend/core/views.py
import csv
import io
import re
import json, os, urllib.parse
from django.conf import settings
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse
from django.shortcuts import redirect
from django.views.decorators.http import require_GET
from django.core.signing import dumps, loads, BadSignature, SignatureExpired

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from .models import GoogleAccount
from rest_framework import viewsets, permissions, status
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

from django.core.files.uploadedfile import UploadedFile
from django.utils.dateparse import parse_datetime


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

from rest_framework.decorators import action

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.none()
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    
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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
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
@permission_classes([IsAuthenticated])
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