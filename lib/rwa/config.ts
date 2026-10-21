import { getAppStellarNetwork, getStellarNetworkConfig, type StellarNetwork } from '@/lib/stellar/network-config'

export const DEFAULT_TESTNET_REGISTRY_CONTRACT =
  'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526'

export const DEFAULT_PLATFORM_FEE_RECIPIENT =
  process.env.NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS ||
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export const DEFAULT_USDC_TOKEN =
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ||
  'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'

export const RWA_CONFIG = {
  tokenDecimals: 7,
  fundingFeeBps: 100, // 1.00%
  feePolicyVersion: 1,
  defaultDeadlineDays: 30,
} as const

export function getCreditRegistryContractId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_CREDIT_REGISTRY_CONTRACT_ID?.trim()
  if (fromEnv) return fromEnv
  return DEFAULT_TESTNET_REGISTRY_CONTRACT
}

export function getRwaNetworkConfig(network: StellarNetwork = getAppStellarNetwork()) {
  return getStellarNetworkConfig(network)
}
