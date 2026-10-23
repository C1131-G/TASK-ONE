# Mobile API (`/api/v1`)

The mobile app calls versioned JSON routes under `app/api/v1`. They are thin adapters over the same Effect services in `src/server/<domain>/` that the web Server Actions use, so authorization, validation and transactions live in one place. A route never calls a Server Action, and web `refresh()` stays inside the Server Actions.

## Sign-in and sessions

- Sign in with `POST /api/auth/sign-in/email`. The response carries the session token in the `set-auth-token` header.
- Send it on every call as `Authorization: Bearer <token>`.
- The token is the same database session the web cookie uses. It lasts 8 hours; a client account is also signed out after 2 idle hours. Revoking the session (signed-in devices) or deactivating the account makes the token return `401` at once.
- Identity, role, company and handler permissions are always read from the session on the server. A request never states who it is.

## Contract

- `src/mobile-api/routes.ts` lists every route with its operation ID, method, path and response schema. It imports nothing from the server.
- `GET /api/v1/openapi.json` is generated from that list.
- `src/mobile-api/client.ts` is the typed client generated from the same list.
- `tests/backend/mobile-api-contract.test.ts` fails when a route file has no entry in the list, or an entry has no route file.

Add a route by: writing the route file, adding its entry to `mobileRoutes`, and testing it through the route handler.

## Responses

Every response is JSON and carries the request ID in the `x-request-id` header and in the body.

```json
{ "ok": true, "data": {}, "requestId": "…" }
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "…", "requestId": "…", "fieldErrors": { "title": "…" } } }
```

| Code                                               | HTTP status |
| -------------------------------------------------- | ----------- |
| `UNAUTHENTICATED`                                  | 401         |
| `FORBIDDEN`                                        | 403         |
| `NOT_FOUND`                                        | 404         |
| `CONFLICT` (stale version, duplicate, in progress) | 409         |
| `VALIDATION_FAILED`                                | 422         |
| `RATE_LIMITED`                                     | 429         |
| `UNAVAILABLE`                                      | 503         |

## Writes

- Every `POST`, `PATCH` and `DELETE` needs an `Idempotency-Key` header of 8 to 128 characters. Resend the same key when retrying; the first result is replayed instead of acting twice. A key reused for a different request returns `409`. `readIdempotencyKey` (`src/server/api/idempotency-key.ts`) reads it, and the service passes it to `Idempotency.run`.
- Records that can be edited concurrently carry a `version`. Send it back as `expectedVersion`; a stale value returns `409`.

## Routes

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/me` | any signed-in account | Role, company and whether a password change is pending. |
| `GET` | `/api/v1/openapi.json` | public | This contract. |
