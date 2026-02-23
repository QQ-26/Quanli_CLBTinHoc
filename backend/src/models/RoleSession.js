const mongoose = require('mongoose');

const roleSessionSchema = new mongoose.Schema({
    roleSessionName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('RoleSession', roleSessionSchema);
