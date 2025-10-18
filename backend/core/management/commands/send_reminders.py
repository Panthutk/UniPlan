# backend/core/management/commands/send_reminders.py
from django.core.management.base import BaseCommand
from core.tasks import send_due_reminders

class Command(BaseCommand):
    help = "Send due reminders (notify_at <= now) and mark them delivered."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=200,
            help="Max reminders to send in one run (default: 200)",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        sent = send_due_reminders(limit=limit)
        self.stdout.write(self.style.SUCCESS(f"Sent {sent} reminder(s)."))
