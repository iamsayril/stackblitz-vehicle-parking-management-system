// =============================================================
//  VEHICLE PARKING API — server.js
//  This is the BACKEND of your system. It runs on a server
//  (hosted on Render) and listens for requests from any
//  frontend that wants to manage parked vehicles.
//
//  What this file does, in simple terms:
//    1. Sets up an Express web server
//    2. Stores vehicle data in a simple array (in-memory)
//    3. Exposes API endpoints so a frontend can:
//         • View all vehicles
//         • Search / filter by status or plate number
//         • Add a new vehicle (entry)
//         • Update a vehicle (e.g. mark as "left")
//         • Delete a vehicle record
// =============================================================


// =============================================================
//  IMPORTS
//  require() loads external packages installed via npm.
// =============================================================

// express → the framework that makes it easy to build a web server in Node.js
const express = require('express');

// cors → stands for Cross-Origin Resource Sharing.
//        Without this, browsers BLOCK requests from a frontend
//        on a different domain/port than the backend.
//        e.g. your frontend on Vercel can't talk to your backend
//        on Render unless CORS is enabled.
const cors = require('cors');


// =============================================================
//  APP SETUP
// =============================================================

// Create the Express application instance
const app = express();

// Determine which port to listen on.
// process.env.PORT → Render (and most hosts) set this automatically.
// || 3000          → fallback for local development on your own machine.
const port = process.env.PORT || 3000;

// Middleware — these run on EVERY request before it reaches any route.

// Enable CORS for all routes — allows any frontend to call this API
app.use(cors());

// Parse incoming request bodies as JSON automatically.
// Without this, req.body would be undefined in POST/PUT routes.
app.use(express.json());


// =============================================================
//  ROOT ROUTE
//  GET /
//  A simple health-check endpoint. Render (and other hosts)
//  sometimes ping the root URL to check if the server is alive.
//  Returning a JSON response here prevents a "not found" error.
// =============================================================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Vehicle API is running 🚀'
  });
});


// =============================================================
//  IN-MEMORY DATA STORE
//  In a real production app this would be a database (e.g. MySQL).
//  Here we use a plain JavaScript array. Note: data resets every
//  time the server restarts (e.g. after a Render deploy).
//
//  Each vehicle object has these fields:
//    id          → unique number, auto-incremented
//    plateNumber → the vehicle's plate (e.g. 'ABC-1234')
//    vehicleType → 'Car', 'Motorcycle', or 'Truck'
//    entryTime   → Date object — when the vehicle entered
//    exitTime    → Date object or null — when it left (null = still parked)
//    status      → 'parked' (still here) or 'left' (has exited)
// =============================================================
let vehicles = [
  { id: 1, plateNumber: 'ABC-1234', vehicleType: 'Car',        entryTime: new Date(), exitTime: null,       status: 'parked' },
  { id: 2, plateNumber: 'XYZ-5678', vehicleType: 'Motorcycle', entryTime: new Date(), exitTime: null,       status: 'parked' },
  { id: 3, plateNumber: 'LMN-9012', vehicleType: 'Truck',      entryTime: new Date(), exitTime: new Date(), status: 'left'   }
];

// nextId tracks the ID to assign to the NEXT new vehicle.
// Starts at 4 because the sample data above already uses 1, 2, 3.
let nextId = 4;


// =============================================================
//  HELPER FUNCTIONS
//  Small reusable utilities so we don't repeat the same code
//  in every route.
// =============================================================

// -------------------------------------------------------------
//  send(res, success, data, message, status)
//  A shortcut for sending a consistent JSON response format.
//  Every API response from this server looks like:
//    { success: true/false, data: {...}, message: "..." }
//
//  Parameters:
//    res     → the Express response object
//    success → true if the request worked, false if it failed
//    data    → the payload to return (vehicle object, array, counts, etc.)
//    message → a human-readable note (e.g. 'Vehicle added')
//    status  → HTTP status code (200 = OK, 201 = Created, 404 = Not Found, etc.)
// -------------------------------------------------------------
const send = (res, success, data = null, message = null, status = 200) => {
  return res.status(status).json({ success, data, message });
};

// -------------------------------------------------------------
//  normalize(plate)
//  Converts a plate number into a lowercase, symbols-stripped
//  string so we can compare plates without caring about dashes,
//  spaces, or capitalisation.
//
//  Examples:
//    'ABC-1234' → 'abc1234'
//    'abc 1234' → 'abc1234'
//    'ABC1234'  → 'abc1234'
//
//  This lets us catch duplicates even when the user types the
//  plate in a slightly different format.
// -------------------------------------------------------------
const normalize = (plate) => plate.toLowerCase().replace(/[^a-z0-9]/g, '');


