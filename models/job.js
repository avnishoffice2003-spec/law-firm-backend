const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    slug: { 
        type: String, 
        required: true, 
        unique: true 
    },
    department: { 
        type: String 
    },
    location: { 
        type: String 
    },
    employmentType: { 
        type: String // Example: Full-time, Part-time, Contract
    },
    experienceLevel: { 
        type: String // Example: Entry-level, Mid-Senior, Director
    },
    description: { 
        type: String, 
        required: true 
    },
    requirements: { 
        type: String 
    },
    salaryRange: { 
        type: String 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { 
    // Timestamps true karne se createdAt aur updatedAt apne aap add ho jayenge
    timestamps: true 
});

module.exports = mongoose.model('Job', jobSchema);