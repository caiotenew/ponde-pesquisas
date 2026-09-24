const router = require('express').Router();
const controller = require('../controllers/pesquisaController');
const { auth, requireRole } = require('../middleware/auth');

router.post('/batch', auth, requireRole('JOVEM'), controller.createBatch);
router.get('/today-count', auth, requireRole('JOVEM'), controller.todayCount);
router.get('/export/csv', auth, requireRole('ADMIN', 'GESTAO', 'JOVEM'), controller.exportCsv);
router.get('/mine', auth, requireRole('JOVEM'), controller.listMine);
router.get('/dashboard/youngs', auth, requireRole('ADMIN', 'GESTAO'), controller.listYoungs);
router.get('/dashboard/summary', auth, requireRole('ADMIN', 'GESTAO'), controller.dashboardSummary);
router.get('/dashboard/users', auth, requireRole('ADMIN', 'GESTAO'), controller.dashboardUsers);

module.exports = router;