// =============================================================
//  ROUTES — READ (GET requests)
//  These endpoints return data without changing anything.
//
//  IMPORTANT: Express matches routes TOP TO BOTTOM and stops
//  at the first match. Routes like /count, /recent, /search,
//  and /status/parked MUST be defined BEFORE /api/vehicles/:id
//  otherwise Express would treat 'count', 'recent', etc. as
//  an :id parameter and try to look up a vehicle with that ID.
// =============================================================

// -------------------------------------------------------------
//  GET /api/vehicles
//  Returns the full list of all vehicles (parked + left).
// -------------------------------------------------------------
app.get('/api/vehicles', (req, res) => {
  send(res, true, vehicles);
});

// -------------------------------------------------------------
//  GET /api/vehicles/count
//  Returns summary counts:
//    total  → how many vehicle records exist in total
//    parked → how many are currently in the parking lot
//    left   → how many have already exited
//
//  Useful for a dashboard header (like the stat chips in your frontend).
//
//  NOTE: This MUST come before /:id so Express doesn't mistake
//  "count" for a vehicle ID.
// -------------------------------------------------------------
app.get('/api/vehicles/count', (req, res) => {
  const total  = vehicles.length;
  const parked = vehicles.filter(v => v.status === 'parked').length;
  const left   = vehicles.filter(v => v.status === 'left').length;
  send(res, true, { total, parked, left });
});

// -------------------------------------------------------------
//  GET /api/vehicles/recent
//  Returns the 5 most recently added vehicles, newest first.
//
//  How it works:
//    .slice(-5)  → take the last 5 items from the array
//    .reverse()  → flip so the newest is first
// -------------------------------------------------------------
app.get('/api/vehicles/recent', (req, res) => {
  const recent = vehicles.slice(-5).reverse();
  send(res, true, recent);
});

// -------------------------------------------------------------
//  GET /api/vehicles/search?plate=<query>
//  Searches vehicles by plate number (partial match, case-insensitive).
//
//  How to call it:
//    /api/vehicles/search?plate=abc
//    /api/vehicles/search?plate=ABC-1234
//
//  req.query.plate → the value after ?plate= in the URL
//
//  Uses normalize() on both sides so 'ABC-1' matches 'abc1',
//  'ABC 1', etc.
//
//  Returns 400 if the ?plate= query parameter is missing.
// -------------------------------------------------------------
app.get('/api/vehicles/search', (req, res) => {
  const plate = req.query.plate;

  // Guard: plate query param is required
  if (!plate) return send(res, false, null, 'Missing plate query', 400);

  const query  = normalize(plate); // normalize the search term
  const result = vehicles.filter(v =>
    normalize(v.plateNumber).includes(query) // partial match
  );

  send(res, true, result);
});

// -------------------------------------------------------------
//  GET /api/vehicles/status/parked
//  Returns only the vehicles currently in the parking lot.
// -------------------------------------------------------------
app.get('/api/vehicles/status/parked', (req, res) => {
  send(res, true, vehicles.filter(v => v.status === 'parked'));
});

// -------------------------------------------------------------
//  GET /api/vehicles/status/left
//  Returns only the vehicles that have already exited.
// -------------------------------------------------------------
app.get('/api/vehicles/status/left', (req, res) => {
  send(res, true, vehicles.filter(v => v.status === 'left'));
});

// -------------------------------------------------------------
//  GET /api/vehicles/:id
//  Returns a single vehicle by its numeric ID.
//
//  :id is a route parameter — Express puts its value in req.params.id.
//  We use == (not ===) because req.params.id is a STRING ('3')
//  but vehicle.id is a NUMBER (3). == handles that comparison.
//
//  Returns 404 if no vehicle with that ID exists.
// -------------------------------------------------------------
app.get('/api/vehicles/:id', (req, res) => {
  const vehicle = vehicles.find(v => v.id == req.params.id);
  if (!vehicle) return send(res, false, null, 'Vehicle not found', 404);

  send(res, true, vehicle);
});


// =============================================================
//  ROUTES — WRITE (POST / PUT / DELETE requests)
//  These endpoints create, update, or delete data.
// =============================================================

