const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');

router.get('/stats', memberController.getMemberStats);
router.get('/', memberController.getAllMembers);
router.post('/', memberController.createMember);
router.get('/:id', memberController.getMemberById);
router.put('/:id', memberController.updateMember);
router.delete('/:id', memberController.deleteMember);
router.delete('/', memberController.deleteAllMembers);

module.exports = router;
