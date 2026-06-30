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

USER_ID=$(echo "$EXISTING" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

if [ -n "$USER_ID" ]; then
    echo "User '$USERNAME' already exists (ID: $USER_ID). Ensuring Superuser role is assigned..."
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
        USER_ID=$(echo "$RESPONSE" | sed -n 's/.*"uid":"\([^"]*\)".*/\1/p')
    else
        echo "Warning: Unexpected response: $RESPONSE"
        USER_ID=$(echo "$EXISTING" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
    fi
fi

if [ -n "$USER_ID" ]; then
    echo "Assigning Superuser role to '$USERNAME' (ID: $USER_ID)..."
    ROLES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/users/$USER_ID/userRoles/Ufph3mGRmMo" \
        -u "$ADMIN_USER:$ADMIN_PASS")
    if [ "$ROLES_RESPONSE" = "200" ]; then
        echo "Superuser role assigned successfully."
    else
        echo "Note: Role assignment returned HTTP $ROLES_RESPONSE (may already be assigned)."
    fi
fi
