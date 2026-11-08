import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom';
import YouTube from 'react-youtube';

// URL se video ID nikalne ka helper
const getVideoId = (url) => {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
};

// localStorage helpers
const getSavedTime = (id) => {
  try {
    return Number(localStorage.getItem(`yt-progress-${id}`)) || 0;
  } catch {
    return 0;
  }
};

const saveTime = (id, time) => {
  try {
    localStorage.setItem(`yt-progress-${id}`, String(Math.floor(time)));
  } catch { }
};

// Ek video card ka player (thumbnail pehle, click pe player)
const VideoPlayer = ({ url, title }) => {
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);
  const playerRef = useRef(null);
  const videoId = getVideoId(url);

  if (!videoId) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
        Video link missing
      </div>
    );
  }

  const stopTracking = () => {
    clearInterval(intervalRef.current);
    if (playerRef.current) {
      saveTime(videoId, playerRef.current.getCurrentTime());
    }
  };

  const startTracking = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (playerRef.current) {
        saveTime(videoId, playerRef.current.getCurrentTime());
      }
    }, 5000); // har 5 second me save
  };

  const onReady = (e) => {
    playerRef.current = e.target;
  };

  const onStateChange = (e) => {
    // 1 = playing, 2 = paused, 0 = ended
    if (e.data === 1) startTracking();
    if (e.data === 2) stopTracking();
    if (e.data === 0) {
      clearInterval(intervalRef.current);
      saveTime(videoId, 0);
    }
  };

  // Thumbnail view (fast load)
  if (!playing) {
    const saved = getSavedTime(videoId);
    return (
      <button
        onClick={() => setPlaying(true)}
        className="absolute inset-0 w-full h-full group"
        aria-label={`Play ${title}`}
      >
        <img
          src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
          <span className="w-14 h-14 rounded-full bg-[#007acc] text-white flex items-center justify-center text-2xl">
            ▶
          </span>
        </span>
        {saved > 0 && (
          <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Resume from {Math.floor(saved / 60)}:{String(saved % 60).padStart(2, '0')}
          </span>
        )}
      </button>
    );
  }

  // Real player (click ke baad)
  return (
    <YouTube
      videoId={videoId}
      className="absolute top-0 left-0 w-full h-full"
      iframeClassName="w-full h-full"
      opts={{
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          start: getSavedTime(videoId),
          rel: 0,
        },
      }}
      onReady={onReady}
      onStateChange={onStateChange}
      onEnd={() => saveTime(videoId, 0)}
    />
  );
};

const Courses = () => {
  const courseData = [
    {
      step: "Step 1",
      title: "HTML5 Fundamentals & Web Structure",
      embedUrl: "https://youtu.be/k2DSi1zGEc8",
      tag: "HTML"
    },
    {
      step: "Step 2",
      title: "CSS3 Styling, Flexbox & Grid Systems",
      embedUrl: "https://youtu.be/Edsxf_NBFrw?si=V2ft4K3PcBME0g6G",
      tag: "CSS"
    },
    {
      step: "Step 3",
      title: "JavaScript ES6+ & DOM Manipulation",
      embedUrl: "https://www.youtube.com/watch?v=VlPiVmYuoqw&pp=ygUtanMgZnVsbCBjb3Vyc2UgaW4gaGluZGkgb25lIHNob3QgYXBuYSBjb2xsYWdl",
      tag: "JS"
    }
  ];

  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#d4d4d4] font-mono p-6">
      <div className="flex items-center gap-3 border-b border-[#333333] pb-4 mb-6">
        <div className="flex gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block"></span>
        </div>
        <h2 className="text-lg text-[#569cd6] font-semibold tracking-wide">
          {"// Learn here"}
        </h2>
        <Link
          to='/'
          className='group inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all duration-300 ease-in-out hover:text-white hover:border-slate-500 shadow-sm hover:shadow-md hover:shadow-slate-900/50 active:scale-95'
        >
          <span className='transition-transform duration-300 group-hover:-translate-x-1'>&larr;</span>
          <span>Back</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courseData.map((course, index) => (
          <div
            key={index}
            className="bg-[#252526] border border-[#3c3c3c] hover:border-[#007acc] rounded-lg p-4 flex flex-col justify-between transition-all duration-300 shadow-lg hover:shadow-cyan-900/20"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="bg-[#007acc] text-white text-xs font-bold px-2.5 py-1 rounded">
                {course.step}
              </span>
              <span className="text-[#ce9178] text-sm italic font-sans">
                {course.tag}
              </span>
            </div>

            <h3 className="text-[#4ec9b0] text-base font-medium mb-4 line-clamp-2">
              {course.title}
            </h3>

            <div className="relative w-full pt-[56.25%] rounded overflow-hidden bg-black">
              <VideoPlayer url={course.embedUrl} title={course.title} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Courses