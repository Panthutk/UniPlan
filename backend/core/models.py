from django.db import models
from django.conf import settings

class GoogleAccount(models.Model):
    email = models.EmailField(primary_key=True)
    credentials = models.JSONField()  # serialized google Credentials
    name = models.CharField(max_length=255, blank=True, default="")
    picture = models.URLField(blank=True, default="")

    def __str__(self):
        return self.email

# ---------- Enums ----------
class TaskStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "Not started"
    IN_PROCESS  = "IN_PROCESS",  "In process"
    COMPLETED   = "COMPLETED",   "Completed"

class ReminderChannel(models.TextChoices):
    EMAIL = "email", "Email"
    IN_APP = "in_app", "In-app"

class Priority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"

class DayOfWeek(models.IntegerChoices):
    SUN = 0, "Sun"
    MON = 1, "Mon"
    TUE = 2, "Tue"
    WED = 3, "Wed"
    THU = 4, "Thu"
    FRI = 5, "Fri"
    SAT = 6, "Sat"

# ---------- Core tables ----------
class Subject(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=180)
    code = models.CharField(max_length=60, blank=True)
    color_hex = models.CharField(max_length=7, blank=True)
    location = models.CharField(max_length=180, blank=True)
    teacher_name = models.CharField(max_length=120, blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self): return f"{self.code or ''} {self.name}".strip()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "code"], name="uq_subject_user_code")
        ]
        ordering = ["name"]

class TimetableEntry(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="timetable_entries")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="timetable_entries")
    day_of_week = models.PositiveSmallIntegerField(choices=DayOfWeek.choices)  # 0=Sun ... 6=Sat
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=120, blank=True)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "day_of_week", "start_time"]),
        ]

class Task(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tasks")
    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks")
    title = models.CharField(max_length=240)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.NOT_STARTED)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    due_at = models.DateTimeField(null=True, blank=True)
    rrule = models.CharField(max_length=400, blank=True)  # recurrence rule (text)
    source = models.CharField(max_length=40, blank=True)  # manual, classroom_import, etc.
    external_id = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "due_at"]),
            models.Index(fields=["subject", "due_at"], name="idx_tasks_subject_due"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["user", "source", "external_id"], name="uq_task_user_source_extid")
        ]

class Reminder(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="reminders")
    channel = models.CharField(max_length=20, choices=ReminderChannel.choices, default=ReminderChannel.EMAIL)
    notify_at = models.DateTimeField()
    delivered_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, blank=True)  # pending, sent, failed (free text for now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["notify_at", "status"]),
        ]

class OAuthAccount(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="oauth_accounts")
    provider = models.CharField(max_length=40)                      # e.g., "google"
    provider_user_id = models.CharField(max_length=120)
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_user_id"],
                name="uq_oauth_provider_user"
            )
        ]
        indexes = [models.Index(fields=["user", "provider"])]

    def __str__(self):
        return f"{self.provider}:{self.provider_user_id}"

class ClassroomCourse(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="classroom_courses")
    google_course_id = models.CharField(max_length=120, unique=True)
    name = models.CharField(max_length=240)
    section = models.CharField(max_length=120, blank=True)
    subject = models.ForeignKey("Subject", null=True, blank=True, on_delete=models.SET_NULL, related_name="classroom_courses")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self): return self.name

class ClassroomAssignment(models.Model):
    classroom_course = models.ForeignKey(ClassroomCourse, on_delete=models.CASCADE, related_name="assignments")
    google_assignment_id = models.CharField(max_length=120, unique=True)
    title = models.CharField(max_length=240)
    description = models.TextField(blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    task = models.ForeignKey("Task", null=True, blank=True, on_delete=models.SET_NULL, related_name="classroom_assignments")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self): return self.title