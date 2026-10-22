const router = require('express').Router();
const controller = require('../controllers/presenceController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/online', auth, requireRole('ADMIN', 'GESTAO'), controller.listPresence);

module.exports = router;
