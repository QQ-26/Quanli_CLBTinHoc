const RoleSession = require('../models/RoleSession');

exports.getAllRoleSessions = async (req, res) => {
    try {
        const roleSessions = await RoleSession.find().lean();
        res.status(200).json(roleSessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getRoleSessionById = async (req, res) => {
    try {
        const roleSession = await RoleSession.findById(req.params.id);
        if (!roleSession) return res.status(404).json({ message: 'Không tìm thấy vai trò buổi sinh hoạt' });
        res.status(200).json(roleSession);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createRoleSession = async (req, res) => {
    try {
        const newRoleSession = new RoleSession(req.body);
        const savedRoleSession = await newRoleSession.save();
        res.status(201).json(savedRoleSession);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateRoleSession = async (req, res) => {
    try {
        const roleSession = await RoleSession.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!roleSession) return res.status(404).json({ message: 'Không tìm thấy vai trò buổi sinh hoạt' });
        res.status(200).json(roleSession);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteRoleSession = async (req, res) => {
    try {
        const roleSession = await RoleSession.findByIdAndDelete(req.params.id);
        if (!roleSession) return res.status(404).json({ message: 'Không tìm thấy vai trò buổi sinh hoạt' });
        res.status(200).json({ message: 'Đã xóa vai trò buổi sinh hoạt thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
