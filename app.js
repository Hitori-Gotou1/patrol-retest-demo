(() => {
  'use strict';
  const data = window.SITE_DATA;
  const gallery = document.querySelector('#gallery-grid');
  const status = document.querySelector('#gallery-status');
  const lightbox = document.querySelector('#lightbox');
  const storageKey = 'hitori-room:favorites:v1';
  let favorites = new Set();
  let activeFilter = 'all';
  let selectedImage = 0;
  let localVideoURL = null;
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) favorites = new Set(saved.filter(id => typeof id === 'string'));
  } catch { storageAvailable = false; }
  const heroImage = document.querySelector('#hero-image');
  heroImage.src = data.cover;
  heroImage.alt = data.coverAlt;

  function visibleImages() { return data.gallery.filter(item => activeFilter === 'all' || item.category === activeFilter); }
  function updateFavorite(button, item) {
    const selected = favorites.has(item.id);
    button.textContent = selected ? '♥' : '♡';
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', `${selected ? '取消收藏' : '收藏'}：${item.title}`);
  }
  data.gallery.forEach(item => {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.dataset.category = item.category;
    const pictureButton = document.createElement('button');
    pictureButton.type = 'button';
    pictureButton.className = 'gallery-image-button';
    pictureButton.setAttribute('aria-label', `放大图片：${item.title}`);
    const image = document.createElement('img');
    image.src = item.src; image.alt = item.alt; image.loading = 'lazy'; image.decoding = 'async';
    const tag = document.createElement('span');
    tag.className = 'gallery-tag'; tag.textContent = item.tag;
    const expand = document.createElement('span');
    expand.className = 'expand-icon'; expand.textContent = '↗'; expand.setAttribute('aria-hidden', 'true');
    pictureButton.append(image, tag, expand);
    pictureButton.addEventListener('click', () => {
      selectedImage = visibleImages().findIndex(image => image.id === item.id);
      showImage(); lightbox.showModal(); document.body.style.overflow = 'hidden';
    });
    const caption = document.createElement('div'); caption.className = 'gallery-card-caption';
    const text = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = item.title;
    const subtitle = document.createElement('small'); subtitle.textContent = item.subtitle;
    text.append(title, subtitle);
    const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = 'favorite';
    updateFavorite(favorite, item);
    favorite.addEventListener('click', () => {
      favorites.has(item.id) ? favorites.delete(item.id) : favorites.add(item.id);
      try { localStorage.setItem(storageKey, JSON.stringify([...favorites])); storageAvailable = true; }
      catch { storageAvailable = false; }
      updateFavorite(favorite, item);
      status.textContent = storageAvailable ? `已收藏 ${favorites.size} 张` : '当前浏览器无法保存收藏，仅本次有效';
    });
    caption.append(text, favorite); card.append(pictureButton, caption); gallery.append(card);
  });

  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active); filter.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.gallery-card').forEach(card => { card.hidden = activeFilter !== 'all' && card.dataset.category !== activeFilter; });
    status.textContent = `显示 ${visibleImages().length} 张`;
  }));

  function showImage() {
    const images = visibleImages();
    selectedImage = (selectedImage + images.length) % images.length;
    const item = images[selectedImage];
    const image = document.querySelector('#lightbox-image');
    image.src = item.src; image.alt = item.alt;
    document.querySelector('#lightbox-title').textContent = item.title;
    document.querySelector('#lightbox-credit').textContent = item.credit;
    document.querySelector('#lightbox-count').textContent = `${String(selectedImage + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
    document.querySelector('#lightbox-prev').hidden = images.length < 2;
    document.querySelector('#lightbox-next').hidden = images.length < 2;
  }
  function stepImage(step) { selectedImage += step; showImage(); }
  document.querySelector('#lightbox-prev').addEventListener('click', () => stepImage(-1));
  document.querySelector('#lightbox-next').addEventListener('click', () => stepImage(1));
  document.querySelector('#lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => { if (event.target === lightbox) { const bounds = lightbox.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) lightbox.close(); } });
  lightbox.addEventListener('close', () => { document.body.style.overflow = ''; });
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stepImage(event.key === 'ArrowLeft' ? -1 : 1); }
  });

  const video = document.querySelector('#video-player');
  const videoFile = document.querySelector('#video-file');
  const videoStatus = document.querySelector('#video-status');
  function loadVideo(src, title, description, poster = '') {
    video.pause();
    video.src = src;
    if (poster) video.poster = poster; else video.removeAttribute('poster');
    video.hidden = false; document.querySelector('#video-empty').hidden = true;
    document.querySelector('#video-name').textContent = title;
    document.querySelector('#video-description').textContent = description;
    videoStatus.textContent = '正在读取视频…'; video.load();
  }
  document.querySelector('#choose-video').addEventListener('click', () => videoFile.click());
  videoFile.addEventListener('change', () => {
    const file = videoFile.files[0];
    if (!file) return;
    if (!(file.type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(file.name))) { videoStatus.textContent = '请选择视频文件，例如 MP4 或 WebM。'; videoFile.value = ''; return; }
    if (localVideoURL) URL.revokeObjectURL(localVideoURL);
    localVideoURL = URL.createObjectURL(file);
    loadVideo(localVideoURL, file.name.replace(/\.[^.]+$/, ''), '你选中的片段 · 仅在本机预览');
    videoFile.value = '';
  });
  video.addEventListener('loadedmetadata', () => { videoStatus.textContent = '视频已就绪，点击播放即可观看。'; });
  video.addEventListener('error', () => { videoStatus.textContent = '视频无法播放，请检查路径或换用浏览器支持的 MP4 / WebM 文件。'; });
  window.addEventListener('pagehide', () => { video.pause(); });
  if (data.video && data.video.src) loadVideo(data.video.src, data.video.title, data.video.description, data.video.poster);
})();
