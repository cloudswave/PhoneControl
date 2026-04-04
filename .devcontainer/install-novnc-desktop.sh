#!/bin/bash
set -e

echo "=== noVNC desktop setup and startup ==="

PKGS=(xfce4 x11vnc xvfb novnc websockify tigervnc-standalone-server dbus-x11)
missing=()
for pkg in "${PKGS[@]}"; do
  if ! dpkg -s "$pkg" >/dev/null 2>&1; then
    missing+=("$pkg")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Installing missing packages: ${missing[*]}"
  if [ "$EUID" -ne 0 ]; then
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends "${missing[@]}"
  else
    apt-get update
    apt-get install -y --no-install-recommends "${missing[@]}"
  fi
fi

export DISPLAY=:1
LOG_DIR="/tmp/novnc-desktop"
mkdir -p "$LOG_DIR"

if pgrep -f "Xvfb :1" >/dev/null 2>&1; then
  echo "Xvfb is already running on ${DISPLAY}."
else
  echo "Starting Xvfb on ${DISPLAY}..."
  Xvfb ${DISPLAY} -screen 0 1280x720x24 >"$LOG_DIR/xvfb.log" 2>&1 &
  XVFB_PID=$!
  sleep 2
fi

if pgrep -f "startxfce4" >/dev/null 2>&1; then
  echo "XFCE session already running."
else
  echo "Starting XFCE session..."
  dbus-launch --exit-with-session startxfce4 >"$LOG_DIR/xfce.log" 2>&1 &
  XFCE_PID=$!
  sleep 5
fi

if pgrep -f "x11vnc -display ${DISPLAY}" >/dev/null 2>&1; then
  echo "x11vnc is already running for ${DISPLAY}."
else
  echo "Starting x11vnc on ${DISPLAY}..."
  x11vnc -display ${DISPLAY} -nopw -listen 0.0.0.0 -forever -shared >"$LOG_DIR/x11vnc.log" 2>&1 &
  X11VNC_PID=$!
  sleep 2
fi

if pgrep -f "websockify --web=/usr/share/novnc" >/dev/null 2>&1; then
  echo "websockify/noVNC already running."
else
  echo "Starting websockify/noVNC on port 6080..."
  websockify --web=/usr/share/novnc 6080 localhost:5900 >"$LOG_DIR/websockify.log" 2>&1 &
  WEBSOCKIFY_PID=$!
  sleep 2
fi

echo ""
echo "noVNC desktop started."
echo "Connect at http://<host>:6080/vnc.html"
echo "Logs: $LOG_DIR"
