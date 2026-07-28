require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const purchaseRoutes = require('./routes/purchases');
const scanRoutes = require('./routes/scan');
const progressRoutes = require('./routes/progress');
const qrImageRoutes = require('./routes/qrImage');
const rewardImagesRoutes = require('./routes/rewardImages');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/reward-images', express.static(path.join(__dirname, '..', 'public', 'reward-images')));
app.use(express.static(path.join(__dirname, '..', 'public'))); // serves demo.html for manual testing

app.use('/api/purchases', purchaseRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/qrcode', qrImageRoutes);
app.use('/api/reward-images', rewardImagesRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`QR reward backend listening on port ${port}`));

module.exports = app;
