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

// CTO FIX: Use mongoose.models to check if the model already exists before compiling it again.
// This prevents the "OverwriteModelError: Cannot overwrite `Job` model once compiled." error
// which happens when the file is required multiple times, especially in some serverless/hot-reloading setups.
module.exports = mongoose.models.Job || mongoose.model('Job', jobSchema);