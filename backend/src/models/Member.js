const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    mssv: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    className: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    avatarPath: {
        type: String,
        default: ''
    },
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    },
    status: {
        type: String,
        default: 'Hoạt động'
    }
}, {
    timestamps: true,
    versionKey: false
});

// Mã hóa mật khẩu trước khi lưu
memberSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) return;
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// So sánh mật khẩu
memberSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Thêm Indexes
memberSchema.index({ fullName: 'text', email: 'text' }); // Tìm kiếm văn bản (Search)
memberSchema.index({ roleId: 1 }); // Tối ưu khi lọc theo vai trò

module.exports = mongoose.model('Member', memberSchema);
