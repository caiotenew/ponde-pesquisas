const router = require('express').Router();
const controller = require('../controllers/userController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/online', auth, requireRole('ADMIN', 'GESTAO'), controller.listOnlineYoungs);
router.use(auth, requireRole('ADMIN'));
router.get('/', controller.listUsers);
router.post('/', controller.createUser);
router.patch('/:id', controller.updateUser);
router.put('/:id/password', controller.resetUserPassword);
router.delete('/:id', controller.removeUser);

module.exports = router;
