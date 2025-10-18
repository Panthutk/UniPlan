from rest_framework import serializers
from django.utils import timezone
from .models import Subject, TimetableEntry, Task, Reminder, ClassroomCourse, ClassroomAssignment, OAuthAccount
import re

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
    class Meta: model = Task; fields = "__all__"

class ReminderSerializer(serializers.ModelSerializer):
    class Meta: model = Reminder; fields = "__all__"

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
    
    

# === Create-only serializer used by POST /api/reminders/ ===
class ReminderIntakeSerializer(serializers.Serializer):
    # matches the payload from the React UI
    assignmentId = serializers.CharField(max_length=128)
    courseName   = serializers.CharField(max_length=255, allow_blank=True, required=False)
    title        = serializers.CharField(max_length=255)
    link         = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    offsetDays   = serializers.IntegerField(default=3)
    dueISO       = serializers.DateTimeField()
    remindAtISO  = serializers.DateTimeField()

    def create(self, validated):
        """
        - Upsert a Task for this classroom assignment (per user).
        - Create a Reminder pointing to that Task with notify_at = remindAtISO.
        """
        user = self.context["request"].user

        assignment_id = validated["assignmentId"]
        title         = validated["title"]
        course_name   = validated.get("courseName", "")
        link          = validated.get("link")
        due_at        = validated["dueISO"]
        remind_at     = validated["remindAtISO"]

        # 1) Find-or-create Task for this classroom item
        task, created = Task.objects.get_or_create(
            user=user,
            source="classroom",               # consistent key for classroom tasks
            external_id=assignment_id,        # prevents duplicates
            defaults={
                "title": title,
                "description": (f"{course_name}\n{link}" if link else course_name).strip(),
                "due_at": due_at,
            },
        )

        # Keep Task fresh if details changed
        dirty = False
        if task.title != title:
            task.title = title; dirty = True
        if not task.due_at or task.due_at != due_at:
            task.due_at = due_at; dirty = True

        # Append course/link to description if not already present
        desc = (task.description or "")
        extra_bits = []
        if course_name and course_name not in desc:
            extra_bits.append(course_name)
        if link and (link not in desc):
            extra_bits.append(link)
        if extra_bits:
            task.description = (desc + ("\n" if desc else "") + "\n".join(extra_bits)).strip()
            dirty = True

        if dirty:
            task.save(update_fields=["title", "due_at", "description"])

        # 2) Create the reminder (email channel default from your model choices)
        reminder = Reminder.objects.create(
            task=task,
            channel="email",
            notify_at=remind_at,
            status="pending",
        )
        return reminder

    def to_representation(self, instance):
        t = instance.task
        return {
            "id": instance.id,
            "notify_at": instance.notify_at,
            "status": instance.status,
            "task": { "id": t.id, "title": t.title, "due_at": t.due_at },
        }