# backend/core/tasks.py
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import Reminder

def send_due_reminders(limit=200):
    """
    Find all reminders whose notify_at <= now and not yet delivered,
    send an email, then mark them delivered.
    """
    now = timezone.now()
    qs = (Reminder.objects
          .select_related("task", "task__user")
          .filter(delivered_at__isnull=True, notify_at__lte=now)
          .order_by("notify_at")[:limit])

    sent = 0
    for r in qs:
        t = r.task
        user = t.user
        to_email = user.email
        if not to_email:
            # skip if user has no email
            r.status = "skipped:no_user_email"
            r.delivered_at = now
            r.save(update_fields=["status", "delivered_at"])
            continue

        # Build subject/body
        subject = f'UniPlan reminder: {t.title}'
        days_left = None
        if t.due_at:
            delta = t.due_at - now
            days_left = max(delta.days, 0)
            plural = "" if days_left == 1 else "s"
            subject = f'Reminder: "{t.title}" due in {days_left} day{plural}'

        lines = [
            f"Hello {user.username or user.email},",
            "",
            f"This is a reminder for your assignment: {t.title}",
        ]
        if t.due_at:
            due_local = timezone.localtime(t.due_at)
            lines.append(f"📅 Due date: {due_local:%A, %B %d, %Y at %H:%M}")
            if days_left is not None:
                lines.append(f"⏳ That’s in {days_left} day{'s' if days_left != 1 else ''}.")
        if t.description:
            lines += ["", "📝 Details:", t.description]

        lines += ["", "— The UniPlan Team"]

        send_mail(
            subject,
            "\n".join(lines),
            settings.DEFAULT_FROM_EMAIL,   # set in settings.py
            [to_email],
            fail_silently=False,
        )

        r.delivered_at = now
        r.status = "sent"
        r.save(update_fields=["delivered_at", "status"])
        sent += 1

    return sent
