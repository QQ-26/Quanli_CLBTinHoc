const Member = require('../models/Member');

// Lấy tất cả thành viên (Hỗ trợ phân trang, tìm kiếm)
exports.getAllMembers = async (req, res) => {
    try {
        const { page = 1, limit = 10, keyword = '' } = req.query;

        // Điều kiện tìm kiếm (theo tên hoặc mssv)
        const query = keyword ? {
            $or: [
                { fullName: { $regex: keyword, $options: 'i' } },
                { mssv: { $regex: keyword, $options: 'i' } }
            ]
        } : {};

        // Thực hiện truy vấn với lean() để tải nhanh hơn
        const members = await Member.find(query)
            .populate('roleId', 'roleName') // Chỉ lấy roleName để tối ưu
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean(); // .lean() giúp trả về plain object, nhanh hơn document gốc

        // Đếm tổng số bản ghi để phục vụ phân trang ở Frontend
        const total = await Member.countDocuments(query);

        res.status(200).json({
            members,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalMembers: total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Tạo thành viên mới
exports.createMember = async (req, res) => {
    try {
        const newMember = new Member(req.body);
        const savedMember = await newMember.save();
        res.status(201).json(savedMember);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Lấy chi tiết 1 thành viên
exports.getMemberById = async (req, res) => {
    try {
        const member = await Member.findById(req.params.id).populate('roleId').lean();
        if (!member) return res.status(404).json({ message: 'Không tìm thấy thành viên' });
        res.status(200).json(member);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Cập nhật thông tin thành viên
exports.updateMember = async (req, res) => {
    try {
        const member = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!member) return res.status(404).json({ message: 'Không tìm thấy thành viên để cập nhật' });
        res.status(200).json(member);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Xóa 1 thành viên
exports.deleteMember = async (req, res) => {
    try {
        const member = await Member.findByIdAndDelete(req.params.id);
        if (!member) return res.status(404).json({ message: 'Không tìm thấy thành viên để xóa' });
        res.status(200).json({ message: 'Đã xóa thành viên thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Xóa tất cả thành viên
exports.deleteAllMembers = async (req, res) => {
    try {
        await Member.deleteMany({});
        res.status(200).json({ message: 'Đã xóa toàn bộ thành viên' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Thống kê tổng quan thành viên
exports.getMemberStats = async (req, res) => {
    try {
        const stats = await Member.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);
        const total = await Member.countDocuments();
        res.status(200).json({ total, detail: stats });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
