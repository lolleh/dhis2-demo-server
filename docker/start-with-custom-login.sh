#!/bin/sh
set -e

# Start catalina in background
catalina.sh run &

# Wait for the login app directory to appear and apply customization
echo "Waiting for DHIS2 login app to be installed..."
while true; do
    LOGIN_DIR=$(find /opt/dhis2/files/apps -maxdepth 1 -type d -name "login_*" 2>/dev/null | head -1)
    if [ -n "$LOGIN_DIR" ] && [ -f "$LOGIN_DIR/index.html" ]; then
        echo "Applying custom login page to $LOGIN_DIR"
        cp /custom-login/index.html "$LOGIN_DIR/index.html"
        cp /custom-login/custom-logo.png "$LOGIN_DIR/custom-logo.png"
        echo "Custom login page applied successfully."
        break
    fi
    sleep 2
done

# Wait for catalina to finish
wait
