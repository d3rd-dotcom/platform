'use client';

/**
 * Dev harness for the procedural headset model. Fixed pose (spin off) so
 * renders are comparable against the reference photo while iterating.
 */

import { HeadsetCanvas } from '@/components/landing/HeadsetModel';

export default function HeadsetDevPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 'min(920px, 96vw)', height: 620 }}>
        <HeadsetCanvas spin={false} />
      </div>
    </div>
  );
}
