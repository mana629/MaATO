import { useEffect, useRef } from "react";

export function ScrollAnimationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalFrames = 191;
  const imagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    // Preload images
    const images: HTMLImageElement[] = [];
    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const frameNum = String(i).padStart(3, "0");
      img.src = `/animation-frames/ezgif-frame-${frameNum}.jpg`;
      images.push(img);
    }
    imagesRef.current = images;

    // Load first frame immediately
    images[0].onload = () => {
      drawFrame(0);
    };

    const handleScroll = () => {
      const html = document.documentElement;
      const scrollTop = window.scrollY || html.scrollTop;
      const scrollHeight = html.scrollHeight - html.clientHeight;
      const scrollFraction = scrollTop / (scrollHeight || 1);
      
      // Map scroll fraction to frame index
      const frameIndex = Math.min(
        totalFrames - 1,
        Math.floor(scrollFraction * totalFrames)
      );

      requestAnimationFrame(() => {
        drawFrame(frameIndex);
      });
    };

    const drawFrame = (index: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = imagesRef.current[index];
      if (!img || !img.complete) return;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      if (imgWidth === 0 || imgHeight === 0) return;

      const imgRatio = imgWidth / imgHeight;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawWidth = canvasWidth;
      let drawHeight = canvasHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > canvasRatio) {
        drawWidth = canvasHeight * imgRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
      } else {
        drawHeight = canvasWidth / imgRatio;
        offsetY = (canvasHeight - drawHeight) / 2;
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      handleScroll();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    
    // Initialize size and render first frame
    handleResize();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none object-cover"
      style={{ zIndex: -10 }}
    />
  );
}
