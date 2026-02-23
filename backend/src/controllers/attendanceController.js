const Attendance = require('../models/Attendance');

exports.getAllAttendance = async (req, res) => {
    try {
        const list = await Attendance.find()
            .populate('sessionId')
            .populate('memberId')
            .lean();
        res.status(200).json(list);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAttendanceById = async (req, res) => {
    try {
        const record = await Attendance.findById(req.params.id)
            .populate('sessionId')
            .populate('memberId');
        if (!record) return res.status(404).json({ message: 'Không tìm thấy bản ghi điểm danh' });
        res.status(200).json(record);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.markAttendance = async (req, res) => {
    try {
        const attendance = new Attendance(req.body);
        const saved = await attendance.save();
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getAttendanceBySession = async (req, res) => {
    try {
        const list = await Attendance.find({ sessionId: req.params.sessionId })
            .populate('memberId')
            .lean();
        res.status(200).json(list);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!attendance) return res.status(404).json({ message: 'Không tìm thấy bản ghi điểm danh' });
        res.status(200).json(attendance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.findByIdAndDelete(req.params.id);
        if (!attendance) return res.status(404).json({ message: 'Không tìm thấy bản ghi điểm danh' });
        res.status(200).json({ message: 'Đã xóa bản ghi điểm danh thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
