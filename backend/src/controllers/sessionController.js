const Session = require('../models/Session');
const Attendance = require('../models/Attendance');

exports.getAllSessions = async (req, res) => {
    try {
        const sessions = await Session.find()
            .populate('instructors.memberId')
            .populate('instructors.roleSessionId');
        res.status(200).json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSessionById = async (req, res) => {
    try {
        const session = await Session.findById(req.params.id)
            .populate('instructors.memberId')
            .populate('instructors.roleSessionId');
        if (!session) return res.status(404).json({ message: 'Không tìm thấy buổi sinh hoạt' });
        res.status(200).json(session);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createSession = async (req, res) => {
    try {
        const newSession = new Session(req.body);
        const savedSession = await newSession.save();
        res.status(201).json(savedSession);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateSession = async (req, res) => {
    try {
        const session = await Session.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        ).populate('instructors.memberId').populate('instructors.roleSessionId');

        if (!session) return res.status(404).json({ message: 'Không tìm thấy buổi sinh hoạt' });
        res.status(200).json(session);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteSession = async (req, res) => {
    try {
        const session = await Session.findByIdAndDelete(req.params.id);
        if (!session) return res.status(404).json({ message: 'Không tìm thấy buổi sinh hoạt' });

        // Cascade delete attendance records for this session
        await Attendance.deleteMany({ sessionId: req.params.id });

        res.status(200).json({ message: 'Đã xóa buổi sinh hoạt và dữ liệu điểm danh liên quan' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
