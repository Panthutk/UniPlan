"""
URL configuration for mysite project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
# backend/mysite/urls.py
from django.contrib import admin
from django.urls import path
from core import views

urlpatterns = [
    path("admin/", admin.site.urls),

    # OAuth
    path("api/auth/google/login", views.google_login),
    path("api/auth/google/callback", views.google_callback),

    # Classroom
    path("api/classroom/courses", views.list_courses),
    path("api/classroom/active-submissions/<str:course_id>", views.list_active_submissions),
    path("api/classroom/summary", views.summary),

    # Ping
    path("api/hello/", views.hello),
]
