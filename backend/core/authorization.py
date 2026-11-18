from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated, SAFE_METHODS

from .models import FunctionGrant

FUNCTION_PERMISSIONS = {
    "account.read": "Read the authenticated consumer's profile",
    "subjects.read": "List and retrieve subjects",
    "subjects.write": "Create, update, or delete subjects",
    "timetable.read": "List, retrieve, and export timetable entries",
    "timetable.write": "Create, update, delete, or import timetable entries",
    "tasks.read": "List and retrieve tasks",
    "tasks.write": "Create, update, delete, archive, or unarchive tasks",
    "reminders.read": "List and retrieve reminders",
    "reminders.write": "Create, update, or delete reminders",
    "classroom.read": "Read Google Classroom courses, submissions, and local classroom records",
    "classroom.write": "Create, update, or delete local classroom records",
    "oauth.read": "List and retrieve linked OAuth accounts",
    "oauth.write": "Create, update, or delete linked OAuth accounts",
    "email.send": "Send application emails to the authenticated consumer",
    "debug.read": "Access diagnostic endpoints",
}

CONSUMER_FUNCTION_PERMISSIONS = tuple(
    code for code in FUNCTION_PERMISSIONS if not code.startswith("debug.")
)


def user_has_function_permission(user, code: str) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not code or code not in FUNCTION_PERMISSIONS:
        return False
    if getattr(user, "is_superuser", False):
        return True
    return FunctionGrant.objects.filter(user=user, permission=code).exists()


def ensure_consumer_grants(user) -> None:
    if not user or not getattr(user, "pk", None):
        return
    if FunctionGrant.objects.filter(user=user).exists():
        return
    FunctionGrant.objects.bulk_create(
        [
            FunctionGrant(user=user, permission=code)
            for code in CONSUMER_FUNCTION_PERMISSIONS
        ]
    )


def resolve_required_permission(view, request) -> str | None:
    action = getattr(view, "action", None)
    mapping = getattr(view, "function_permissions", None) or {}
    if action and mapping.get(action):
        return mapping[action]

    explicit = getattr(view, "function_permission", None)
    if explicit:
        return explicit

    if request.method in SAFE_METHODS:
        return getattr(view, "read_permission", None)
    return getattr(view, "write_permission", None)


class EnforcesDeclaredFunctionPermission(BasePermission):
    message = "You do not have permission to perform this function."

    def has_permission(self, request, view):
        code = resolve_required_permission(view, request)
        if not code:
            return False
        return user_has_function_permission(request.user, code)


def owner_user_id(obj):
    if obj is None:
        return None
    if getattr(obj, "user_id", None) is not None:
        return obj.user_id
    task = getattr(obj, "task", None)
    if task is not None:
        return getattr(task, "user_id", None)
    course = getattr(obj, "classroom_course", None)
    if course is not None:
        return getattr(course, "user_id", None)
    return None


def consumer_owns(user, obj) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    owner_id = owner_user_id(obj)
    return owner_id is not None and owner_id == user.id


def require_owned_item(user, obj):
    if obj is None:
        return None
    if not consumer_owns(user, obj):
        raise ValidationError("You do not have access to this item.")
    return obj


class OwnsObject(BasePermission):
    message = "You do not have access to this item."

    def has_object_permission(self, request, view, obj):
        return consumer_owns(request.user, obj)


def HasFunctionPermission(code: str):
    class _HasFunctionPermission(BasePermission):
        message = "You do not have permission to perform this function."

        def has_permission(self, request, view):
            return user_has_function_permission(request.user, code)

    _HasFunctionPermission.__name__ = f"HasFunctionPermission_{code.replace('.', '_')}"
    return _HasFunctionPermission


class FunctionAuthorizedMixin:
    permission_classes = [IsAuthenticated, EnforcesDeclaredFunctionPermission, OwnsObject]
    function_permissions = {}
    function_permission = None
    read_permission = None
    write_permission = None
