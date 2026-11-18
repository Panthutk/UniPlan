# UniPlan Input Validation & Business Logic Specification (OWASP ASVS V2)

This document defines the input validation rules, expected data structures, allowlists, and business logic constraints enforced across **UniPlan** in compliance with **OWASP ASVS v5.0 Chapter V2 (V2.1.1, V2.2.1, V2.2.2, V2.3.1)**.

All security-critical validation is enforced server-side at the trusted Django REST Framework (DRF) service layer (`backend/core/serializers.py`, `backend/core/views.py`, `backend/core/models.py`), with client-side checks in React (`frontend/src/TableAndTask.jsx`) provided for usability.

---

## 1. Common Data Formats (V2.1.1)

| Data Format | Expected Structure / Rule | Validation Mechanism & Pattern | Enforcement Location |
| :--- | :--- | :--- | :--- |
| **Email Address** | RFC 5322 compliant email string, max `254` characters | `models.EmailField` (`EmailValidator`) | `GoogleAccount.email` (`backend/core/models.py`), `User.email` |
| **URL / External Link** | Valid HTTP/HTTPS URL, max `200` characters | `models.URLField` (`URLValidator`) | `Task.assignment_alt_link`, `GoogleAccount.picture` (`backend/core/models.py`) |
| **Hex Color Code** | 7-character hexadecimal RGB string (`#RRGGBB`) or empty string `""` | Regex `HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")` | `SubjectSerializer.validate_color_hex` (`backend/core/serializers.py`) |
| **24-Hour Time (`HH:MM` / `HH:MM:SS`)** | `00:00:00` to `23:59:59` (`0 <= HH <= 23`, `0 <= MM <= 59`, `0 <= SS <= 59`) | DRF `TimeField` & CSV Regex `TIME_RE = re.compile(r"^\d{2}:\d{2}(:\d{2})?$")` | `TimetableEntrySerializer` (`backend/core/serializers.py`), `TimetableEntryViewSet.import_csv` (`backend/core/views.py`) |
| **ISO-8601 DateTime** | Timezone-aware ISO-8601 timestamp (`YYYY-MM-DDTHH:MM:SSZ` or `±HH:MM`) | DRF `DateTimeField` | `Task.due_at`, `Reminder.notify_at`, `ReminderIntakeSerializer.remindAtISO` |
| **Signed Session Token** | HMAC-SHA256 signed payload (`{"sub": "<email>"}`) with salt `"uniplan"` and `max_age = 28800` seconds (8 hours) | `django.core.signing.loads(..., salt="uniplan", max_age=60*60*8)` | `SignedTokenAuthentication` (`backend/core/auth.py`), `_unsign` (`backend/core/views.py`) |

---

## 2. Internal Data Models & Field Validation Rules (V2.1.1 & V2.2.1)

### 2.1 `Subject` (`/api/subjects/`)
Enforced in `SubjectSerializer` (`backend/core/serializers.py`) and `Subject` (`backend/core/models.py`):

| Field | Type | Required | Constraints & Expected Structure |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | Non-empty string, `1..180` characters |
| `code` | `string` | No | `0..60` characters; slugified (`[a-z0-9-]`); unique per `(user, code)` (`uq_subject_user_code`) |
| `color_hex` | `string` | No | Empty `""` or matches `^#[0-9A-Fa-f]{6}$` (e.g., `#1f2937`) |
| `location` | `string` | No | `0..180` characters |
| `teacher_name` | `string` | No | `0..120` characters |
| `is_archived` | `boolean` | No | Boolean (`true` / `false`), defaults to `false` |
| `user` | `integer (FK)` | Read-only | Assigned server-side from `request.user` |

### 2.2 `TimetableEntry` (`/api/timetable/`)
Enforced in `TimetableEntrySerializer` (`backend/core/serializers.py`):

| Field | Type | Required | Constraints & Expected Structure |
| :--- | :--- | :--- | :--- |
| `subject` | `integer (FK)` | Yes | Must reference an existing `Subject` ID |
| `day_of_week` | `integer` | Yes | Allowlist `DayOfWeek.choices`: `0` (Sun), `1` (Mon), `2` (Tue), `3` (Wed), `4` (Thu), `5` (Fri), `6` (Sat) |
| `start_time` | `time` | Yes | Valid 24-hour time (`HH:MM` or `HH:MM:SS`); must satisfy `start_time < end_time` |
| `end_time` | `time` | Yes | Valid 24-hour time (`HH:MM` or `HH:MM:SS`); must be strictly after `start_time` |
| `room` | `string` | No | `0..120` characters |
| `effective_from` / `effective_to` | `date` | No | Optional ISO-8601 date (`YYYY-MM-DD`) |

