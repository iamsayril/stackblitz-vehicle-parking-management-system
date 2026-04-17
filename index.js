const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🚗 DATASET (Vehicle Parking System)
let vehicles = [
  {
    id: 1,
    plateNumber: 'ABC-1234',
    vehicleType: 'Car',
    entryTime: new Date(),
    status: 'parked',
  },
  {
    id: 2,
    plateNumber: 'XYZ-5678',
    vehicleType: 'Motorcycle',
    entryTime: new Date(),
    status: 'parked',
  },
  {
    id: 3,
    plateNumber: 'LMN-9012',
    vehicleType: 'Truck',
    entryTime: new Date(),
    status: 'left',
  },
];

// 🚗 GET all vehicles
app.get('/api/vehicles', (req, res) => {
  res.json(vehicles);
});

// 🚗 GET vehicle by ID
app.get('/api/vehicles/:id', (req, res) => {
  const vehicle = vehicles.find((v) => v.id == req.params.id);

  if (!vehicle) {
    return res.status(404).json({ message: 'Vehicle not found' });
  }

  res.json(vehicle);
});

// 🚗 POST add vehicle (Park vehicle)
app.post('/api/vehicles', (req, res) => {
  const { plateNumber, vehicleType } = req.body;

  if (!plateNumber || !vehicleType) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const newVehicle = {
    id: vehicles.length + 1,
    plateNumber,
    vehicleType,
    entryTime: new Date(),
    status: 'parked',
  };

  vehicles.push(newVehicle);

  res.status(201).json({
    message: 'Vehicle parked successfully',
    vehicle: newVehicle,
  });
});

// 🚗 PUT update vehicle (status or details)
app.put('/api/vehicles/:id', (req, res) => {
  const vehicle = vehicles.find((v) => v.id == req.params.id);

  if (!vehicle) {
    return res.status(404).json({ message: 'Vehicle not found' });
  }

  vehicle.plateNumber = req.body.plateNumber || vehicle.plateNumber;
  vehicle.vehicleType = req.body.vehicleType || vehicle.vehicleType;
  vehicle.status = req.body.status || vehicle.status;

  res.json({
    message: 'Vehicle updated successfully',
    vehicle,
  });
});

// 🚗 DELETE vehicle (exit parking)
app.delete('/api/vehicles/:id', (req, res) => {
  const index = vehicles.findIndex((v) => v.id == req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Vehicle not found' });
  }

  const deleted = vehicles.splice(index, 1);

  res.json({
    message: 'Vehicle exited successfully',
    vehicle: deleted[0],
  });
});

// 🚗 GET parked vehicles only
app.get('/api/vehicles/status/parked', (req, res) => {
  const parked = vehicles.filter((v) => v.status === 'parked');
  res.json(parked);
});

// 🚗 GET exited vehicles only
app.get('/api/vehicles/status/left', (req, res) => {
  const left = vehicles.filter((v) => v.status === 'left');
  res.json(left);
});

// 🚗 SEARCH vehicle by plate number
app.get('/api/vehicles/search', (req, res) => {
  const { plateNumber } = req.query;

  const result = vehicles.filter((v) =>
    v.plateNumber.toLowerCase().includes(plateNumber.toLowerCase())
  );

  res.json(result);
});

// 🚗 GET total vehicle count
app.get('/api/vehicles/count', (req, res) => {
  res.json({
    total: vehicles.length,
  });
});

// 🚗 GET recent vehicles (last 2 added)
app.get('/api/vehicles/recent', (req, res) => {
  const recent = vehicles.slice(-2);
  res.json(recent);
});

// 🚗 START SERVER
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
