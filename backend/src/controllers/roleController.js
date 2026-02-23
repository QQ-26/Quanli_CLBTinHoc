const Role = require('../models/Role');

exports.getAllRoles = async (req, res) => {
    try {
        const roles = await Role.find().lean();
        res.status(200).json(roles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getRoleById = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) return res.status(404).json({ message: 'Không tìm thấy vai trò' });
        res.status(200).json(role);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createRole = async (req, res) => {
    try {
        const newRole = new Role(req.body);
        const savedRole = await newRole.save();
        res.status(201).json(savedRole);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateRole = async (req, res) => {
    try {
        const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!role) return res.status(404).json({ message: 'Không tìm thấy vai trò' });
        res.status(200).json(role);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteRole = async (req, res) => {
    try {
        const role = await Role.findByIdAndDelete(req.params.id);
        if (!role) return res.status(404).json({ message: 'Không tìm thấy vai trò' });
        res.status(200).json({ message: 'Đã xóa vai trò thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
