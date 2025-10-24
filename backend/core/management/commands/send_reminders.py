# core/management/commands/send_reminders.py
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from core.models import Reminder, ReminderChannel, TaskStatus


class Command(BaseCommand):
    help = "Send due task reminders (email) once and mark delivered."

    def add_arguments(self, p):
        p.add_argument("--loop", action="store_true")
        p.add_argument("--interval", type=int, default=60)
        p.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opt):
        def tick():
            now = timezone.now()
            qs = (
                Reminder.objects
                .select_related("task", "task__user")
                .filter(
                    channel=ReminderChannel.EMAIL,
                    delivered_at__isnull=True,
                    status__in=["", "pending"],
                    notify_at__lte=now,
                )
            )

            for r in qs:
                t = r.task
                if not t or not t.user or not t.user.email:
                    # drop unfulfillable reminders
                    r.status = "skipped"
                    r.delivered_at = now
                    r.save(update_fields=["status", "delivered_at"])
                    continue

                # don’t remind completed tasks
                if t.status == TaskStatus.COMPLETED or t.completed_at:
                    r.status = "skipped_completed"
                    r.delivered_at = now
                    r.save(update_fields=["status", "delivered_at"])
                    continue

                # race-safe claim
                with transaction.atomic():
                    locked = (
                        Reminder.objects
                        .select_for_update(skip_locked=True)
                        .filter(pk=r.pk, delivered_at__isnull=True)
                        .first()
                    )
                    if not locked:
                        continue

                    # ----- build plain, no-emoji email (keeps Priority) -----
                    # subject: prefer "due in X days" when we have a due date
                    subject = f"UniPlan reminder — {t.title}"

                    due_local_txt = "—"
                    days_left = None
                    if t.due_at:
                        due = t.due_at
                        if timezone.is_naive(due):
                            due = timezone.make_aware(due, timezone.get_current_timezone())
                        due_local = timezone.localtime(due)
                        due_local_txt = due_local.strftime("%A, %B %d, %Y at %H:%M")
                        days_left = max((due_local.date() - timezone.localdate()).days, 0)
                        plural = "" if days_left == 1 else "s"
                        subject = f'Reminder: "{t.title}" due in {days_left} day{plural}'

                    # body (keeps Priority line)
                    lines = [
                        f"Hello {t.user.username or t.user.email},",
                        "",
                        f"This is a reminder for your assignment: {t.title}",
                        f"Priority: {t.get_priority_display()}",
                    ]
                    if t.due_at:
                        lines.append(f"Due date: {due_local_txt}")
                    if (t.description or "").strip():
                        lines += ["", "Details:", t.description.strip()]
                    lines += ["", "— UniPlan"]
                    body = "\n".join(lines)

                    if opt["dry_run"]:
                        self.stdout.write(f"[dry] would email {t.user.email}: {subject}")
                    else:
                        send_mail(
                            subject,
                            body,
                            settings.DEFAULT_FROM_EMAIL,   # use your configured From
                            [t.user.email],
                            fail_silently=False,
                        )

                    locked.status = "sent"
                    locked.delivered_at = timezone.now()
                    locked.save(update_fields=["status", "delivered_at"])

        if opt["loop"]:
            import time
            while True:
                tick()
                time.sleep(opt["interval"])
        else:
            tick()
