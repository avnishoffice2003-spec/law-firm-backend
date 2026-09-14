const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const marked = require('marked');

// Models
const Post = require('./post'); 
const Feedback = require('./models/feedback');
const Job = require('./models/job'); 

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CORS CONFIGURATION
// ==========================================
const whitelist = [
    'https://peppy-klepon-999ed1.netlify.app',      
    'https://www.lawwheelsservices.co.in',          
    'https://lawwheelsservices.co.in',
    'http://127.0.0.1:5500' 
];

const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions));
app.use(express.json());

// ==========================================
// 2. CLOUDINARY & MULTER CONFIG
// ==========================================
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'law-firm-blog',
    allowed_formats: ['jpg', 'jpeg', 'png']
  }
});
const upload = multer({ storage: storage }); 

// ==========================================
// 3. DATABASE CONNECTION (CLEANED & FIXED)
// ==========================================
// Fetching variable seamlessly whether it's named MONGO_URI, DB_URI, or dbURI
let dbURI = process.env.MONGO_URI || process.env.DB_URI || process.env.dbURI; 

// Auto-cleaner: Removes any hidden spaces or quotes around the URL 
if (dbURI) {
    dbURI = dbURI.trim().replace(/^["']|["']$/g, '');
}

// Safety check before connection
if (!dbURI || (!dbURI.startsWith('mongodb://') && !dbURI.startsWith('mongodb+srv://'))) {
    console.error('🚨 MONGODB CRASH PREVENTED: Invalid URL Scheme Detected!');
    console.error(`👉 What Render is receiving: "${dbURI}"`);
    console.error('👉 Please check Render Env Vars. Make sure it is exactly mongodb+srv://... without any extra text.');
    process.exit(1); 
}

mongoose.connect(dbURI)
  .then(() => {
    console.log('✅ Successfully connected to LWS MongoDB Cluster!');
    app.listen(PORT, () => console.log(`🚀 LWS Premium Backend is actively running on port ${PORT}`));
  })
  .catch(err => {
      console.error('🚨 MONGODB CONNECTION FAILED:', err.message);
      process.exit(1);
  });

// Slugify Function Helper
const slugify = text => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

// ==========================================
// 4. BLOG ROUTES
// ==========================================

// GET all posts
app.get('/posts', (req, res) => {
    Post.find()
        .sort({ createdAt: -1 })
        .then(posts => res.json(posts))
        .catch(err => res.status(500).json({ error: 'Server Error', details: err.message }));
});

// GET posts by category
app.get('/posts/category/:name', (req, res) => {
  const categoryName = decodeURIComponent(req.params.name).replace(/-/g, ' ');
  
  Post.find({ category: { $regex: new RegExp(`^${categoryName}$`, "i") } })
    .sort({ createdAt: -1 })
    .then(posts => res.json(posts))
    .catch(err => res.status(500).json({ error: 'Server Error', details: err.message }));
});

// GET a single post by slug
app.get('/posts/:slug', (req, res) => {
  Post.findOne({ slug: req.params.slug })
    .then(post => {
      if (post) {
        const processedPost = { ...post.toObject(), content: marked.parse(post.content) };
        res.json(processedPost);
      } else {
        res.status(404).json({ error: 'Post not found' });
      }
    })
    .catch(err => res.status(500).json({ error: 'Server Error', details: err.message }));
});

// POST a new blog post
app.post('/add-post', upload.single('image'), async (req, res) => {
  try {
    const postSlug = `${slugify(req.body.title)}-${Date.now()}`;
    const newPost = new Post({
      title: req.body.title, 
      slug: postSlug, 
      content: req.body.content, 
      author: req.body.author, 
      category: req.body.category,
      imageUrl: req.file ? req.file.path : null 
    });
    const savedPost = await newPost.save();
    res.json(savedPost);
  } catch (err) {
    if (err.code === 11000) {
        return res.status(409).json({ message: 'A post with this title already exists. Kindly update the title.' });
    }
    res.status(400).json({ error: 'Error saving post', details: err.message });
  }
});

// DELETE a blog post
app.delete('/posts/:id', (req, res) => {
    Post.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'Post deleted successfully.' }))
        .catch(err => res.status(400).json({ error: err.message }));
});

