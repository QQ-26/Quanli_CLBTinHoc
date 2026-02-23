const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    sessionName: {
        type: String,
        required: true,
        trim: true
    },
    sessionDate: {
        type: Date,
        default: Date.now
    },
    location: {
        type: String,
        trim: true
    },
    maxParticipants: {
        type: Number,
        default: 50
    },
    instructors: [{
        memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
        roleSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoleSession' }
    }]
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Session', sessionSchema);
