import React, { useEffect, useRef, useState } from 'react';

const Animation = () => {
  const frameCount = 51;
  const fps = 4;
  const interval = 1000 / fps;

  const [frame, setFrame] = useState(0);
  const imagesRef = useRef([]);
  const lastTimeRef = useRef(performance.now());
  const animRef = useRef();

  // Preload images
  useEffect(() => {
    const loaded = [];
    for (let i = frameCount - 1; i >= 0; i--) {
      const img = new Image();
      img.src = `/images/animation/${i}.png`;
      loaded.push(img);
    }
    imagesRef.current = loaded;
  }, []);

  // Animate using requestAnimationFrame
  useEffect(() => {
    const animate = (time) => {
      const delta = time - lastTimeRef.current;

      if (delta >= interval) {
        setFrame((prev) => (prev + 1) % frameCount);
        lastTimeRef.current = time;
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [interval, frameCount]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <img
        src={imagesRef.current[frame]?.src}
        alt="Capybara Ostrich Animation"
        style={{
          width: '500px',
          height: 'auto',
          imageRendering: 'pixelated'
        }}
      />
    </div>
  );
};

export default Animation;
