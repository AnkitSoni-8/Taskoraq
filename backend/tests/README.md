# Backend tests

    cd backend/tests
    npm install        # separate from the app's install on purpose (keeps normal installs light)
    npm test

Real Express app + real MongoDB (in-memory, downloaded once and cached) - no mocks.
Offline / already have a mongod? `MONGOMS_SYSTEM_BINARY=/path/to/mongod npm test`.

Already running MongoDB (CI / offline)? `TEST_MONGO_URI=mongodb://127.0.0.1:27017/taskoraq-test npm test` (use a throw-away database - tests wipe it).
