console.log('1. Starting...');

console.log('2. Loading express...');
const express = require('express');

console.log('3. Loading multer...');
const multer = require('multer');

console.log('4. Loading axios...');
const axios = require('axios');

console.log('5. Loading logger...');
const { logger } = require('./utils/logger');

console.log('6. Creating router...');
const router = express.Router();

console.log('7. Configuring multer...');
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'));
    }
  }
});

console.log('8. Defining middleware...');
const verifyUserToken = async (req, res, next) => {
  console.log('verifyUserToken called');
  next();
};

console.log('9. Adding route...');
router.get('/import/wuzapi', verifyUserToken, async (req, res) => {
  res.json({ test: true });
});

console.log('10. Exporting router...');
module.exports = router;

console.log('11. Done!');
