#!/bin/bash
set -e

# Start a headless X server, XFCE desktop, x11vnc and noVNC
# Access via http://<host>:6080/vnc.html

export DISPLAY=:1

echo "Starting Xvfb on ${DISPLAY}..."
Xvfb ${DISPLAY} -screen 0 1280x720x24 &
XVFB_PID=$!

sleep 2

echo "Starting XFCE session..."
dbus-launch --exit-with-session startxfce4 &
XFCE_PID=$!

sleep 5

echo "Starting x11vnc on ${DISPLAY}..."
x11vnc -display ${DISPLAY} -nopw -listen 0.0.0.0 -forever -shared &
X11VNC_PID=$!

sleep 2

echo "Starting websockify/noVNC on port 6080..."
websockify --web=/usr/share/novnc 6080 localhost:5900 &
WEBSOCKIFY_PID=$!

echo ""
echo "Started noVNC desktop environment."
echo " - Xvfb PID: ${XVFB_PID}"
echo " - XFCE PID: ${XFCE_PID}"
echo " - x11vnc PID: ${X11VNC_PID}"
echo " - websockify PID: ${WEBSOCKIFY_PID}"
echo "Open http://<host>:6080/vnc.html in your browser."

echo "To stop all services, run: kill ${XVFB_PID} ${XFCE_PID} ${X11VNC_PID} ${WEBSOCKIFY_PID}"
