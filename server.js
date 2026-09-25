const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const marked = require('marked');
const NodeCache = require('node-cache'); 
const rateLimit = require('express-rate-limit'); 

// Models
const Post = require('./post'); 
const Feedback = require('./models/feedback');
const Job = require('./models/job'); 

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. PERFORMANCE CACHE & SECURITY LIMITERS
// ==========================================
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes memory cache

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, 
    message: { error: 'Too many requests from this IP, please try again later.' }
});

const formLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, 
    message: { error: 'Too many submissions, please try again after an hour.' }
});

// ==========================================
// 2. CORS & SECURITY CONFIGURATION
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
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// ==========================================
// 3. CLOUDINARY & MULTER CONFIG
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
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
  }
});
const upload = multer({ storage: storage }); 

// ==========================================
// 4. DATABASE CONNECTION
// ==========================================
let dbURI = process.env.MONGO_URI || process.env.DB_URI || process.env.dbURI; 

if (dbURI) {
    dbURI = dbURI.trim().replace(/^["']|["']$/g, '');
}

if (!dbURI || (!dbURI.startsWith('mongodb://') && !dbURI.startsWith('mongodb+srv://'))) {
    console.error('🚨 MONGODB CRASH PREVENTED: Invalid URL Scheme Detected!');
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

const slugify = text => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
const stripHtml = (html) => html.replace(/<[^>]*>?/gm, '').trim();

// ==========================================
// 🌟 5. UPGRADED: SMART SHARE PROXY (SEO & BOT OPTIMIZED) 🌟
// ==========================================
app.get('/share/:slug', apiLimiter, async (req, res) => {
    try {
        const cacheKey = `share_meta_${req.params.slug}`;
        let metaHtml = cache.get(cacheKey);

        const frontendUrl = `https://www.lawwheelsservices.co.in/post-detail.html?slug=${req.params.slug}`;
        const isBot = /bot|whatsapp|facebook|twitter|linkedin|skype|slack|telegram|google|bing/i.test(req.headers['user-agent'] || '');

        // Human Users: Instant HTTP 301 Redirect to Frontend (No ugly JS loading screens)
        if (!isBot) {
            return res.redirect(301, frontendUrl);
        }

        // Bot Traffic: Serve SEO optimized HTML if not in cache
        if (!metaHtml) {
            const post = await Post.findOne({ slug: req.params.slug });
            if (!post) return res.status(404).send('Post not found');

            const htmlContent = marked.parse(post.content);
            let plainTextDesc = stripHtml(htmlContent).substring(0, 155).replace(/\s+/g, ' ').trim();
            if(plainTextDesc.length >= 155) plainTextDesc += "...";

            const imageUrl = post.imageUrl || "https://www.lawwheelsservices.co.in/lwslogo.png";
            const siteTitle = `${post.title} | Law Wheels Services LLP`;
            const publishDate = post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString();
            const authorName = post.author || "Avnish Sharma";

            metaHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${siteTitle}</title>
                <meta name="description" content="${plainTextDesc}">
                
                <!-- SEO Fix: Strict Canonical Tag -->
                <link rel="canonical" href="${frontendUrl}" />
                
                <!-- Open Graph tags for WhatsApp, LinkedIn, Facebook -->
                <meta property="og:title" content="${siteTitle}">
                <meta property="og:description" content="${plainTextDesc}">
                <meta property="og:image" content="${imageUrl}">
                <meta property="og:image:secure_url" content="${imageUrl}">
                <meta property="og:image:width" content="1200">
                <meta property="og:image:height" content="630">
                <meta property="og:url" content="${frontendUrl}">
                <meta property="og:type" content="article">
                <meta property="og:site_name" content="Law Wheels Services LLP">
                
                <!-- Twitter Card data -->
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="${siteTitle}">
                <meta name="twitter:description" content="${plainTextDesc}">
                <meta name="twitter:image" content="${imageUrl}">

                <!-- Advanced JSON-LD Schema for Google Rich Snippets -->
                <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "Article",
                  "headline": "${siteTitle}",
                  "image": "${imageUrl}",
                  "author": { "@type": "Person", "name": "${authorName}" },
                  "publisher": {
                    "@type": "Organization",
                    "name": "Law Wheels Services LLP",
                    "logo": { "@type": "ImageObject", "url": "https://www.lawwheelsservices.co.in/lwslogo.png" }
                  },
                  "datePublished": "${publishDate}",
                  "description": "${plainTextDesc}"
                }
                </script>
            </head>
            <body>
                <h1>${siteTitle}</h1>
                <img src="${imageUrl}" alt="${siteTitle}" />
                <p>${plainTextDesc}</p>
            </body>
            </html>
            `;
            cache.set(cacheKey, metaHtml);
        }

        res.set('Content-Type', 'text/html');
        res.send(metaHtml);
    } catch (err) {
        console.error("Proxy Share Error:", err);
        res.status(500).send('Server Error generating preview.');
    }
});

// ==========================================
// 6. BLOG ROUTES (CACHED)
// ==========================================
app.get('/posts', apiLimiter, async (req, res) => {
    try {
        const cacheKey = 'all_posts';
        let posts = cache.get(cacheKey);
        if (!posts) {
            posts = await Post.find().sort({ createdAt: -1 });
            cache.set(cacheKey, posts);
        }
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

app.get('/posts/category/:name', apiLimiter, async (req, res) => {
    try {
        const categoryName = decodeURIComponent(req.params.name).replace(/-/g, ' ');
        const cacheKey = `posts_cat_${categoryName}`;
        let posts = cache.get(cacheKey);
        
        if (!posts) {
            posts = await Post.find({ category: { $regex: new RegExp(`^${categoryName}$`, "i") } }).sort({ createdAt: -1 });
            cache.set(cacheKey, posts);
        }
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

app.get('/posts/:slug', apiLimiter, async (req, res) => {
    try {
        const cacheKey = `post_${req.params.slug}`;
        let processedPost = cache.get(cacheKey);

        if (!processedPost) {
            const post = await Post.findOne({ slug: req.params.slug });
            if (post) {
                const parsedHtml = marked.parse(post.content);
                let aiSummary = stripHtml(parsedHtml).substring(0, 160).replace(/\s+/g, ' ').trim();
                if(aiSummary.length >= 160) aiSummary += "...";

                processedPost = { 
                    ...post.toObject(), 
                    content: parsedHtml,
                    seoSummary: aiSummary 
                };
                cache.set(cacheKey, processedPost);
            } else {
                return res.status(404).json({ error: 'Post not found' });
            }
        }
        res.json(processedPost);
    } catch (err) {
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

app.post('/add-post', formLimiter, upload.single('image'), async (req, res) => {
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
        cache.flushAll(); // Clear cache when new post is added
        res.json(savedPost);
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: 'Title already exists.' });
        res.status(400).json({ error: 'Error saving post', details: err.message });
    }
});

app.delete('/posts/:id', formLimiter, async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.id);
        cache.flushAll();
        res.json({ message: 'Post deleted successfully.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ==========================================
// 7. FEEDBACK / TESTIMONIAL ROUTES
// ==========================================
app.post('/add-feedback', formLimiter, async (req, res) => {
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
        cache.flushAll();
        res.status(201).json({ message: 'Feedback submitted.' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to submit.', details: err.message });
    }
});

app.get('/testimonials', apiLimiter, async (req, res) => {
    try {
        const cacheKey = 'approved_testimonials';
        let testimonials = cache.get(cacheKey);
        if(!testimonials) {
            testimonials = await Feedback.find({ isApproved: true }).sort({ createdAt: -1 });
            cache.set(cacheKey, testimonials);
        }
        res.json(testimonials);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching testimonials.' });
    }
});

app.get('/feedback/pending', apiLimiter, async (req, res) => {
    try {
        const pending = await Feedback.find({ isApproved: false }).sort({ createdAt: -1 });
        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching pending feedback.' });
    }
});

app.put('/feedback/approve/:id', formLimiter, async (req, res) => {
    try {
        await Feedback.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
        cache.flushAll();
        res.json({ message: 'Feedback approved.' });
    } catch (err) {
        res.status(400).json({ error: 'Error approving feedback.' });
    }
});

app.delete('/feedback/:id', formLimiter, async (req, res) => {
    try {
        await Feedback.findByIdAndDelete(req.params.id);
        cache.flushAll();
        res.json({ message: 'Feedback deleted.' });
    } catch (err) {
        res.status(400).json({ error: 'Error deleting feedback.' });
    }
});

// ==========================================
// 8. CAREERS / JOB PORTAL ROUTES
// ==========================================
app.get('/jobs', apiLimiter, async (req, res) => {
    try {
        const cacheKey = 'active_jobs';
        let jobs = cache.get(cacheKey);
        if(!jobs) {
            jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 });
            cache.set(cacheKey, jobs);
        }
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching jobs' });
    }
});

app.get('/jobs/:slug', apiLimiter, async (req, res) => {
    try {
        const cacheKey = `job_${req.params.slug}`;
        let jobObj = cache.get(cacheKey);
        if(!jobObj) {
            const job = await Job.findOne({ slug: req.params.slug, isActive: true });
            if(job) {
                jobObj = { ...job.toObject(), description: marked.parse(job.description) };
                cache.set(cacheKey, jobObj);
            } else {
                return res.status(404).json({ error: 'Job not found.' });
            }
        }
        res.json(jobObj);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/admin/jobs', apiLimiter, async (req, res) => {
    try {
        const jobs = await Job.find().sort({ createdAt: -1 });
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching jobs' });
    }
});

app.post('/add-job', formLimiter, async (req, res) => {
    try {
        const jobSlug = `${slugify(req.body.title)}-${Date.now()}`;
        const newJob = new Job({ ...req.body, slug: jobSlug, isActive: true });
        const savedJob = await newJob.save();
        cache.flushAll();
        res.status(201).json(savedJob);
    } catch (err) {
        res.status(400).json({ error: 'Error saving job post.', details: err.message });
    }
});

app.put('/jobs/toggle/:id', formLimiter, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if(!job) return res.status(404).json({ error: 'Job not found' });
        job.isActive = !job.isActive;
        await job.save();
        cache.flushAll();
        res.json({ message: `Job is now ${job.isActive ? 'Active' : 'Closed'}` });
    } catch (err) {
        res.status(400).json({ error: 'Error updating job status.' });
    }
});

app.delete('/jobs/:id', formLimiter, async (req, res) => {
    try {
        await Job.findByIdAndDelete(req.params.id);
        cache.flushAll();
        res.json({ message: 'Job deleted successfully.' });
    } catch (err) {
        res.status(400).json({ error: 'Could not delete job.' });
    }
});

app.use((req, res) => {
    res.status(404).json({ error: 'LWS API Route not found.' });
});