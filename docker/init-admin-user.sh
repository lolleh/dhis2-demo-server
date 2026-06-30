#!/bin/sh
set -e

BASE_URL="http://web:8080"
USERNAME="vlolleh"
PASSWORD="Vamba@2026"
ADMIN_USER="admin"
ADMIN_PASS="district"

echo "Waiting for DHIS2 to be ready..."
until curl -s -o /dev/null -w "%{http_code}" -u "$ADMIN_USER:$ADMIN_PASS" "$BASE_URL/api/system/info" | grep -q "200"; do
    sleep 5
done

echo "DHIS2 is ready. Checking if user '$USERNAME' exists..."
EXISTING=$(curl -s -u "$ADMIN_USER:$ADMIN_PASS" "$BASE_URL/api/users?filter=username:eq:$USERNAME&fields=id")

if echo "$EXISTING" | grep -q '"users"\s*:\s*\[[^]]'; then
    echo "User '$USERNAME' already exists, skipping creation."
else
    echo "Creating admin user '$USERNAME'..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/users" \
        -u "$ADMIN_USER:$ADMIN_PASS" \
        -H "Content-Type: application/json" \
        -d "{
            \"firstName\": \"Vamba\",
            \"surname\": \"vlolleh\",
            \"username\": \"$USERNAME\",
            \"password\": \"$PASSWORD\",
            \"email\": \"vlolleh@example.com\",
            \"userRoles\": [{\"id\": \"Ufph3mGRmMo\"}]
        }")

    if echo "$RESPONSE" | grep -q '"httpStatus":"Created"'; then
        echo "Admin user '$USERNAME' created successfully."
    elif echo "$RESPONSE" | grep -q '"httpStatus":"Conflict"'; then
        echo "User '$USERNAME' already exists (conflict)."
    else
        echo "Warning: Unexpected response: $RESPONSE"
    fi
fi
