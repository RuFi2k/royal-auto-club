#!/bin/sh
set -e

firebase emulators:start --project "${FIREBASE_PROJECT:-demo-crm}" &
EMULATOR_PID=$!

# Wait until the Auth emulator is ready
echo "[seed] waiting for Auth emulator on :9099..."
until curl -sf "http://localhost:9099/" >/dev/null 2>&1; do
  sleep 1
done

if [ -n "$SEED_ADMIN_EMAIL" ] && [ -n "$SEED_ADMIN_PASSWORD" ]; then
  echo "[seed] creating admin user $SEED_ADMIN_EMAIL..."
  curl -s -o /dev/null -w "[seed] signup: HTTP %{http_code}\n" \
    -X POST "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"$SEED_ADMIN_PASSWORD\",\"returnSecureToken\":true}" || true
fi

wait $EMULATOR_PID
