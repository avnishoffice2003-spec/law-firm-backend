const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema({
    title: { 
        type: String, 
        required: true,
        trim: true 
    },
    slug: { 
        type: String, 
        required: true,
        unique: true,
        lowercase: true,
        index: true // Premium Feature: Ultra-fast URL lookups for SEO
    },
    author: { 
        type: String, 
        required: true,
        trim: true
    },
    category: { 
        type: String, 
        required: true,
        trim: true,
        index: true // Premium Feature: Fast filtering when user clicks a category
    },
    content: { 
        type: String, 
        required: true 
    },
    imageUrl: { 
        type: String,
        default: null // Safely handles posts published without a cover image
    }
}, { 
    timestamps: true // Automatically adds createdAt and updatedAt behind the scenes
});

// CTO Optimization: We always fetch blogs newest first. 
// This index forces MongoDB to keep them pre-sorted, saving server CPU.
postSchema.index({ createdAt: -1 });

const Post = mongoose.model('Post', postSchema);
module.exports = Post;