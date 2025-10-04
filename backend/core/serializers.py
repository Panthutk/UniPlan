from rest_framework import serializers
from .models import Subject, TimetableEntry, Task, Reminder, ClassroomCourse, ClassroomAssignment, OAuthAccount
import re

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")

    def validate_color_hex(self, value):
        if value == "":
            return value
        if not HEX_RE.match(value):
            raise serializers.ValidationError("color_hex must be like #1f2937 (7 chars).")
        return value

class TimetableEntrySerializer(serializers.ModelSerializer):
    class Meta: model = TimetableEntry; fields = "__all__"

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