**Cross-Field & Business Logic Rules (`TimetableEntrySerializer.validate`)**:
1. **Chronological Order**: `start_time` must be strictly earlier than `end_time` (`start >= end` raises `ValidationError({"end_time": "end_time must be after start_time."})`).
2. **No Schedule Overlap**: For the same `user` and `day_of_week`, no entry may overlap an existing entry (`start_time < end` and `end_time > start`).

### 2.3 `Task` (`/api/tasks/`)
Enforced in `TaskSerializer` (`backend/core/serializers.py`) and `Task` (`backend/core/models.py`):

| Field | Type | Required | Constraints & Expected Structure |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Yes | Non-empty string, `1..240` characters |
| `description` | `string` | No | Free-form text (`TextField`) |
| `status` | `string` | No | Allowlist `TaskStatus.choices`: `"NOT_STARTED"`, `"IN_PROCESS"`, `"COMPLETED"` (default `"NOT_STARTED"`) |
| `priority` | `string` | No | Allowlist `Priority.choices`: `"none"`, `"low"`, `"normal"`, `"high"` (default `"none"`) |
| `due_at` | `datetime` | No | Optional ISO-8601 datetime |
| `reminder_days_before` | `integer` | No | Write-only; valid values in `VALID_DAYS = {1, 3, 7}` (`backend/core/services/reminders.py`) |
| `source` | `string` | No | `0..40` characters (e.g., `"manual"`, `"classroom"`) |
| `external_id` | `string` | No | `0..120` characters; unique per `(user, source, external_id)` (`uq_task_user_source_extid`) |
| `assignment_alt_link` | `string (URL)` | No | Valid URL (`URLField`) |
| `is_archived` | `boolean` | No | Boolean (`true` / `false`), defaults to `false` |

### 2.4 `Reminder` (`/api/reminders/` and `/api/reminders/intake/`)
Enforced in `ReminderSerializer` and `ReminderIntakeSerializer` (`backend/core/serializers.py`):

| Field | Type | Required | Constraints & Expected Structure |
| :--- | :--- | :--- | :--- |
| `task` / `assignmentId` | `integer (FK)` | Yes | Must belong to the authenticated `request.user` (`task.user_id == request.user.id`) |
| `channel` | `string` | No | Allowlist `ReminderChannel.choices`: `"email"`, `"in_app"` (default `"email"`) |
| `days_before` | `integer` | Yes (in `ReminderSerializer`) | Integer `>= 0` (`min_value=0`); task must have a non-null `due_at` |
| `notify_at` / `remindAtISO` | `datetime` | Computed / Yes | Computed `notify_at = due_at - timedelta(days=days_before)` must be in the future (`notify_at > timezone.now()`) |

---

## 3. File Upload Validation Rules — Timetable CSV Import (`POST /api/timetable/import`)

Enforced server-side in `TimetableEntryViewSet.import_csv` (`backend/core/views.py`):

1. **Authentication**: Requires an authenticated user (`401 Unauthorized` otherwise).
2. **Field Name**: Must be uploaded in multipart form field `"file"`.
3. **File Extension**: Filename must end with `.csv` (case-insensitive); rejected with `400 Bad Request` otherwise.
4. **Content-Type Allowlist**: Must be in `{"text/csv", "application/csv", "application/vnd.ms-excel"}`; rejected with `415 Unsupported Media Type` otherwise.
5. **Maximum File Size**: `MAX_BYTES = 1_000_000` (1 MB); files exceeding 1 MB are rejected with `413 Payload Too Large`.
6. **Character Encoding**: Must be valid UTF-8 or UTF-8 with BOM (`utf-8-sig`); rejected with `400 Bad Request` otherwise.
7. **Delimiter & Header Structure**:
   - Delimiter must be one of `,`, `;`, or `\t`.
   - Header row must include `"subject"` (or `"subject_name"`), `"day_of_week"`, `"start_time"`, and `"end_time"`.
8. **Row-Level Validation (Pre-Write Atomic Validation)**:
   - Every row is validated before any database write occurs:
     - `subject` / `subject_name`: non-empty string after trimming.
     - `day_of_week`: integer `0..6` or case-insensitive day name (`sun`/`sunday` through `sat`/`saturday`).
     - `start_time` & `end_time`: match `^\d{2}:\d{2}(:\d{2})?$` with valid clock ranges (`00:00:00`–`23:59:59`) and `start_time < end_time`.
   - If any row fails validation, the entire import is aborted (`400 Bad Request`) with up to 50 line-specific error messages, leaving existing database records untouched.
