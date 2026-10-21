'use client'

import React, { useState } from 'react'
import type { CreditAssetTerms, TransactionIntentStatus } from '@/lib/rwa/types'

export interface RwaIssuanceCardProps {
  readonly dealId: string
  readonly dealTitle: string
  readonly amount: number
  readonly status: string
  readonly existingAssetId?: string | null
  readonly existingTxHash?: string | null
  readonly locale?: 'en' | 'es'
  readonly onIssueComplete?: (assetId: string, txHash: string) => void
}

const LABELS = {
  en: {
    title: 'RWA Credit Asset Issuance',
    dealAmount: 'Deal Principal',
    status: 'Issuance Status',
    assetId: 'Asset ID',
    txHash: 'Transaction Hash',
    signingWallet: 'Signing Admin Wallet',
    prepare: 'Prepare Issuance Intent',
    signAndSubmit: 'Sign & Submit Issuance',
    retry: 'Retry Reconcile',
    confirmedBadge: 'Asset Confirmed on Stellar',
    pendingBadge: 'Issuance in Progress...',
    unknownBadge: 'Timeout / Pending Inclusion — Recoverable',
    failedBadge: 'Issuance Failed',
    viewOnExplorer: 'View on Stellar Expert',
    readyToIssue: 'Ready for admin review and Soroban registration.',
  },
  es: {
    title: 'Emisión de Activo de Crédito RWA',
    dealAmount: 'Principal del Acuerdo',
    status: 'Estado de Emisión',
    assetId: 'ID del Activo',
    txHash: 'Hash de Transacción',
    signingWallet: 'Billetera Administradora',
    prepare: 'Preparar Intención de Emisión',
    signAndSubmit: 'Firmar y Enviar Emisión',
    retry: 'Reintentar Conciliación',
    confirmedBadge: 'Activo Confirmado en Stellar',
    pendingBadge: 'Emisión en Proceso...',
    unknownBadge: 'Tiempo Agotado / Inclusión Pendiente — Recuperable',
    failedBadge: 'Emisión Fallida',
    viewOnExplorer: 'Ver en Stellar Expert',
    readyToIssue: 'Listo para revisión de admin y registro en Soroban.',
  },
}

export function RwaIssuanceCard({
  dealId,
  dealTitle,
  amount,
  status: dealStatus,
  existingAssetId,
  existingTxHash,
  locale = 'en',
  onIssueComplete,
}: RwaIssuanceCardProps) {
  const t = LABELS[locale] || LABELS.en

  const [intentStatus, setIntentStatus] = useState<TransactionIntentStatus>(
    existingAssetId ? 'confirmed' : 'prepared',
  )
  const [assetId, setAssetId] = useState<string>(existingAssetId || '')
  const [txHash, setTxHash] = useState<string>(existingTxHash || '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const explorerUrl = txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : null

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.title}</h3>
          <p className="text-sm text-slate-500">{dealTitle}</p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            intentStatus === 'confirmed'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : intentStatus === 'failed'
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              : intentStatus === 'unknown'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
          }`}
        >
          {intentStatus === 'confirmed'
            ? t.confirmedBadge
            : intentStatus === 'failed'
            ? t.failedBadge
            : intentStatus === 'unknown'
            ? t.unknownBadge
            : t.readyToIssue}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 text-sm">
        <div>
          <span className="text-slate-500 block">{t.dealAmount}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            ${amount.toLocaleString()} USDC
          </span>
        </div>
        {assetId && (
          <div>
            <span className="text-slate-500 block">{t.assetId}</span>
            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate block">
              {assetId}
            </span>
          </div>
        )}
        {txHash && (
          <div className="md:col-span-2">
            <span className="text-slate-500 block">{t.txHash}</span>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-mono"
              >
                {txHash} ({t.viewOnExplorer})
              </a>
            ) : (
              <span className="font-mono text-xs">{txHash}</span>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
