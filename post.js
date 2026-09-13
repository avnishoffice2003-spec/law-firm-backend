const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const jobSchema = new Schema({
    title: { 
        type: String, 
        required: true,
        trim: true
    },
    slug: { 
        type: String, 
        unique: true,
        lowercase: true
    },
    department: { 
        type: String, 
        required: true,
        trim: true
    },
    location: { 
        type: String, 
        required: true,
        trim: true
    },
    employmentType: { 
        type: String, 
        required: true, // e.g., "Full-time", "Part-time", "Contract"
        trim: true
    },
    experienceLevel: { 
        type: String, 
        required: true, // e.g., "0-2 Years", "5+ Years", "Senior Level"
        trim: true
    },
    description: { 
        type: String, 
        required: true 
    },
    requirements: { 
        type: String, 
        required: true 
    },
    salaryRange: { 
        type: String, // Optional, but highly recommended for Google Jobs SEO
        trim: true,
        default: 'Not disclosed'
    },
    isActive: { 
        type: Boolean, 
        default: true // Allows admin to pause/close hiring for this role without deleting it
    }
}, { 
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

// Added index on isActive for faster frontend queries (since we only show active jobs)
jobSchema.index({ isActive: 1 });
// Added index on createdAt for sorting (newest first)
jobSchema.index({ createdAt: -1 });

const Job = mongoose.model('Job', jobSchema);
module.exports = Job;