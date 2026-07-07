'use client';

import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { getChainConfig } from '@/lib/chain-config';

const queryClient = new QueryClient();

const activeChain = getChainConfig().chainId === baseSepolia.id ? baseSepolia : base;

const wagmiConfig = createConfig({
  chains: [activeChain],
  transports: {
    [base.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_ID
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`
        : 'https://mainnet.base.org',
    ),
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    ),
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#5168FF',
          walletList: [
            'detected_ethereum_wallets',
            'metamask',
            'coinbase_wallet',
            'rainbow',
            'wallet_connect_qr',
          ],
        },
        loginMethods: ['wallet', 'email', 'google', 'discord', 'telegram', 'farcaster'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: activeChain,
        supportedChains: [activeChain],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
