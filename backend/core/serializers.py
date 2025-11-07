from rest_framework import serializers
from django.utils import timezone
from .models import (
    Subject, TimetableEntry, Task, Reminder, ClassroomCourse,
    ClassroomAssignment, OAuthAccount, ReminderChannel
)
import re
from core.services.reminders import upsert_email_reminder
from datetime import timedelta

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

class SubjectSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        user = serializers.PrimaryKeyRelatedField(read_only=True)  # <- explicit
        model = Subject
        fields = "__all__"
        read_only_fields = ("id", "user", "created_at", "updated_at")

    def validate_color_hex(self, value):
        if value == "":
            return value
        if not HEX_RE.match(value):
            raise serializers.ValidationError("color_hex must be like #1f2937 (7 chars).")
        return value

class TimetableEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimetableEntry
        fields = "__all__"
        read_only_fields = ("user",)

    def validate(self, attrs):
        """
        Block overlaps per user + day.
        Treat touching as overlap (<= and >=). If you want back-to-back allowed, switch to < and >.
        """
        inst  = getattr(self, "instance", None)

        # Pull values from attrs or instance (for PATCH)
        user  = attrs.get("user")        or (inst.user if inst else None)
        day   = attrs.get("day_of_week") or (inst.day_of_week if inst else None)
        start = attrs.get("start_time")  or (inst.start_time if inst else None)
        end   = attrs.get("end_time")    or (inst.end_time if inst else None)

        # If user wasn't provided in payload, fall back to request.user
        if not user:
            req = self.context.get("request")
            if req and getattr(req, "user", None) and req.user.is_authenticated:
                user = req.user

        # Basic sanity
        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": "end_time must be after start_time."})

        # If anything essential missing, skip (field-level validators will complain as needed)
        if not (user and day is not None and start and end):
            return attrs

        # Overlap: same user + same day, any touching/overlap
        qs = TimetableEntry.objects.filter(user=user, day_of_week=day)
        if inst:
            qs = qs.exclude(pk=inst.pk)

        if qs.filter(start_time__lt=end, end_time__gt=start).exists():
            raise serializers.ValidationError("This time overlaps an existing timetable entry.")

        return attrs

class TaskSerializer(serializers.ModelSerializer):
    reminder_days_before = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    next_reminder_at = serializers.DateTimeField(read_only=True)
    days_left = serializers.SerializerMethodField()
    day_of_week = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id","user","subject","title","description",
            "status","priority","due_at","rrule","source","external_id",
            "assignment_alt_link","created_at","updated_at","completed_at", "is_archived",
            "reminder_days_before","next_reminder_at","days_left","day_of_week",
        ]
        read_only_fields = ["user","created_at","updated_at","completed_at","days_left","day_of_week"]

    def get_days_left(self, obj):
        if not obj.due_at:
            return None
        # Convert to current tz for consistent “days left”
        due = timezone.localtime(obj.due_at)
        now = timezone.localtime()
        delta = (due.date() - now.date()).days
        return delta

    def get_day_of_week(self, obj):
        if not obj.due_at:
            return None
        return timezone.localtime(obj.due_at).weekday()  # 0=Mon ... 6=Sun

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # surface the “next” pending email reminder (if any)
        r = (instance.reminders
             .filter(channel=ReminderChannel.EMAIL, delivered_at__isnull=True, status="pending")
             .order_by("notify_at").first())
        data["next_reminder_at"] = r.notify_at if r else None
        return data

    def create(self, validated):
        days = validated.pop("reminder_days_before", None)
        task = super().create(validated)
        upsert_email_reminder(task, days)
        return task

    def update(self, instance, validated):
        days = validated.pop("reminder_days_before", None)
        task = super().update(instance, validated)
        upsert_email_reminder(task, days)
        return task

class ReminderSerializer(serializers.ModelSerializer):
    # client sends one of these: either days_before, or explicit notify_at
    days_before = serializers.IntegerField(required=False, min_value=0)

    class Meta:
        model = Reminder
        fields = ["id", "task", "channel", "notify_at", "delivered_at", "status", "days_before", "created_at"]
        read_only_fields = ["delivered_at", "status", "created_at", "notify_at"]  # we compute notify_at

    def validate(self, attrs):
        request = self.context.get("request")
        task: Task = attrs.get("task")
        days_before = attrs.get("days_before", None)

        if not task:
            raise serializers.ValidationError("Task is required.")

        # ensure ownership
        if request and task.user_id != request.user.id:
            raise serializers.ValidationError("You don’t own this task.")

        if not task.due_at:
            raise serializers.ValidationError("Task has no due date; cannot schedule reminder.")

        if days_before is None:
            raise serializers.ValidationError("days_before is required (e.g., 1, 3, 7).")

        # compute notify_at
        due = task.due_at
        if timezone.is_naive(due):
            due = timezone.make_aware(due, timezone.get_current_timezone())

        notify_at = due - timedelta(days=days_before)
        if notify_at <= timezone.now():
            raise serializers.ValidationError("Reminder time is in the past.")

        # stash for create()
        attrs["_computed_notify_at"] = notify_at
        return attrs

    def create(self, validated):
        notify_at = validated.pop("_computed_notify_at")
        reminder = Reminder.objects.create(notify_at=notify_at, **validated)
        return reminder

class ClassroomCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassroomCourse
        fields = "__all__"

class ClassroomAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassroomAssignment
        fields = "__all__"

class OAuthAccountSerializer(serializers.ModelSerializer):
    refresh_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = OAuthAccount
        fields = "__all__"
        read_only_fields = ("user", "created_at", "updated_at")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # never leak refresh tokens
        data["refresh_token"] = "********"
        return data



class ReminderIntakeSerializer(serializers.Serializer):
    # Support both new and old fields
    assignmentId = serializers.IntegerField(required=False)
    remindAtISO  = serializers.DateTimeField()
    offsetDays   = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    def create(self, validated):
        user = self.context["request"].user
        task = None

        if "assignmentId" in validated:
            assignment_id = validated["assignmentId"]
            task = Task.objects.filter(id=assignment_id, user=user).first()

        if not task:
            raise serializers.ValidationError(
                {"assignmentId": "Task not found or invalid assignmentId."}
            )

        remind_at = validated["remindAtISO"]
        offset = validated.get("offsetDays")

        # Create or get reminder
        reminder, _ = Reminder.objects.get_or_create(
            task=task,
            channel="email",
            notify_at=remind_at,
            defaults={"status": "pending"},
        )

        return reminder

    def to_representation(self, instance):
        t = instance.task
        return {
            "id": instance.id,
            "notify_at": instance.notify_at,
            "status": instance.status,
            "task": {
                "id": t.id,
                "title": t.title,
                "due_at": t.due_at,
                "assignment_alt_link": getattr(t, "assignment_alt_link", None),
            },
        }


    