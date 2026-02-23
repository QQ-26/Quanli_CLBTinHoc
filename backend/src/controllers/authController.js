const jwt = require('jsonwebtoken');
const Member = require('../models/Member');

// Tạo Access Token
const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
};

// Tạo Refresh Token
const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

exports.login = async (req, res) => {
    try {
        const { mssv, password } = req.body;

        // 1. Kiểm tra MSSV
        const member = await Member.findOne({ mssv });
        if (!member) {
            console.log(`❌ Login failed: Không tìm thấy MSSV ${mssv}`);
            return res.status(401).json({ message: 'MSSV hoặc mật khẩu không chính xác' });
        }

        // 2. Kiểm tra mật khẩu
        const isMatch = await member.comparePassword(password);
        if (!isMatch) {
            console.log(`❌ Login failed: Sai mật khẩu cho MSSV ${mssv}`);
            return res.status(401).json({ message: 'MSSV hoặc mật khẩu không chính xác' });
        }

        // 3. Tạo tokens
        const accessToken = generateAccessToken(member._id);
        const refreshToken = generateRefreshToken(member._id);

        res.status(200).json({
            message: 'Đăng nhập thành công',
            accessToken,
            refreshToken,
            member: {
                id: member._id,
                fullName: member.fullName,
                mssv: member.mssv,
                roleId: member.roleId
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Không tìm thấy Refresh Token' });

    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        const accessToken = generateAccessToken(decoded.id);
        res.status(200).json({ accessToken });
    } catch (error) {
        res.status(403).json({ message: 'Refresh Token không hợp lệ' });
    }
};
