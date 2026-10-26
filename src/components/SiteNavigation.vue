<script setup>
import { RouterLink } from 'vue-router';
import { useSceneNavigation } from '../composables/useSceneNavigation';
import '../styles/navigation.css';

const { scenes, isHome, activeScene, activeIndex, navigateToScene, navigateToAbout, skipToContent } = useSceneNavigation();
</script>

<template>
  <a class="skip-link" href="#main" @click="skipToContent">跳到内容</a>
  <header class="site-header site-navigation-header">
    <div class="navigation-brand-row">
      <RouterLink :to="{ path: '/', hash: '#home' }" custom v-slot="{ href, navigate }">
        <a class="brand" :href="href" aria-label="一里小屋首页" @click="navigateToScene($event, 'home', navigate)">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
          一里小屋<span class="brand-en">HITORI ROOM</span>
        </a>
      </RouterLink>
      <RouterLink to="/about" custom v-slot="{ href, navigate }">
        <a :href="href" class="navigation-about" :aria-current="!isHome ? 'page' : undefined" @click="navigateToAbout($event, navigate)">关于<span aria-hidden="true"> ↗</span></a>
      </RouterLink>
    </div>
    <nav aria-label="主导航">
      <RouterLink v-for="scene in scenes" :key="scene.id" :to="{ path: '/', hash: `#${scene.id}` }" custom v-slot="{ href, navigate }">
        <a :href="href" :aria-current="isHome && activeScene === scene.id ? 'location' : undefined" @click="navigateToScene($event, scene.id, navigate)">{{ scene.label }}</a>
      </RouterLink>
    </nav>
    <span class="header-scene-count" id="scene-current-index">{{ isHome ? `${activeIndex} / 05` : 'ABOUT' }}</span>
  </header>
  <nav v-if="isHome" id="scene-nav" class="scene-navigation" aria-label="分屏导航">
    <RouterLink v-for="scene in scenes" :key="scene.id" :to="{ path: '/', hash: `#${scene.id}` }" custom v-slot="{ href, navigate }">
      <a class="scene-link" :href="href" :aria-label="`第 ${scene.number} 幕：${scene.label}`" :aria-current="activeScene === scene.id ? 'location' : undefined" @click="navigateToScene($event, scene.id, navigate)"><span>{{ scene.number }}</span></a>
    </RouterLink>
  </nav>
</template>
