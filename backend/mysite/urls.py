# backend/mysite/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from core import views   # keep only this import

router = routers.DefaultRouter()
router.register(r"subjects", views.SubjectViewSet)
router.register(r"timetable", views.TimetableEntryViewSet)
router.register(r"tasks", views.TaskViewSet)
router.register(r"reminders", views.ReminderViewSet)
router.register(r"classroom-courses", views.ClassroomCourseViewSet)
router.register(r"classroom-assignments", views.ClassroomAssignmentViewSet)
router.register(r"oauth-accounts", views.OAuthAccountViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),

    # OAuth
    path("api/auth/google/login", views.google_login),
    path("api/auth/google/callback", views.google_callback),

    # Classroom
    path("api/classroom/courses", views.list_courses),
    path("api/classroom/active-submissions/<str:course_id>", views.list_active_submissions),
    path("api/classroom/summary", views.summary),

    # Debug / auth helpers
    path("api/hello/", views.hello),
    path("api/echo-auth/", views.echo_auth),  # <-- add this line
    path("api/whoami/", views.whoami),        # <-- and ensure this is here

    # CRUD
    path("api/", include(router.urls)),
]
