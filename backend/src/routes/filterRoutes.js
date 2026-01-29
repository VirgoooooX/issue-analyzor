const express = require('express');
const router = express.Router();
const filterController = require('../controllers/filterController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect all filter routes
router.use(authMiddleware);

router.post('/', filterController.saveFilter);
router.get('/', filterController.getFilters);
router.delete('/:id', filterController.deleteFilter);

module.exports = router;
