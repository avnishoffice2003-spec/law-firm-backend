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

// Configuration for your live domain (Used for Sitemap and Canonical tags)
const SITE_URL = 'https://www.lawwheelsservices.co.in';

// ==========================================
// 1. PERFORMANCE CACHE & SECURITY LIMITERS
// ==========================================
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes memory cache

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, 
    message: { error: 'Too many requests from this IP, please try again later.' }
});

const formLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
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
// 🌟 5. DYNAMIC XML SITEMAP (SEO OPTIMIZATION) 🌟
// ==========================================
app.get('/sitemap.xml', apiLimiter, async (req, res) => {
    try {
        const posts = await Post.find().select('slug createdAt').sort({ createdAt: -1 });
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        
        // Static Pages
        const staticPages = ['', '/about.html', '/services.html', '/blog.html', '/contact.html'];
        staticPages.forEach(page => {
            xml += `  <url>\n    <loc>${SITE_URL}${page}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        });

        // Dynamic Blog Routes
        posts.forEach(post => {
            if (post.slug) {
                const date = post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString();
                xml += `  <url>\n    <loc>${SITE_URL}/blog/${post.slug}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
            }
        });
        
        xml += `</urlset>`;
        
        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).end();
    }
});


// ==========================================
// 🌟 6. FULL SSR BLOG ROUTING (SEO/GEO FIX) 🌟
// ==========================================
// CTO Note: This fully replaces the old /share/:slug proxy. It serves the complete HTML 
// for humans and bots natively, resolving blank page indexing.
app.get('/blog/:slug', apiLimiter, async (req, res) => {
    try {
        const cacheKey = `ssr_blog_${req.params.slug}`;
        let htmlTemplate = cache.get(cacheKey);

        if (!htmlTemplate) {
            const post = await Post.findOne({ slug: req.params.slug });
            
            if (!post) {
                return res.status(404).send('<h1 style="text-align:center; margin-top:50px;">404 - Premium insight not found</h1>');
            }

            const parsedContent = marked.parse(post.content);
            const plainTextDesc = stripHtml(parsedContent).substring(0, 155).replace(/\s+/g, ' ').trim() + "...";
            const imageUrl = post.imageUrl || `${SITE_URL}/lwslogo.png`;
            const fullTitle = `${post.title} | Law Wheels Services LLP`;
            const cleanCanonicalUrl = `${SITE_URL}/blog/${post.slug}`;
            const publishDate = post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString();
            const displayDate = post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recently Published';

            // Schema.org for Rich Snippets
            const schema = {
                "@context": "https://schema.org",
                "@type": "LegalArticle",
                "mainEntityOfPage": { "@type": "WebPage", "@id": cleanCanonicalUrl },
                "headline": post.title,
                "image": [imageUrl],
                "datePublished": publishDate,
                "author": { "@type": "Person", "name": post.author || "Avnish Sharma", "jobTitle": "Founder & Managing Partner" },
                "publisher": { "@type": "Organization", "name": "Law Wheels Services LLP", "logo": { "@type": "ImageObject", "url": `${SITE_URL}/lwslogo.png` } },
                "description": plainTextDesc
            };

            // Generating the complete SSR HTML payload
            htmlTemplate = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${fullTitle}</title>
                <meta name="description" content="${plainTextDesc}">
                <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
                <link rel="canonical" href="${cleanCanonicalUrl}">
                
                <meta property="og:title" content="${fullTitle}">
                <meta property="og:description" content="${plainTextDesc}">
                <meta property="og:image" content="${imageUrl}">
                <meta property="og:url" content="${cleanCanonicalUrl}">
                <meta property="og:type" content="article">
                <meta property="og:site_name" content="Law Wheels Services LLP">
                
                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="${fullTitle}">
                <meta name="twitter:description" content="${plainTextDesc}">
                <meta name="twitter:image" content="${imageUrl}">
            
                <script type="application/ld+json">${JSON.stringify(schema)}</script>
            
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
                <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Montserrat:wght@400;600;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                
                <style>
                    body, html { background-color: #ffffff !important; margin: 0; padding: 0; min-height: 100vh; }
                    body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; background-attachment: fixed; }
                    body::before { content: ""; position: fixed; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at center, rgba(99, 102, 241, 0.08) 0%, rgba(236, 72, 153, 0.05) 30%, rgba(59, 130, 246, 0.08) 60%, rgba(255, 255, 255, 0) 80%); filter: blur(80px); animation: aurora-move 20s infinite alternate linear; z-index: -2; pointer-events: none; }
                    @keyframes aurora-move { 0% { transform: translate(0, 0) rotate(0deg); } 100% { transform: translate(-10%, -10%) rotate(10deg); } }
                    .post-hero { padding: 40px 20px 20px 20px; position: relative; z-index: 2; text-align: center; }
                    .premium-post-vault { background: #ffffff; border: 1px solid rgba(212, 175, 55, 0.4); border-radius: 24px; padding: 60px; box-shadow: 0 30px 60px rgba(0,0,0,0.08); margin: 0 auto; max-width: 900px; }
                    .post-full-content p { font-size: 1.15rem; line-height: 1.8; color: #334155; margin-bottom: 25px; font-family: 'Lora', serif; }
                    .post-full-content h3, .post-full-content h4 { color: #1e3a8a; font-family: 'Montserrat', sans-serif; font-weight: 700; margin-top: 40px; margin-bottom: 20px; font-size: 1.6rem; }
                    .btn-gold-back { background: linear-gradient(135deg, #d4af37 0%, #fde047 100%); color: #0f172a; padding: 14px 30px; border-radius: 12px; font-weight: 800; text-transform: uppercase; text-decoration: none; display: inline-flex; transition: 0.3s; font-family: 'Montserrat', sans-serif; }
                    .btn-gold-back:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(212, 175, 55, 0.5); color: #000; }
                </style>
            </head>
            <body>
                <header class="post-hero">
                    <a href="${SITE_URL}" style="text-decoration: none; font-size: 1.5rem; font-weight: 800; color: #0f172a; font-family: 'Montserrat', sans-serif;">
                        LAW WHEELS SERVICES LLP
                    </a>
                </header>
                <main class="container my-5" style="position: relative; z-index: 2;">
                    <div class="premium-post-vault">
                        <article>
                            ${post.imageUrl ? `<img src="${post.imageUrl}" class="img-fluid rounded mb-4" alt="${post.title}" style="max-height:450px; width:100%; object-fit:cover;">` : ''}
                            <h1 style="color: #0f172a; font-weight: 800; font-size: 2.5rem; margin-bottom: 1rem; font-family: 'Montserrat', sans-serif;">${post.title}</h1>
                            <div style="background: rgba(212, 175, 55, 0.1); border-radius: 50px; padding: 6px 18px; color: #b48600; font-weight: 700; font-size: 0.85rem; display: inline-block; margin-bottom: 30px;">
                                By ${post.author || 'Avnish Sharma'} | Published on ${displayDate}
                            </div>
                            <div class="post-full-content">
                                ${parsedContent}
                            </div>
                        </article>
                    </div>
                    <div class="text-center mt-5">
                        <a href="${SITE_URL}/blog.html" class="btn-gold-back"><i class="fas fa-arrow-left me-2"></i> Return to Blog</a>
                    </div>
                </main>
            </body>
            </html>`;
            
            cache.set(cacheKey, htmlTemplate);
        }

        res.set('Content-Type', 'text/html');
        res.send(htmlTemplate);
    } catch (err) {
        console.error("SSR Blog Error:", err);
        res.status(500).send('<h1 style="text-align:center;">Server Error generating page.</h1>');
    }
});

// Backward compatibility redirect for old share links
app.get('/share/:slug', (req, res) => {
    res.redirect(301, `/blog/${req.params.slug}`);
});


// ==========================================
// 7. EXISTING BLOG API ROUTES (UNCHANGED)
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
// 8. EXISTING FEEDBACK / TESTIMONIAL ROUTES (UNCHANGED)
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
// 9. EXISTING CAREERS / JOB PORTAL ROUTES (UNCHANGED)
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
