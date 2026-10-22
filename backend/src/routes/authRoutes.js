const router = require('express').Router();
const controller = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { loginLimiter, registerLimiter, forgotLimiter, passwordLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, controller.login);
router.post('/register', registerLimiter, controller.register);
router.post('/forgot-password', forgotLimiter, controller.forgotPassword);
router.get('/me', auth, controller.me);
router.post('/logout', auth, controller.logout);
router.post('/heartbeat', auth, controller.heartbeat);
router.post('/change-password', auth, passwordLimiter, controller.changePassword);

module.exports = router;
