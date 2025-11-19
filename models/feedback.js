const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const feedbackSchema = new Schema({
    clientName: {
        type: String,
        required: true
    },
    address: {
        type: String
    },
    occupation: {
        type: String
    },
    serviceTaken: {
        type: String,
        required: true
    },
    feedbackContent: {
        type: String,
        required: true
    },
    isApproved: {
        type: Boolean,
        default: false // CRUCIAL: Must be false until admin approves
    }
}, { timestamps: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;