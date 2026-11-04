#!/bin/zsh
# Double-click to run the UNITE demo. It starts MySQL, the API and the website,
# then opens the site in your default browser. Close this window to stop it.
cd "$(dirname "$0")"
URL="http://localhost:5173"
OPEN_URL="$URL/?intro"

up() { curl -s -o /dev/null "$1" }

if up "$URL" && up "http://localhost:4000/api/auth/me"; then
  echo "UNITE is already running. Opening $URL"
  open "$OPEN_URL"
  exit 0
fi

echo "Starting MySQL..."
brew services start mysql >/dev/null 2>&1

echo "Starting the UNITE API and website..."
(cd backend && npm run dev) &
API=$!
(cd frontend && npm run dev -- --port 5173 --strictPort) &
WEB=$!
trap 'echo "Stopping UNITE..."; kill $API $WEB 2>/dev/null; exit 0' INT TERM HUP EXIT

for i in {1..60}; do
  up "$URL" && up "http://localhost:4000/api/auth/me" && break
  sleep 1
done

open "$OPEN_URL"
echo
echo "UNITE is running at $URL"
echo "Sign in with a demo email; the 6-digit code appears in this window as [mail] ... Your UNITE code is ..."
echo "  Student: 26dm001@psgtech.ac.in"
echo "  Faculty: demo.faculty@psgtech.ac.in"
echo "  Admin:   demo.admin@psgtech.ac.in"
echo
echo "Close this window (or press Ctrl+C) to stop."
wait
