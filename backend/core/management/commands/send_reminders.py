# core/management/commands/send_reminders.py
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
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
            qs = (Reminder.objects
                  .select_related("task", "task__user")
                  .filter(channel=ReminderChannel.EMAIL,
                          delivered_at__isnull=True,
                          status__in=["", "pending"],
                          notify_at__lte=now))

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
                    locked = (Reminder.objects
                              .select_for_update(skip_locked=True)
                              .filter(pk=r.pk, delivered_at__isnull=True)
                              .first())
                    if not locked:
                        continue

                    if opt["dry_run"]:
                        self.stdout.write(f"[dry] would email {t.user.email}: {t.title}")
                    else:
                        subject = f"UniPlan reminder — {t.title}"
                        due_txt = t.due_at.astimezone().strftime("%Y-%m-%d %H:%M") if t.due_at else "—"
                        body = (
                            f"Hi {t.user.username or t.user.email},\n\n"
                            f"Task: {t.title}\n"
                            f"Priority: {t.get_priority_display()}\n"
                            f"Due: {due_txt}\n\n"
                            "Good luck!\n— UniPlan"
                        )
                        send_mail(subject, body, None, [t.user.email], fail_silently=False)

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
