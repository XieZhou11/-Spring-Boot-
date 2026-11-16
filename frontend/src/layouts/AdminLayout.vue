<script setup lang="ts">
import BrandLogo from '@/components/BrandLogo.vue'
import SessionTools from '@/components/SessionTools.vue'
import '@/assets/styles/account.css'
defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div class="member-page admin-page">
    <header class="site-header">
      <BrandLogo /><SessionTools /><RouterLink
        class="account-back"
        to="/"
      >返回我的拾作 ↗</RouterLink>
    </header><main class="admin-shell">
      <aside class="admin-sidebar">
        <p class="eyebrow">
          SHIZUO / CURATION
        </p><h2>拾作管理室</h2><p class="admin-caption">
          认真核对每一份手艺。
        </p><nav aria-label="后台管理">
          <RouterLink
            to="/admin/creator-applications"
            active-class="active"
          ><span>01</span> 入驻审核 <i aria-hidden="true">↗</i></RouterLink><RouterLink
            to="/admin/categories"
            active-class="active"
          ><span>02</span> 品类管理 <i aria-hidden="true">↗</i></RouterLink>
        </nav><span
          class="admin-seal"
          aria-hidden="true"
        >审</span>
      </aside><section class="admin-content">
        <header class="admin-heading">
          <p class="eyebrow">
            CAREFUL REVIEW, TRUSTED CRAFT
          </p><h1>{{ title }}</h1><p>{{ subtitle }}</p>
        </header><slot />
      </section>
    </main><footer class="site-footer">
      <span>拾作 SHIZUO</span><span>每一份信任，都有据可循。</span>
    </footer>
  </div>
</template>
