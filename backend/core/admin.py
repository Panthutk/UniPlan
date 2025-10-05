from django.contrib import admin
from .models import Subject, TimetableEntry, Task, Reminder, ClassroomCourse, ClassroomAssignment, OAuthAccount

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("id","user","code","name","is_archived","updated_at")
    search_fields = ("name","code","teacher_name")

@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ("id","user","subject","day_of_week","start_time","end_time","room")

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id","user","title","status","priority","due_at","updated_at")
    list_filter = ("status","priority")
    search_fields = ("title","description")

@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ("id","task","channel","notify_at","status")
    list_filter = ("channel","status")

@admin.register(ClassroomCourse)
class ClassroomCourseAdmin(admin.ModelAdmin):
    list_display = ("id","user","name","section","google_course_id","subject","created_at")
    search_fields = ("name","section","google_course_id")

@admin.register(ClassroomAssignment)
class ClassroomAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id","classroom_course","title","google_assignment_id","due_at","task","created_at")
    search_fields = ("title","google_assignment_id")

@admin.register(OAuthAccount)
class OAuthAccountAdmin(admin.ModelAdmin):
    list_display = ("id","user","provider","provider_user_id","token_expires_at","updated_at")
    search_fields = ("provider_user_id", "user__email")