Office Hours (Voice) - NodeBB plugin (MVP)

This lightweight plugin adds a floating "Join OH (Voice)" button that opens an embedded Jitsi Meet room.

Installation (developer/plugin runs inside NodeBB):

1. Copy this folder into your NodeBB `node_modules` or install as plugin.
2. Restart NodeBB.
3. Visit the Admin -> Plugins page and activate "Office Hours (Voice)".
4. Ensure `bootbox` and `jquery` are available (NodeBB includes these by default).

Notes:
- This MVP uses the public meet.jit.si service and a single room name `nodebb-office-hours`.
- For private rooms, consider self-hosting Jitsi and updating the provider URL.
