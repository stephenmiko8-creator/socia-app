"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [activePlatforms, setActivePlatforms] = useState(["twitter", "linkedin"]);
  const [postText, setPostText] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedUrl, setFeedUrl] = useState("https://techcrunch.com/feed/");
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [currentTab, setCurrentTab] = useState("overview");
  const [personaBackground, setPersonaBackground] = useState("");
  const [personaAudience, setPersonaAudience] = useState("");
  const [personaGoal, setPersonaGoal] = useState("");
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [userMatrix, setUserMatrix] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [insightsData, setInsightsData] = useState(null);
  const [ghostwriterMode, setGhostwriterMode] = useState("expert");

  const fetchInsights = async () => {
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (data.success) {
        setInsightsData(data);
      }
    } catch (err) {
      console.error("Failed to fetch insights", err);
    }
  };

  const handleGeneratePersona = async () => {
    if (!personaBackground || !personaAudience || !personaGoal) return alert("Please fill all fields!");
    setIsGeneratingPersona(true);
    try {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background: personaBackground, audience: personaAudience, goal: personaGoal })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Persona successfully generated and saved! The AI will now use this matrix for all your posts.");
        setCurrentTab("overview");
      } else {
        alert("Error: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsGeneratingPersona(false);
    }
  };

  const handleDeletePost = async (id) => {
    if (!confirm("Are you sure you want to delete this scheduled post?")) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchPosts();
      } else {
        alert("Failed to delete post: " + data.error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      if (data.success) {
        setScheduledPosts(data.posts);
      }
    } catch (err) {
      console.error("Failed to fetch posts", err);
    }
  };

  const fetchMatrix = async () => {
    try {
      const res = await fetch("/api/persona");
      const data = await res.json();
      if (data.success && data.persona) {
        setUserMatrix(data.persona.matrix);
      }
    } catch (err) {
      console.error("Failed to fetch persona", err);
    }
  };

  const handleEditSave = async (id) => {
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editedText })
      });
      if (res.ok) {
        setEditingPostId(null);
        fetchPosts();
      }
    } catch (err) {
      alert("Error saving: " + err.message);
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Checkout failed: " + data.error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  useEffect(() => {
    if (session) {
      fetchPosts();
      fetchMatrix();
      fetchInsights();
    }
  }, [session]);

  const handleGenerate = async (isBulk = false) => {
    if (!feedUrl.trim()) return;
    setIsGenerating(true);
    try {
      const endpoint = isBulk ? "/api/agent/bulk" : "/api/agent/generate";
      const payload = { feedUrls: feedUrl, feedUrl, platforms: activePlatforms, ghostwriterMode };
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        alert(isBulk ? "Successfully drafted an entire week of posts!" : "AI successfully generated and scheduled a post!");
        fetchPosts();
      } else {
        alert("Error generating: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!postText.trim() || activePlatforms.length === 0) return;
    
    setIsPublishing(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText, platforms: activePlatforms })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        alert("Successfully published!");
        setPostText("");
        fetchPosts();
      } else {
        alert("Error publishing: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };
  const togglePlatform = (platform) => {
    setActivePlatforms(prev => 
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const getPlatformClass = (platform) => {
    return `platform-bubble ${platform} ${activePlatforms.includes(platform) ? 'active' : ''}`;
  };

  if (status === "loading") {
    return <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  }

  if (!session) {
    return (
      <div style={{ background: '#0a0a0f', minHeight: '100vh', color: 'white', fontFamily: 'inherit', overflowX: 'hidden' }}>
        {/* Navigation */}
        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem 5%', position: 'absolute', width: '100%', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '1.5rem', background: 'linear-gradient(135deg, #FF3366, #FF9933)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#gradLogo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="gradLogo" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF3366" />
                  <stop offset="100%" stopColor="#FF9933" />
                </linearGradient>
              </defs>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            Socia
          </div>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <a href="#features" style={{ color: '#a0a0b8', textDecoration: 'none', transition: 'color 0.2s' }}>Features</a>
            <a href="#pricing" style={{ color: '#a0a0b8', textDecoration: 'none', transition: 'color 0.2s' }}>Pricing</a>
            <button onClick={() => signIn()} style={{ background: 'white', color: '#0a0a0f', padding: '0.6rem 1.5rem', borderRadius: '30px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
              Login
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section style={{ paddingTop: '15vh', minHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 5%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(255,51,102,0.15) 0%, rgba(10,10,15,0) 70%)', zIndex: 0, pointerEvents: 'none' }} />
          
          <div style={{ zIndex: 1, maxWidth: '800px', marginTop: '10vh' }}>
            <div style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '30px', color: '#FF9933', fontSize: '0.9rem', marginBottom: '2rem', fontWeight: 600 }}>
              🚀 The fully autonomous ghostwriting engine.
            </div>
            <h1 style={{ fontSize: '4.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-1px' }}>
              Your Personal AI <br />
              <span style={{ background: 'linear-gradient(135deg, #FF3366, #FF9933)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Social Media Manager.</span>
            </h1>
            <p style={{ fontSize: '1.25rem', color: '#a0a0b8', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem auto', lineHeight: 1.6 }}>
              Build an authentic presence on LinkedIn and Twitter. Socia learns your unique voice, curates industry news, and drafts a full week of engaging content in seconds.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => signIn()} style={{ background: 'linear-gradient(135deg, #FF3366, #FF9933)', color: 'white', padding: '1rem 2rem', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', cursor: 'pointer', boxShadow: '0 10px 30px rgba(255,51,102,0.3)', transition: 'transform 0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                Start Auto-Posting for Free
              </button>
            </div>
          </div>
          
          {/* Dashboard Mockup */}
          <div style={{ marginTop: '5rem', width: '100%', maxWidth: '1000px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '1rem', zIndex: 1, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
             <div style={{ width: '100%', height: '400px', background: '#12121a', borderRadius: '16px', position: 'relative', overflow: 'hidden', display: 'flex' }}>
                {/* Mockup Sidebar */}
                <div style={{ width: '200px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                   <div style={{ height: '20px', width: '80%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '2rem' }}></div>
                   <div style={{ height: '15px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1rem' }}></div>
                   <div style={{ height: '15px', width: '90%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1rem' }}></div>
                   <div style={{ height: '15px', width: '85%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1rem' }}></div>
                </div>
                {/* Mockup Main */}
                <div style={{ flex: 1, padding: '2rem' }}>
                   <div style={{ height: '30px', width: '250px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '2rem' }}></div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                     <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,51,102,0.2)' }}></div>
                     <div style={{ height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}></div>
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" style={{ padding: '8rem 5%', background: '#0a0a0f' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Everything on Autopilot.</h2>
            <p style={{ color: '#a0a0b8', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>We replaced the entire social media agency with an automated matrix.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {[
              { icon: '🧠', title: 'Persona Matrix', desc: 'Socia creates a 5-day custom strategy matrix. You never have to think about "what to post" ever again.' },
              { icon: '🔥', title: 'Virality Hacker', desc: 'Toggle the Virality Mode to inject aggressive, algorithm-optimized hooks and polarizing calls-to-action.' },
              { icon: '🚀', title: 'Bulk RSS Ingestion', desc: 'Paste 5 news feeds. Socia reads them all and drafts an entire week of content in 10 seconds.' }
            ].map((feature, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '2.5rem', transition: 'transform 0.3s' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-10px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>{feature.icon}</div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white' }}>{feature.title}</h3>
                <p style={{ color: '#a0a0b8', lineHeight: 1.6 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" style={{ padding: '8rem 5%', background: '#12121a', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Simple, transparent pricing.</h2>
            <p style={{ color: '#a0a0b8', fontSize: '1.1rem' }}>Start for free, upgrade when you go viral.</p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            {/* Free Tier */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '3rem', width: '100%', maxWidth: '350px' }}>
              <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem' }}>Starter</h3>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'white', marginBottom: '2rem' }}>$0<span style={{ fontSize: '1rem', color: '#a0a0b8', fontWeight: 400 }}>/mo</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', color: '#a0a0b8', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <li>✓ 3 AI Posts per week</li>
                <li>✓ LinkedIn Integration</li>
                <li>✓ Basic Persona Builder</li>
              </ul>
              <button onClick={() => signIn()} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '1rem', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Get Started</button>
            </div>
            
            {/* Pro Tier */}
            <div style={{ background: 'linear-gradient(180deg, rgba(255,51,102,0.1) 0%, rgba(255,153,51,0.02) 100%)', border: '1px solid #FF3366', borderRadius: '24px', padding: '3rem', width: '100%', maxWidth: '350px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #FF3366, #FF9933)', color: 'white', padding: '5px 15px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>MOST POPULAR</div>
              <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem' }}>Viral Pro</h3>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'white', marginBottom: '2rem' }}>$29<span style={{ fontSize: '1rem', color: '#a0a0b8', fontWeight: 400 }}>/mo</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', color: '#a0a0b8', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <li><strong style={{ color: 'white' }}>✓ Unlimited</strong> AI Posts</li>
                <li>✓ Twitter/X + LinkedIn</li>
                <li>✓ Bulk RSS Automation</li>
                <li>✓ 🔥 Virality Hacker Mode</li>
              </ul>
              <button onClick={() => signIn()} style={{ width: '100%', background: 'linear-gradient(135deg, #FF3366, #FF9933)', color: 'white', padding: '1rem', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Upgrade to Pro</button>
            </div>
          </div>
        </section>
        
        {/* Footer */}
        <footer style={{ padding: '3rem 5%', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#a0a0b8' }}>
          © 2026 Socia. Built for the algorithm.
        </footer>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      {/* Sidebar */}
      <aside className="sidebar glass">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF3366" />
                <stop offset="100%" stopColor="#FF9933" />
              </linearGradient>
            </defs>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          Socia
        </div>
        
        <nav className="nav-menu">
          <a href="#" className={`nav-item ${currentTab === "overview" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setCurrentTab("overview"); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="3" width="7" height="7" rx="2"></rect><rect x="14" y="14" width="7" height="7" rx="2"></rect><rect x="3" y="14" width="7" height="7" rx="2"></rect></svg>
            Overview
          </a>
          <a href="#" className={`nav-item ${currentTab === "planner" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setCurrentTab("planner"); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Planner
          </a>
          <a href="#" className={`nav-item ${currentTab === "insights" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setCurrentTab("insights"); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 20h.01"></path><path d="M7 20v-4"></path><path d="M12 20v-8"></path><path d="M17 20V8"></path><path d="M22 4v16"></path></svg>
            Insights
          </a>
          <a href="#" className="nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Accounts
          </a>
          <a href="#" className={`nav-item ${currentTab === "persona" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setCurrentTab("persona"); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            AI Persona
          </a>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); signOut(); }} style={{ color: '#FF3366' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Sign Out
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header-glass glass">
          <div className="header-text">
            <h1>Good Morning, Alex ✨</h1>
            <p>Let's create something amazing today.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '0.5rem 0.5rem 0.5rem 1.5rem', borderRadius: '999px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <span style={{ fontWeight: 700, color: '#1e1e2f' }}>Alex Studio</span>
            <Image src="/avatar.png" alt="Profile" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          </div>
        </header>

        {currentTab === "persona" ? (
          <div className="bento-card card-compose glass" style={{ gridColumn: 'span 3', padding: '3rem' }}>
            <div className="card-title">
              <span style={{background: 'linear-gradient(135deg, #FF9933, #FF0066)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex'}}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </span>
              Define Your AI Persona
            </div>
            <p style={{ color: '#64648c', marginBottom: '2rem' }}>Tell the AI who you are and who you want to reach. It will automatically build your 5-Day Content Matrix.</p>
            
            <label style={{ fontWeight: 700, color: '#1e1e2f', display: 'block', marginBottom: '0.5rem' }}>1. Your Background (Paste LinkedIn 'About' section)</label>
            <textarea 
              className="premium-textarea" 
              style={{ minHeight: '100px', marginBottom: '1.5rem', width: '100%' }}
              placeholder="e.g. Finance Student in France with a passion for M&A..."
              value={personaBackground}
              onChange={(e) => setPersonaBackground(e.target.value)}
            />

            <label style={{ fontWeight: 700, color: '#1e1e2f', display: 'block', marginBottom: '0.5rem' }}>2. Target Audience</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none', background: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', fontFamily: 'inherit', fontSize: '1rem' }}
              placeholder="e.g. Junior Analysts, PE Directors, Finance Students"
              value={personaAudience}
              onChange={(e) => setPersonaAudience(e.target.value)}
            />

            <label style={{ fontWeight: 700, color: '#1e1e2f', display: 'block', marginBottom: '0.5rem' }}>3. Core Goal</label>
            <input 
              type="text" 
              style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none', background: 'rgba(255,255,255,0.5)', marginBottom: '2rem', fontFamily: 'inherit', fontSize: '1rem' }}
              placeholder="e.g. Demonstrate technical mastery to land an internship"
              value={personaGoal}
              onChange={(e) => setPersonaGoal(e.target.value)}
            />

            <button 
              className="premium-btn" 
              onClick={handleGeneratePersona}
              disabled={isGeneratingPersona}
              style={{ background: 'linear-gradient(135deg, #FF9933, #FF0066)', width: '100%' }}
            >
              {isGeneratingPersona ? "Building Matrix..." : "Generate My Matrix ✨"}
            </button>
          </div>
        ) : currentTab === "planner" ? (
          <div className="bento-card card-compose glass" style={{ gridColumn: 'span 3', padding: '3rem' }}>
            <div className="card-title">
              <span style={{background: 'linear-gradient(135deg, #00C9FF, #92FE9D)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex'}}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </span>
              Content Planner
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem', width: '100%', alignItems: 'flex-start' }}>
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => {
                const dayPosts = scheduledPosts.filter(p => new Date(p.scheduledAt).toLocaleString('en-US', { weekday: 'long' }) === day);
                const strategy = userMatrix ? userMatrix[day] : null;

                return (
                  <div key={day} style={{ minWidth: '350px', maxWidth: '350px', background: 'rgba(255,255,255,0.4)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e1e2f', display: 'flex', justifyContent: 'space-between' }}>
                        {day}
                        <span style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.1)', padding: '2px 8px', borderRadius: '12px' }}>{dayPosts.length} posts</span>
                      </h3>
                      {strategy && (
                        <div style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, rgba(127,0,255,0.1), rgba(225,0,255,0.1))', padding: '0.8rem', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7F00FF', textTransform: 'uppercase' }}>Strategy: {strategy.strategy}</span>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64648c' }}>{strategy.description}</p>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {dayPosts.length === 0 ? (
                        <p style={{ color: '#64648c', fontSize: '0.9rem', textAlign: 'center', margin: '2rem 0' }}>No posts scheduled.</p>
                      ) : (
                        dayPosts.map((post) => (
                          <div key={post.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.8rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, color: '#1e1e2f', fontSize: '0.9rem' }}>
                                {new Date(post.scheduledAt).toLocaleString([], { hour: '2-digit', minute:'2-digit' })}
                              </span>
                            </div>
                            
                            {editingPostId === post.id ? (
                              <textarea 
                                className="premium-textarea"
                                style={{ minHeight: '150px', padding: '0.8rem', fontSize: '0.9rem' }}
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                              />
                            ) : (
                              <p style={{ whiteSpace: 'pre-wrap', color: '#1e1e2f', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{post.text}</p>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                               {editingPostId === post.id ? (
                                 <>
                                  <button onClick={() => setEditingPostId(null)} className="premium-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'transparent', color: '#64648c', border: '1px solid #ccc', boxShadow: 'none' }}>Cancel</button>
                                  <button onClick={() => handleEditSave(post.id)} className="premium-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#00C9FF', boxShadow: 'none' }}>Save</button>
                                 </>
                               ) : (
                                 <>
                                  <button onClick={() => { setEditingPostId(post.id); setEditedText(post.text); }} className="premium-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'transparent', color: '#1e1e2f', border: '1px solid #ddd', boxShadow: 'none' }}>Edit</button>
                                  <button onClick={() => handleDeletePost(post.id)} className="premium-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'transparent', color: '#FF3366', border: '1px solid #FF3366', boxShadow: 'none' }}>Delete</button>
                                 </>
                               )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : currentTab === "insights" ? (
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="bento-card glass" style={{ gridColumn: 'span 3', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div className="card-title" style={{ margin: 0 }}>
                 <span style={{background: 'linear-gradient(135deg, #7F00FF, #E100FF)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex'}}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 20h.01"></path><path d="M7 20v-4"></path><path d="M12 20v-8"></path><path d="M17 20V8"></path><path d="M22 4v16"></path></svg>
                 </span>
                 Performance Insights
               </div>
            </div>

            <div className="bento-card glass" style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: '#64648c', fontWeight: 700, margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>Total Impressions</p>
              <h2 style={{ fontSize: '3rem', margin: 0, background: 'linear-gradient(135deg, #7F00FF, #E100FF)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                {insightsData ? insightsData.overview.totalImpressions : "0"}
              </h2>
            </div>

            <div className="bento-card glass" style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: '#64648c', fontWeight: 700, margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>Engagements</p>
              <h2 style={{ fontSize: '3rem', margin: 0, background: 'linear-gradient(135deg, #FF3366, #FF9933)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                {insightsData ? insightsData.overview.totalEngagements : "0"}
              </h2>
            </div>

            <div className="bento-card glass" style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: '#64648c', fontWeight: 700, margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>Avg Engagement Rate</p>
              <h2 style={{ fontSize: '3rem', margin: 0, background: 'linear-gradient(135deg, #00C9FF, #92FE9D)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                {insightsData ? insightsData.overview.averageEngagement : "0%"}
              </h2>
            </div>

            <div className="bento-card glass" style={{ gridColumn: 'span 3', padding: '2rem' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', color: '#1e1e2f', fontSize: '1.2rem' }}>Top Performing Posts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {insightsData && insightsData.topPosts.map(post => (
                  <div key={post.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr', background: 'rgba(255,255,255,0.6)', padding: '1.5rem', borderRadius: '12px', alignItems: 'center' }}>
                    <p style={{ margin: 0, color: '#1e1e2f', fontSize: '0.95rem', paddingRight: '1rem' }}>"{post.text}"</p>
                    <div style={{ textAlign: 'center' }}><span style={{ fontWeight: 800, color: '#7F00FF' }}>{post.views.toLocaleString()}</span> views</div>
                    <div style={{ textAlign: 'center' }}><span style={{ fontWeight: 800, color: '#FF3366' }}>{post.likes.toLocaleString()}</span> likes</div>
                    <div style={{ textAlign: 'center' }}><span style={{ fontWeight: 800, color: '#00C9FF' }}>{post.engagementRate}</span> rate</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
        <div className="bento-grid">
          {/* Main Compose Card */}
          <div className="bento-card card-compose glass">
            <div className="card-title">
              <span style={{background: '#FF3366', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex'}}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </span>
              Create Post
            </div>
            
            <textarea 
              className="premium-textarea"
              placeholder="What's on your mind? Share your story..."
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
            />

            <div className="platform-selector">
              <div className={getPlatformClass("twitter")} onClick={() => togglePlatform("twitter")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
              </div>
              <div className={getPlatformClass("linkedin")} onClick={() => togglePlatform("linkedin")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
              </div>
              <div className={getPlatformClass("facebook")} onClick={() => togglePlatform("facebook")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </div>
              <div className={getPlatformClass("tiktok")} onClick={() => togglePlatform("tiktok")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.5v5.5a4 4 0 0 1-4 4z"></path></svg>
              </div>
            </div>

            <div className="compose-actions">
              <span style={{ fontWeight: 600, color: '#64648c' }}>{postText.length} / 280</span>
              <button 
                className="premium-btn" 
                onClick={handlePublish}
                disabled={isPublishing || !postText.trim() || activePlatforms.length === 0}
                style={{ opacity: (isPublishing || !postText.trim() || activePlatforms.length === 0) ? 0.5 : 1 }}
              >
                {isPublishing ? "Publishing..." : "Publish Now ✨"}
              </button>
            </div>

            {activePlatforms.includes("tiktok") && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.2)', borderRadius: '16px', border: '1px solid rgba(255,0,80,0.3)', animation: 'fadeIn 0.3s ease' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e1e2f', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>📱</span> TikTok Carousel Preview
                  <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64648c', marginLeft: 'auto' }}>Use double-newlines (Enter) to split slides</span>
                </h4>
                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {(postText.split('\n\n').filter(t => t.trim().length > 0).length > 0 ? postText.split('\n\n').filter(t => t.trim().length > 0) : ["Write your viral hook here..."]).map((slideText, index, arr) => (
                    <div key={index} style={{ minWidth: '150px', height: '266px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', flexShrink: 0, border: '1px solid rgba(255,255,255,0.5)' }}>
                      <Image 
                        src={`/api/og/carousel?text=${encodeURIComponent(slideText.slice(0, 150))}&slide=${index + 1}&total=${arr.length}&author=${encodeURIComponent(session?.user?.name || "Alex Studio")}`} 
                        alt={`Slide ${index + 1}`} 
                        width={150} 
                        height={266} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Agent Card */}
          <div className="bento-card card-stats glass" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              <span style={{background: 'linear-gradient(135deg, #FF9933, #FF0066)', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex'}}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </span>
              AI Autopilot
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64648c', margin: 0 }}>Paste an RSS link (or multiple on new lines) to auto-generate posts.</p>
            <textarea 
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://techcrunch.com/feed/&#10;https://bloomberg.com/feed/"
              style={{ width: '100%', minHeight: '80px', padding: '0.8rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', outline: 'none', background: 'rgba(255,255,255,0.5)', resize: 'none', fontFamily: 'inherit', marginBottom: '1rem' }}
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div 
                onClick={() => setGhostwriterMode("expert")}
                style={{ padding: '1rem', background: ghostwriterMode === "expert" ? 'linear-gradient(135deg, rgba(0,201,255,0.1), rgba(146,254,157,0.1))' : 'rgba(0,0,0,0.02)', border: ghostwriterMode === "expert" ? '2px solid #00C9FF' : '2px solid rgba(0,0,0,0.05)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>☕</div>
                <h4 style={{ margin: 0, color: ghostwriterMode === "expert" ? '#00C9FF' : '#1e1e2f', fontSize: '0.95rem' }}>Humble Expert</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64648c' }}>Human & authoritative.</p>
              </div>
              <div 
                onClick={() => {
                  if (session?.user?.tier === "PRO") {
                    setGhostwriterMode("viral");
                  } else {
                    handleUpgrade();
                  }
                }}
                style={{ padding: '1rem', background: ghostwriterMode === "viral" ? 'linear-gradient(135deg, rgba(255,51,102,0.1), rgba(255,153,51,0.1))' : 'rgba(0,0,0,0.02)', border: ghostwriterMode === "viral" ? '2px solid #FF3366' : '2px solid rgba(0,0,0,0.05)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', position: 'relative' }}
              >
                {session?.user?.tier !== "PRO" && (
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'linear-gradient(135deg, #FF3366, #FF9933)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(255,51,102,0.3)' }}>
                    PRO
                  </div>
                )}
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔥</div>
                <h4 style={{ margin: 0, color: ghostwriterMode === "viral" ? '#FF3366' : '#1e1e2f', fontSize: '0.95rem' }}>Virality Hacker</h4>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64648c' }}>{session?.user?.tier === "PRO" ? "Aggressive algorithmic hooks." : "Upgrade to unlock 🔒"}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                className="premium-btn" 
                onClick={() => handleGenerate(false)}
                disabled={isGenerating || !feedUrl.trim()}
                style={{ padding: '0.8rem', opacity: (isGenerating || !feedUrl.trim()) ? 0.5 : 1, background: 'linear-gradient(135deg, #FF9933, #FF0066)' }}
              >
                {isGenerating ? "Reading..." : "Generate 1 Post ✨"}
              </button>
              <button 
                className="premium-btn" 
                onClick={() => handleGenerate(true)}
                disabled={isGenerating || !feedUrl.trim()}
                style={{ padding: '0.8rem', opacity: (isGenerating || !feedUrl.trim()) ? 0.5 : 1, background: 'transparent', color: '#FF3366', border: '2px solid #FF3366', boxShadow: 'none' }}
              >
                {isGenerating ? "Drafting Week..." : "Auto-Draft Full Week 🚀"}
              </button>
            </div>
          </div>

          {/* Upcoming Schedule */}
          <div className="bento-card card-upcoming glass">
             <div className="card-title">
              <span style={{background: '#7F00FF', color: 'white', padding: '8px', borderRadius: '12px', display: 'flex'}}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </span>
              Up Next
            </div>
            
            {scheduledPosts.length === 0 ? (
              <div className="upcoming-item" style={{ opacity: 0.5 }}>
                <div className="upcoming-text">No posts scheduled yet.</div>
              </div>
            ) : (
              scheduledPosts.map((post) => (
                <div className="upcoming-item" key={post.id}>
                  <div className="upcoming-time">
                    {new Date(post.scheduledAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </div>
                  <div className="upcoming-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    "{post.text}"
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
