const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const marked = require('marked');
const Post = require('./post');
const Feedback = require('./models/feedback');
const Job = require('./models/job'); // NEW: Import the Job model (Hum isko next step mein banayenge)

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS Configuration ---
const whitelist = [
    'https://peppy-klepon-999ed1.netlify.app',      
    'https://www.lawwheelsservices.co.in',          
    'https://lawwheelsservices.co.in'               
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

// --- Cloudinary Config ---
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

// Database Connection
const dbURI = process.env.dbURI; 

mongoose.connect(dbURI)
  .then(() => {
    console.log('Successfully connected to MongoDB!');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  })
  .catch(err => console.log(err));

// Slugify Function
const slugify = text => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');


// ==========================================
//              BLOG ROUTES
// ==========================================

// GET all posts
// CTO UPDATE: Added .select('-content') to optimize payload size for faster frontend loading and SEO crawling
app.get('/posts', (req, res) => {
    Post.find()
        .select('-content') // Removes the heavy content field from the list response
        .sort({ createdAt: -1 })
        .then(posts => res.json(posts))
        .catch(err => res.status(400).json({ error: err.message }));
});

// GET posts by category
// CTO UPDATE: Added .select('-content') here as well for optimization
app.get('/posts/category/:name', (req, res) => {
  const categoryName = decodeURIComponent(req.params.name).replace(/-/g, ' ');
  
  Post.find({ category: { $regex: new RegExp(`^${categoryName}$`, "i") } })
    .select('-content') // Optimization
    .sort({ createdAt: -1 })
    .then(posts => res.json(posts))
    .catch(err => res.status(400).json({ error: err.message }));
});

// GET a single post by slug (This still fetches the full content, which is correct)
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
    .catch(err => res.status(400).json({ error: err.message }));
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
    res.status(400).json({ error: 'Error saving post', details: err });
  }
});

// DELETE a blog post
app.delete('/posts/:id', (req, res) => Post.findByIdAndDelete(req.params.id).then(() => res.json({ message: 'Post deleted.' })).catch(err => res.status(400).json({ error: err.message })));


// ==========================================
//           FEEDBACK / TESTIMONIAL ROUTES
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
        const savedFeedback = await newFeedback.save();
        res.json({ message: 'Feedback submitted successfully.' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to submit feedback.', details: err.message });
    }
});

app.get('/testimonials', (req, res) => {
    Feedback.find({ isApproved: true }).sort({ createdAt: -1 })
        .then(feedback => res.json(feedback))
        .catch(err => res.status(400).json({ error: 'Could not fetch testimonials.' }));
});

app.get('/feedback/pending', (req, res) => {
    Feedback.find({ isApproved: false }).sort({ createdAt: -1 })
        .then(feedback => res.json(feedback))
        .catch(err => res.status(400).json({ error: 'Could not fetch pending feedback.' }));
});

app.put('/feedback/approve/:id', (req, res) => {
    Feedback.findByIdAndUpdate(req.params.id, { isApproved: true })
        .then(() => res.json({ message: 'Feedback approved.' }))
        .catch(err => res.status(400).json({ error: 'Could not approve feedback.' }));
});

app.delete('/feedback/:id', (req, res) => {
    Feedback.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'Feedback deleted.' }))
        .catch(err => res.status(400).json({ error: 'Could not delete feedback.' }));
});


// ==========================================
//           CAREERS / JOB PORTAL ROUTES (NEW)
// ==========================================

// 1. PUBLIC: Get all ACTIVE job postings
app.get('/jobs', (req, res) => {
    // Only fetch jobs where isActive is true
    Job.find({ isActive: true }).sort({ createdAt: -1 })
        .then(jobs => res.json(jobs))
        .catch(err => res.status(400).json({ error: err.message }));
});

// 2. PUBLIC: Get a single job by slug (for job detail page)
app.get('/jobs/:slug', (req, res) => {
    Job.findOne({ slug: req.params.slug, isActive: true })
        .then(job => {
            if (job) {
                // If you want markdown support for job descriptions, we parse it here
                const processedJob = { ...job.toObject(), description: marked.parse(job.description) };
                res.json(processedJob);
            } else {
                res.status(404).json({ error: 'Job not found or has been closed.' });
            }
        })
        .catch(err => res.status(400).json({ error: err.message }));
});

// 3. ADMIN: Get ALL jobs (including closed ones for admin panel)
app.get('/admin/jobs', (req, res) => {
    Job.find().sort({ createdAt: -1 })
        .then(jobs => res.json(jobs))
        .catch(err => res.status(400).json({ error: err.message }));
});

// 4. ADMIN: Add a new job
app.post('/add-job', async (req, res) => {
    try {
        const jobSlug = `${slugify(req.body.title)}-${Date.now()}`;
        const newJob = new Job({
            title: req.body.title,
            slug: jobSlug,
            department: req.body.department,
            location: req.body.location,
            employmentType: req.body.employmentType, // Full-time, Part-time, etc.
            experienceLevel: req.body.experienceLevel,
            description: req.body.description,
            requirements: req.body.requirements,
            salaryRange: req.body.salaryRange, // Optional but good for Google Jobs SEO
            isActive: true
        });
        const savedJob = await newJob.save();
        res.json(savedJob);
    } catch (err) {
        res.status(400).json({ error: 'Error saving job post.', details: err.message });
    }
});

// 5. ADMIN: Toggle Job Status (Open/Close a vacancy)
app.put('/jobs/toggle/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if(!job) return res.status(404).json({ error: 'Job not found' });
        
        job.isActive = !job.isActive; // Toggle boolean
        await job.save();
        res.json({ message: `Job is now ${job.isActive ? 'Active' : 'Closed'}` });
    } catch (err) {
        res.status(400).json({ error: 'Error updating job status.' });
    }
});

// 6. ADMIN: Delete a job
app.delete('/jobs/:id', (req, res) => {
    Job.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'Job vacancy deleted.' }))
        .catch(err => res.status(400).json({ error: 'Could not delete job.' }));
});