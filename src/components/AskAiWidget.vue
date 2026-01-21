<template>
  <div class="ask-ai-fab">
    <button class="ask-ai-button" type="button" @click="openAssistant">
      <ion-icon :icon="chatbubbleEllipsesOutline" />
      <span>Ask AI</span>
    </button>
  </div>

  <ion-modal :is-open="isOpen" @didDismiss="closeAssistant">
    <ion-header>
      <ion-toolbar>
        <ion-title>Inventory Assistant</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="resetConversation" fill="clear">Clear</ion-button>
          <ion-button @click="closeAssistant">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="assistant-grid">
        <section class="assistant-context">
          <h3>Context</h3>
          <ion-item>
            <ion-label position="stacked">Screen</ion-label>
            <ion-input v-model="context.screen" placeholder="e.g. Cycle Count > Imports" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">File name</ion-label>
            <ion-input v-model="context.fileName" placeholder="e.g. cycle_count_2024_11_15.csv" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Facility</ion-label>
            <ion-input v-model="context.facility" placeholder="e.g. DC-01" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Error text</ion-label>
            <ion-textarea
              v-model="context.errorText"
              auto-grow
              placeholder="Paste the View error message"
            />
          </ion-item>
          <p class="assistant-tip">
            Tip: Include the exact error message and what step you were on.
          </p>
        </section>

        <section class="assistant-chat">
          <div class="assistant-messages">
            <div
              v-for="(message, index) in messages"
              :key="index"
              class="assistant-message"
              :class="message.role"
            >
              {{ message.content }}
            </div>
          </div>

          <div class="assistant-status" v-if="statusMessage">{{ statusMessage }}</div>

          <form class="assistant-form" @submit.prevent="sendMessage">
            <ion-input
              v-model="userInput"
              placeholder="Describe the issue or ask for next steps"
              :disabled="isSending"
            />
            <ion-button type="submit" :disabled="isSending || !userInput.trim()">
              Send
            </ion-button>
          </form>
        </section>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonTextarea,
  IonTitle,
  IonToolbar
} from '@ionic/vue';
import { chatbubbleEllipsesOutline } from 'ionicons/icons';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isOpen = ref(false);
const isSending = ref(false);
const userInput = ref('');
const statusMessage = ref('');

const context = ref({
  screen: route.fullPath,
  fileName: '',
  facility: '',
  errorText: ''
});

const messages = ref([
  {
    role: 'assistant',
    content: 'Tell me what went wrong and include the exact error if you have it.'
  }
]);

const apiBase = computed(() => process.env.VUE_APP_AI_API_BASE || '');

watch(
  () => route.fullPath,
  (value) => {
    if (!isOpen.value) {
      context.value.screen = value;
    }
  }
);

function openAssistant() {
  isOpen.value = true;
  if (!context.value.screen) {
    context.value.screen = route.fullPath;
  }
}

function closeAssistant() {
  isOpen.value = false;
}

function resetConversation() {
  messages.value = [
    {
      role: 'assistant',
      content: 'Tell me what went wrong and include the exact error if you have it.'
    }
  ];
}

function buildChatUrl(): string {
  const base = apiBase.value.trim();
  if (!base) {
    return '/api/ai/chat';
  }
  return `${base.replace(/\/+$/, '')}/api/ai/chat`;
}

async function sendMessage() {
  const content = userInput.value.trim();
  if (!content || isSending.value) {
    return;
  }

  messages.value.push({ role: 'user', content });
  userInput.value = '';
  statusMessage.value = 'Thinking...';
  isSending.value = true;

  try {
    const response = await fetch(buildChatUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.value,
        context: {
          screen: context.value.screen || route.fullPath,
          fileName: context.value.fileName || undefined,
          facility: context.value.facility || undefined,
          errorText: context.value.errorText || undefined
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }

    messages.value.push({
      role: 'assistant',
      content: payload.text
    });
  } catch (error: any) {
    messages.value.push({
      role: 'assistant',
      content: `I hit an error: ${error.message || 'Unable to reach the AI service.'}`
    });
  } finally {
    statusMessage.value = '';
    isSending.value = false;
  }
}
</script>

<style scoped>
.ask-ai-fab {
  position: fixed;
  right: 20px;
  bottom: 24px;
  z-index: 10000;
}

.ask-ai-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  background: var(--ion-color-secondary);
  color: var(--ion-color-secondary-contrast);
  font-weight: 600;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.16);
  cursor: pointer;
}

.ask-ai-button ion-icon {
  font-size: 18px;
}

.assistant-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.3fr);
  gap: 16px;
}

.assistant-context h3 {
  margin: 0 0 12px;
  font-size: 1rem;
}

.assistant-tip {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin: 12px 0 0;
}

.assistant-chat {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assistant-messages {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 16px;
  padding: 12px;
  min-height: 320px;
  max-height: 45vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--ion-color-light);
}

.assistant-message {
  padding: 10px 12px;
  border-radius: 12px;
  line-height: 1.4;
  font-size: 0.95rem;
  max-width: 85%;
  white-space: pre-wrap;
}

.assistant-message.user {
  align-self: flex-end;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.assistant-message.assistant {
  align-self: flex-start;
  background: #ffffff;
  border: 1px solid var(--ion-color-light-shade);
  color: var(--ion-color-dark);
}

.assistant-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

.assistant-status {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

@media (max-width: 900px) {
  .assistant-grid {
    grid-template-columns: 1fr;
  }

  .assistant-form {
    grid-template-columns: 1fr;
  }
}
</style>
