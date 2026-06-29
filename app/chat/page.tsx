'use client';

import React from 'react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import ChatRoom from '@/components/chat-room/ChatRoom';
import styles from './page.module.css';

export default function ChatPage() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.content}>
        <ChatRoom fullPage />
      </main>
    </div>
  );
}
