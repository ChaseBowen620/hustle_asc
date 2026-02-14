# Generated manually - ensure EventOrganization.created_at exists in DB and state.
# Migration 0024 removed created_at; 0028 may have recreated the table with it (SQLite).
# This adds the column in the DB if missing, then syncs Django's model state.

from django.db import migrations, models


def add_created_at_if_missing(apps, schema_editor):
    """Add created_at column to event_organizations if it doesn't exist."""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == "sqlite":
            cursor.execute(
                "SELECT name FROM pragma_table_info('event_organizations') WHERE name='created_at'"
            )
            if cursor.fetchone() is None:
                cursor.execute(
                    "ALTER TABLE event_organizations ADD COLUMN created_at DATETIME NOT NULL DEFAULT '2020-01-01 00:00:00'"
                )
        elif connection.vendor == "postgresql":
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'event_organizations' AND column_name = 'created_at'
                """
            )
            if cursor.fetchone() is None:
                cursor.execute(
                    "ALTER TABLE event_organizations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"
                )
        # else: other backends - AddField would run below if we didn't use state-only


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0030_event_optional_fields"),
    ]

    operations = [
        migrations.RunPython(add_created_at_if_missing, noop_reverse),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="eventorganization",
                    name="created_at",
                    field=models.DateTimeField(auto_now_add=True),
                ),
            ],
            database_operations=[],  # we already added the column above if it was missing
        ),
    ]
