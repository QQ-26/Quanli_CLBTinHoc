const express = require('express');
const router = express.Router();
const roleSessionController = require('../controllers/roleSessionController');

router.get('/', roleSessionController.getAllRoleSessions);
router.get('/:id', roleSessionController.getRoleSessionById);
router.post('/', roleSessionController.createRoleSession);
router.put('/:id', roleSessionController.updateRoleSession);
router.delete('/:id', roleSessionController.deleteRoleSession);

module.exports = router;
