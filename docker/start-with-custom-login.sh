#!/bin/sh
set -e

# Find the login app directory
LOGIN_DIR=$(find /opt/dhis2/files/apps -maxdepth 1 -type d -name "login_*" | head -1)

if [ -n "$LOGIN_DIR" ]; then
    echo "Applying custom login page to $LOGIN_DIR"
    cp /custom-login/index.html "$LOGIN_DIR/index.html"
    cp /custom-login/custom-logo.png "$LOGIN_DIR/custom-logo.png"
else
    echo "Warning: Login app directory not found"
fi

exec catalina.sh run
