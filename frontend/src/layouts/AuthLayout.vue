<script setup lang="ts">
import BrandLogo from '@/components/BrandLogo.vue'
import AppIcon from '@/components/AppIcon.vue'
import craftScene from '@/assets/craft-scene.svg'
</script>

<template>
  <div class="auth-page">
    <header class="site-header">
      <BrandLogo />
      <p class="header-note">
        一份手作，一份独一无二的心意。
      </p>
    </header>
    <main class="auth-shell">
      <section
        class="auth-story"
        aria-label="拾作手作社区"
      >
        <div class="story-copy">
          <p class="eyebrow">
            MADE BY HAND · MADE FOR YOU
          </p>
          <h2>把喜欢的手作，<br>带进日常。</h2>
          <p class="story-description">
            发现有温度的作品，<br>与认真生活的创作者相遇。
          </p>
        </div>
        <div class="story-art">
          <img
            :src="craftScene"
            alt="手工皮革托特包、青釉陶杯与编织材料组成的工作室一角"
            width="660"
            height="390"
          >
          <span class="art-note"><i /> 慢慢做，才有独一无二的模样</span>
        </div>
        <div class="story-bottom">
          <span><AppIcon name="leaf" /> 好手艺，值得被看见</span><span>THE ART OF EVERYDAY</span>
        </div>
      </section>
      <section
        class="auth-panel"
        aria-label="账号认证"
      >
        <slot />
      </section>
    </main>
    <footer class="site-footer">
      <span>拾作 SHIZUO</span><span>让每一份手作，都找到它的主人。</span><span>手工定制作品分享与交易平台</span>
    </footer>
  </div>
</template>
