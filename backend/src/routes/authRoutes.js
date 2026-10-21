const router = require('express').Router();
const controller = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.get('/setup-status', controller.setupStatus);
router.post('/bootstrap-admin', controller.bootstrapAdmin);
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', auth, controller.me);
router.post('/heartbeat', auth, controller.heartbeat);
router.post('/logout', auth, controller.logout);
router.post('/change-password', auth, controller.changePassword);

module.exports = router;
