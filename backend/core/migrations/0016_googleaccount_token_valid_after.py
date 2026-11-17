# Generated migration for V7.4.2: Add token_valid_after to GoogleAccount

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_task_reminder_days_before'),
    ]

    operations = [
        migrations.AddField(
            model_name='googleaccount',
            name='token_valid_after',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
