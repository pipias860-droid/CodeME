# Strikepoint

A browser-based tactical shooter prototype inspired by the 5v5 bomb-defusal format. It uses a Node.js WebSocket server to synchronize up to ten human players per room.

## Run it

1. Install Node.js 18 or newer.
2. In this folder, run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in up to ten browser tabs. Use the same room code to play together; `QUICK` is the default.

To play with people on another device, host the server on a machine reachable by them, then share its address and room code. The host needs to allow inbound TCP traffic on port 3000 (or the port configured with `PORT`).

## Deploy free on Render

The included `render.yaml` configures a free Node.js web service in Frankfurt. Push this project to GitHub, create a Render account, choose **New → Blueprint**, and connect the repository. Render reads `render.yaml`, builds with `npm install`, and starts the game with `npm start`. When it finishes, open the `onrender.com` address shown in Render and share it with players.

Free Render services can sleep after 15 minutes without activity and may take about a minute to wake. Game rooms are kept in server memory, so a restart clears them. The service is configured as a single free instance for this prototype.

## Controls

- **W A S D:** move
- **Shift:** walk slowly
- **Mouse:** aim
- **Left click:** fire
- **E:** plant the spike as a Terrorist at site A, or defuse as a Counter-Terrorist
- **Enter:** open chat; **Enter** sends, **Escape** closes

Teams auto-balance as players join. Rounds end on elimination, a defuse, a detonation, or the timer. The first side to 13 round wins takes the match.
