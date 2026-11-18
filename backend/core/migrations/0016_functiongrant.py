from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0015_task_reminder_days_before"),
    ]

    operations = [
        migrations.CreateModel(
            name="FunctionGrant",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("permission", models.CharField(max_length=80)),
                ("granted_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="function_grants",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["permission"],
            },
        ),
        migrations.AddIndex(
            model_name="functiongrant",
            index=models.Index(
                fields=["user", "permission"],
                name="core_functi_user_id_perm_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="functiongrant",
            constraint=models.UniqueConstraint(
                fields=("user", "permission"),
                name="uq_function_grant_user_permission",
            ),
        ),
    ]
