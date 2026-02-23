const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: true
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true
    },
    status: {
        type: String,
        enum: ['Có mặt', 'Vắng', 'Có phép'],
        default: 'Vắng'
    },
    note: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    versionKey: false
});

// Index cho thống kê điểm danh
attendanceSchema.index({ sessionId: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
