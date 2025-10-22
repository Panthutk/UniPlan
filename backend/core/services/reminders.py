from datetime import timedelta
from django.utils import timezone
from core.models import Reminder, ReminderChannel, Task

VALID_DAYS = {1, 3, 7}

def upsert_email_reminder(task: Task, days_before: int | None):
    """
    Ensure exactly one email Reminder exists for this task according to days_before.
    If days_before is None -> remove any future pending reminders for this task.
    """
    # wipe when disabled or when there is no due date
    if not task.due_at or days_before is None:
        Reminder.objects.filter(task=task, channel=ReminderChannel.EMAIL, delivered_at__isnull=True).delete()
        return None

    if days_before not in VALID_DAYS:
        # ignore unknown options
        Reminder.objects.filter(task=task, channel=ReminderChannel.EMAIL, delivered_at__isnull=True).delete()
        return None

    notify_at = task.due_at - timedelta(days=days_before)

    # Delete other pending reminders (if user changed setting)
    Reminder.objects.filter(task=task, channel=ReminderChannel.EMAIL, delivered_at__isnull=True).exclude(
        notify_at=notify_at
    ).delete()

    # Upsert the target one
    r, _ = Reminder.objects.get_or_create(
        task=task,
        channel=ReminderChannel.EMAIL,
        notify_at=notify_at,
        defaults={"status": "pending"},
    )
    if r.status != "pending" and r.delivered_at is None:
        r.status = "pending"
        r.save(update_fields=["status"])
    return r