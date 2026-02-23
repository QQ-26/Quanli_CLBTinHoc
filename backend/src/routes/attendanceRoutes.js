const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.get('/', attendanceController.getAllAttendance);
router.post('/', attendanceController.markAttendance);
router.get('/:id', attendanceController.getAttendanceById);
router.get('/session/:sessionId', attendanceController.getAttendanceBySession);
router.put('/:id', attendanceController.updateAttendance);
router.delete('/:id', attendanceController.deleteAttendance);

module.exports = router;
