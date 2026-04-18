const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= DATA =================
let vehicles = [
  { id: 1, plateNumber: 'ABC-1234', vehicleType: 'Car',        entryTime: new Date(), exitTime: null,       status: 'parked' },
  { id: 2, plateNumber: 'XYZ-5678', vehicleType: 'Motorcycle', entryTime: new Date(), exitTime: null,       status: 'parked' },
  { id: 3, plateNumber: 'LMN-9012', vehicleType: 'Truck',      entryTime: new Date(), exitTime: new Date(), status: 'left'   }
];

let nextId = 4;

// ================= HELPERS =================
const send = (res, success, data = null, message = null, status = 200) => {
  res.status(status).json({ success, data, message });
};

const normalize = (plate) => plate.toLowerCase().replace(/[^a-z0-9]/g, '');

// ================= GET ALL =================
app.get('/api/vehicles', (req, res) => {
  send(res, true, vehicles);
});

// ================= COUNT =================
// ⚠️ Must be defined BEFORE /api/vehicles/:id or Express will treat "count" as an id
app.get('/api/vehicles/count', (req, res) => {
  const total    = vehicles.length;
  const parked   = vehicles.filter(v => v.status === 'parked').length;
  const left     = vehicles.filter(v => v.status === 'left').length;
  send(res, true, { total, parked, left });
});

// ================= RECENT =================
app.get('/api/vehicles/recent', (req, res) => {
  const recent = vehicles.slice(-5).reverse();
  send(res, true, recent);
});

// ================= SEARCH =================
app.get('/api/vehicles/search', (req, res) => {
  const plate = req.query.plate;
  if (!plate) return send(res, false, null, 'Missing plate query', 400);

  const query  = normalize(plate);
  const result = vehicles.filter(v => normalize(v.plateNumber).includes(query));
  send(res, true, result);
});

// ================= FILTERS =================
// ⚠️ Also must come BEFORE /:id
app.get('/api/vehicles/status/parked', (req, res) => {
  send(res, true, vehicles.filter(v => v.status === 'parked'));
});

app.get('/api/vehicles/status/left', (req, res) => {
  send(res, true, vehicles.filter(v => v.status === 'left'));
});

// ================= GET BY ID =================
app.get('/api/vehicles/:id', (req, res) => {
  const vehicle = vehicles.find(v => v.id == req.params.id);
  if (!vehicle) return send(res, false, null, 'Vehicle not found', 404);
  send(res, true, vehicle);
});

// ================= ADD =================
app.post('/api/vehicles', (req, res) => {
  const { plateNumber, vehicleType } = req.body;

  if (!plateNumber || !vehicleType) {
    return send(res, false, null, 'Missing fields', 400);
  }

  const exists = vehicles.find(v => normalize(v.plateNumber) === normalize(plateNumber));
  if (exists) return send(res, false, null, 'Plate already exists', 400);

  const newVehicle = {
    id: nextId++,
    plateNumber,
    vehicleType,
    entryTime: new Date(),
    exitTime:  null,
    status:    'parked'
  };

  vehicles.push(newVehicle);
  send(res, true, newVehicle, 'Vehicle added', 201);
});

// ================= UPDATE =================
app.put('/api/vehicles/:id', (req, res) => {
  const vehicle = vehicles.find(v => v.id == req.params.id);
  if (!vehicle) return send(res, false, null, 'Vehicle not found', 404);

  const { plateNumber, vehicleType, status } = req.body;

  // Update plate number — check for duplicate on other vehicles
  if (plateNumber !== undefined && plateNumber !== '') {
    const duplicate = vehicles.find(
      v => v.id != req.params.id && normalize(v.plateNumber) === normalize(plateNumber)
    );
    if (duplicate) return send(res, false, null, 'Plate number already in use', 400);
    vehicle.plateNumber = plateNumber;
  }

  // Update vehicle type
  if (vehicleType !== undefined && vehicleType !== '') {
    const validTypes = ['Car', 'Motorcycle', 'Truck'];
    if (!validTypes.includes(vehicleType)) {
      return send(res, false, null, `Invalid vehicle type. Must be one of: ${validTypes.join(', ')}`, 400);
    }
    vehicle.vehicleType = vehicleType;
  }

  // Update status
  if (status !== undefined && status !== '') {
    if (!['parked', 'left'].includes(status)) {
      return send(res, false, null, 'Invalid status. Must be "parked" or "left"', 400);
    }
    vehicle.status = status;
    vehicle.exitTime = status === 'left' ? new Date() : null;
  }

  send(res, true, vehicle, 'Vehicle updated successfully');
});

// ================= DELETE =================
app.delete('/api/vehicles/:id', (req, res) => {
  const i = vehicles.findIndex(v => v.id == req.params.id);
  if (i === -1) return send(res, false, null, 'Vehicle not found', 404);

  const removed = vehicles.splice(i, 1)[0];
  send(res, true, removed, 'Deleted');
});

// ================= START =================
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});