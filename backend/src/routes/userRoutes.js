const router = require('express').Router();
const controller = require('../controllers/userController');
const { auth, requireRole } = require('../middleware/auth');

// Somente o administrador gerencia contas. O perfil é relido do banco a cada requisição.
router.use(auth, requireRole('ADMIN'));
router.get('/', controller.listUsers);
router.post('/', controller.createUser);
router.patch('/:id', controller.updateUser);
router.patch('/:id/role', controller.setRole);
router.patch('/:id/status', controller.setStatus);
router.post('/:id/approve', controller.approveUser);
router.post('/:id/reject', controller.rejectUser);
router.post('/:id/reset-password', controller.resetPassword);
router.delete('/:id', controller.removeUser);

module.exports = router;