// -------------------------------------------------------------
//  POST /api/vehicles
//  Adds a new vehicle to the parking lot (vehicle entry).
//
//  Required request body (JSON):
//    { "plateNumber": "DEF-3456", "vehicleType": "Car" }
//
//  What it does:
//    1. Checks that plateNumber and vehicleType were provided
//    2. Checks that the plate doesn't already exist (no duplicates)
//    3. Creates a new vehicle object with:
//         - a fresh auto-incremented ID
//         - entryTime set to right now
//         - exitTime as null (hasn't left yet)
//         - status as 'parked'
//    4. Pushes it into the vehicles array
//    5. Returns 201 Created with the new vehicle
// -------------------------------------------------------------
app.post('/api/vehicles', (req, res) => {
  const { plateNumber, vehicleType } = req.body;

  // Validate required fields — both must be present
  if (!plateNumber || !vehicleType) {
    return send(res, false, null, 'Missing fields', 400);
  }

  // Check for duplicate plate numbers (case/symbol-insensitive)
  const exists = vehicles.find(v =>
    normalize(v.plateNumber) === normalize(plateNumber)
  );

  if (exists) return send(res, false, null, 'Plate already exists', 400);

  // Build the new vehicle object
  const newVehicle = {
    id: nextId++,        // assign current nextId, then increment for next time
    plateNumber,
    vehicleType,
    entryTime: new Date(), // record the exact moment of entry
    exitTime: null,        // hasn't left yet
    status: 'parked'       // default status on entry
  };

  vehicles.push(newVehicle);                          // add to our data store
  send(res, true, newVehicle, 'Vehicle added', 201);  // 201 = Created
});

// -------------------------------------------------------------
//  PUT /api/vehicles/:id
//  Updates an existing vehicle's details.
//
//  All body fields are OPTIONAL — only send what you want to change:
//    { "plateNumber": "NEW-9999" }          ← change plate only
//    { "status": "left" }                   ← mark as exited
//    { "vehicleType": "Truck" }             ← change type only
//    { "plateNumber": "X", "status": "left" } ← multiple at once
//
//  Business rules enforced:
//    • New plate must not already belong to another vehicle
//    • vehicleType must be one of: Car, Motorcycle, Truck
//    • status must be one of: parked, left
//    • Setting status to 'left' auto-sets exitTime to now
//    • Setting status back to 'parked' clears exitTime (null)
// -------------------------------------------------------------
app.put('/api/vehicles/:id', (req, res) => {
  // Find the vehicle to update
  const vehicle = vehicles.find(v => v.id == req.params.id);
  if (!vehicle) return send(res, false, null, 'Vehicle not found', 404);

  const { plateNumber, vehicleType, status } = req.body;

  // ── Update plateNumber (if provided) ──────────────────────
  if (plateNumber) {
    // Make sure the new plate isn't already used by a DIFFERENT vehicle
    const duplicate = vehicles.find(
      v => v.id != req.params.id &&                        // not the same vehicle
      normalize(v.plateNumber) === normalize(plateNumber)  // same normalized plate
    );
    if (duplicate) return send(res, false, null, 'Plate already in use', 400);

    vehicle.plateNumber = plateNumber; // apply the update
  }

  // ── Update vehicleType (if provided) ──────────────────────
  if (vehicleType) {
    const validTypes = ['Car', 'Motorcycle', 'Truck'];

    // Reject anything that isn't one of the three allowed types
    if (!validTypes.includes(vehicleType)) {
      return send(res, false, null, 'Invalid vehicle type', 400);
    }

    vehicle.vehicleType = vehicleType;
  }

  // ── Update status (if provided) ───────────────────────────
  if (status) {
    if (!['parked', 'left'].includes(status)) {
      return send(res, false, null, 'Invalid status', 400);
    }

    vehicle.status = status;

    // Auto-manage exitTime based on the new status:
    //   'left'   → set exitTime to the current time
    //   'parked' → clear exitTime back to null (re-entry scenario)
    vehicle.exitTime = status === 'left' ? new Date() : null;
  }

  send(res, true, vehicle, 'Updated'); // return the full updated vehicle
});

// -------------------------------------------------------------
//  DELETE /api/vehicles/:id
//  Permanently removes a vehicle record from the array.
//
//  findIndex() returns the array position (-1 if not found).
//  splice(index, 1) removes exactly 1 item at that position
//  and returns it as an array — [0] grabs just the object.
//
//  Returns the deleted vehicle so the frontend can confirm
//  which record was removed.
// -------------------------------------------------------------
app.delete('/api/vehicles/:id', (req, res) => {
  const index = vehicles.findIndex(v => v.id == req.params.id);

  // -1 means findIndex didn't find any matching vehicle
  if (index === -1) return send(res, false, null, 'Vehicle not found', 404);

  const removed = vehicles.splice(index, 1)[0]; // remove and capture the deleted item
  send(res, true, removed, 'Deleted');
});


// =============================================================
//  GLOBAL ERROR HANDLER
//  Express has a special 4-argument middleware signature:
//    (err, req, res, next)
//  If any route throws an unhandled error, Express automatically
//  passes it here instead of crashing the whole server.
//  We log the full stack trace for debugging and return a
//  clean 500 response to the client.
// =============================================================
app.use((err, req, res, next) => {
  console.error(err.stack); // print the full error to the server logs
  res.status(500).json({ success: false, data: null, message: 'Internal server error' });
});


// =============================================================
//  START THE SERVER
//  app.listen() tells Node.js to start accepting incoming
//  HTTP connections on the specified port.
//  The callback runs once the server is ready.
// =============================================================
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});