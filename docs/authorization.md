# Authorization Rules

Authorization is enforced on the Django API (trusted service layer). The browser must not be treated as an access-control boundary.

A request is allowed only if all of the following hold:

1. The consumer is authenticated.
2. The consumer has an explicit **function-level** grant for that operation.
3. For a specific record, the consumer is allowed by **resource attributes** (object ownership).

Missing authentication returns **401**. Missing function grant or object access returns **403**. An undeclared function permission is **deny by default**.

## Consumers and Grants

Grants are stored in `FunctionGrant` (`user` + `permission` code). They are the source of truth.

On first Google sign-in, a consumer receives the default set: every catalog permission except `debug.*`. Later grants are not auto-repaired; revoke or add rows in Django admin (`Function grants`). Superusers bypass function grants but still use ownership checks on object APIs unless using Django admin.

## Function-level Access

Each API names the permission it requires. SAFE methods (GET/HEAD/OPTIONS) use `*.read`. POST/PUT/PATCH/DELETE use `*.write`, unless the view maps a specific action.

| Permission | Operations |
|---|---|
| `account.read` | `GET /api/whoami/` |
| `subjects.read` | List/retrieve subjects |
| `subjects.write` | Create/update/delete subjects |
| `timetable.read` | List/retrieve/export timetable |
| `timetable.write` | Create/update/delete/import timetable |
| `tasks.read` | List/retrieve tasks |
| `tasks.write` | Create/update/delete, archive, unarchive tasks |
| `reminders.read` | List/retrieve reminders, `GET /api/reminders/summary/` |
| `reminders.write` | Create/update/delete reminders, `POST /api/reminders/intake/` |
| `classroom.read` | Classroom courses/submissions/summary and local classroom reads |
| `classroom.write` | Create/update/delete local classroom records |
| `oauth.read` | List/retrieve linked OAuth accounts |
| `oauth.write` | Create/update/delete linked OAuth accounts |
| `email.send` | `POST /api/test-email/` |
| `debug.read` | `GET /api/echo-auth/` (not in the default consumer set) |

Public (no consumer grant): Google OAuth login/callback. These do not return user data collections.

`subjects.read` does not allow `POST /api/subjects/`. Subject grants do not allow task or classroom functions.

Enforcement: `EnforcesDeclaredFunctionPermission` and `HasFunctionPermission` in `backend/core/authorization.py`.

## Data-specific Access (Resource Attributes)

Function grants are not enough to read or change another consumer’s item. Access to a row is restricted by ownership attributes:

| Resource | Attribute used | Allowed when |
|---|---|---|
| Subject, timetable entry, task, classroom course, OAuth account | `user_id` | equals `request.user.id` |
| Reminder | `task.user_id` | equals `request.user.id` |
| Classroom assignment | `classroom_course.user_id` | equals `request.user.id` |

Rules:

- List endpoints only return rows matching those attributes (`get_queryset`).
- Retrieve/update/delete of another consumer’s id is denied (`OwnsObject`).
- Related ids in a write (subject on a task/timetable, task on a reminder, classroom course/task on an assignment) must already be owned (`require_owned_item`). Guessing another user’s primary key is not access.
- Create always assigns `user=request.user`. Clients cannot set `user` on the payload.

Classroom Google calls use that consumer’s stored Google credentials, so course/submission data is only the data Google returns for that account.

## Session Tokens

Self-contained session JWTs are issued after Google login (`backend/core/tokens.py`). Before any payload is trusted:

- HMAC-SHA256 signature is verified.
- `alg` must be on the allowlist `{HS256}` only. Symmetric signing only; `none` is rejected. Mixed HS/RS is not supported, so key-confusion does not apply.
- The verification key is only `SECRET_KEY` from Django settings. Header parameters `jku`, `x5u`, `jwk`, `x5c`, and related key-source fields are rejected.
- `nbf` and `exp` (and `iat`) are required. The token is accepted only when verification time is in `[nbf, exp]` (lifetime 8 hours).

## Where To Change The Rules

| Concern | Location |
|---|---|
| Permission catalog and default grants | `backend/core/authorization.py` |
| Function mapping on endpoints | `backend/core/views.py` |
| Related-object ownership | `backend/core/serializers.py` |
| Default DRF stack | `backend/mysite/settings.py` (`IsAuthenticated`, `EnforcesDeclaredFunctionPermission`, `OwnsObject`) |
| Session JWT issue/verify | `backend/core/tokens.py` |