// ==========================================
// 5. FEEDBACK / TESTIMONIAL ROUTES
// ==========================================

app.post('/add-feedback', async (req, res) => {
    try {
        const newFeedback = new Feedback({
            clientName: req.body.clientName,
            address: req.body.address,
            occupation: req.body.occupation,
            serviceTaken: req.body.serviceTaken,
            feedbackContent: req.body.feedbackContent,
            isApproved: false 
        });
        await newFeedback.save();
        res.status(201).json({ message: 'Feedback submitted successfully. Pending admin approval.' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to submit feedback.', details: err.message });
    }
});

app.get('/testimonials', (req, res) => {
    Feedback.find({ isApproved: true }).sort({ createdAt: -1 })
        .then(feedback => res.json(feedback))
        .catch(err => res.status(500).json({ error: 'Could not fetch testimonials.' }));
});

app.get('/feedback/pending', (req, res) => {
    Feedback.find({ isApproved: false }).sort({ createdAt: -1 })
        .then(feedback => res.json(feedback))
        .catch(err => res.status(500).json({ error: 'Could not fetch pending feedback.' }));
});

app.put('/feedback/approve/:id', (req, res) => {
    Feedback.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true })
        .then(() => res.json({ message: 'Feedback approved and is now live.' }))
        .catch(err => res.status(400).json({ error: 'Could not approve feedback.' }));
});

app.delete('/feedback/:id', (req, res) => {
    Feedback.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'Feedback deleted successfully.' }))
        .catch(err => res.status(400).json({ error: 'Could not delete feedback.' }));
});

// ==========================================
// 6. CAREERS / JOB PORTAL ROUTES
// ==========================================

// PUBLIC: Get all ACTIVE job postings
app.get('/jobs', (req, res) => {
    Job.find({ isActive: true }).sort({ createdAt: -1 })
        .then(jobs => res.json(jobs))
        .catch(err => res.status(500).json({ error: 'Failed to fetch active jobs', details: err.message }));
});

// PUBLIC: Get a single job by slug
app.get('/jobs/:slug', (req, res) => {
    Job.findOne({ slug: req.params.slug, isActive: true })
        .then(job => {
            if (job) {
                const processedJob = { ...job.toObject(), description: marked.parse(job.description) };
                res.json(processedJob);
            } else {
                res.status(404).json({ error: 'Job not found or has been closed.' });
            }
        })
        .catch(err => res.status(500).json({ error: 'Server error', details: err.message }));
});

// ADMIN: Get ALL jobs (including closed ones for admin panel)
app.get('/admin/jobs', (req, res) => {
    Job.find().sort({ createdAt: -1 })
        .then(jobs => res.json(jobs))
        .catch(err => res.status(500).json({ error: 'Failed to fetch admin jobs', details: err.message }));
});

// ADMIN: Add a new job
app.post('/add-job', async (req, res) => {
    try {
        const jobSlug = `${slugify(req.body.title)}-${Date.now()}`;
        const newJob = new Job({
            title: req.body.title,
            slug: jobSlug,
            department: req.body.department,
            location: req.body.location,
            employmentType: req.body.employmentType,
            experienceLevel: req.body.experienceLevel,
            description: req.body.description,
            requirements: req.body.requirements,
            salaryRange: req.body.salaryRange,
            isActive: true
        });
        const savedJob = await newJob.save();
        res.status(201).json(savedJob);
    } catch (err) {
        res.status(400).json({ error: 'Error saving job post.', details: err.message });
    }
});

// ADMIN: Toggle Job Status (Open/Close a vacancy)
app.put('/jobs/toggle/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if(!job) return res.status(404).json({ error: 'Job not found' });
        
        job.isActive = !job.isActive;
        await job.save();
        res.json({ message: `Job vacancy is now ${job.isActive ? 'Active' : 'Closed'}` });
    } catch (err) {
        res.status(400).json({ error: 'Error updating job status.', details: err.message });
    }
});

// ADMIN: Delete a job
app.delete('/jobs/:id', (req, res) => {
    Job.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'Job vacancy deleted successfully.' }))
        .catch(err => res.status(400).json({ error: 'Could not delete job.' }));
});

// Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: 'LWS API Route not found.' });
});