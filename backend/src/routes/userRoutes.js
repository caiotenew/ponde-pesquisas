const router = require('express').Router();
const controller = require('../controllers/userController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth, requireRole('ADMIN'));
router.get('/', controller.listUsers);
router.post('/', controller.createUser);
router.delete('/:id', controller.removeUser);

module.exports = router;
